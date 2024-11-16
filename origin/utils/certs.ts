import acme from "acme-client";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import querystring from "querystring";

const challengesPath = `/usr/src/app/challenges`;
const certsPath = `/usr/src/app/certs`;

enum CertStatus {
  VALID = "valid",
  FAILED = "failed",
  OBTAINED = "obtained"
}

interface Issuer {
  name: string;
  url: string;
}

const issuers: Issuer[] = [
  { name: "Let's Encrypt", url: acme.directory.letsencrypt.production },
  { name: "ZeroSSL", url: "https://acme.zerossl.com/v2/DV90" },
  { name: "Buypass Go SSL", url: "https://api.buypass.com/acme/directory" },
  // Add more ACME endpoints as needed...
];

function checkCertificateValidity(certificatePath: string, host: string): boolean {
  try {
    const certData = fs.readFileSync(certificatePath, "utf-8");
    const cert = new crypto.X509Certificate(certData);
    const currentDate = new Date();

    const oneWeekAway = new Date();
    oneWeekAway.setDate(oneWeekAway.getDate() + 7);
    if (currentDate >= new Date(cert.validFrom) && new Date(cert.validTo) <= oneWeekAway) {
      console.log("The SSL certificate is less than one week away from expiring. Time to issue a new certificate.");
      return false;
    } else if (currentDate >= new Date(cert.validFrom) && currentDate <= new Date(cert.validTo)) {
      console.log(`The SSL certificate for ${host} is valid.`);
      return true;
    } else {
      console.log(`The SSL certificate for ${host} has expired or is not yet valid. Current date: ${currentDate} - Certificate Valid from ${cert.validFrom} to ${cert.validTo}`);
      return false;
    }
  } catch (error: any) {
    console.error(`Error while checking ${host}'s SSL certificate:`, error.message);
    return false;
  }
}

async function generateEABCredentials(email?: string, apiKey?: string): Promise<{ kid: string; hmacKey: string }> {
  const zerosslAPIBase = "https://api.zerossl.com/acme";
  const endpoint = apiKey
    ? `${zerosslAPIBase}/eab-credentials?${querystring.stringify({ access_key: apiKey })}`
    : `${zerosslAPIBase}/eab-credentials-email`;
  const headers: Record<string, string> = {
    "User-Agent": "CertMagic"
  };

  if (!apiKey) {
    if (!email) {
      console.warn("Missing email address for ZeroSSL; it is strongly recommended to set one for next time");
      email = "caddy@zerossl.com";
    }
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const requestOptions: RequestInit = {
    method: "POST",
    headers: headers,
    body: apiKey ? null : querystring.stringify({ email })
  };

  const response = await fetch(endpoint, requestOptions);

  if (response.ok) {
    const result = await response.json();

    if (!result.success) {
      throw new Error(`Failed to get EAB credentials: HTTP ${response.status}: ${result.error.type} (code ${result.error.code})`);
    }
    return {
      kid: result.eab_kid,
      hmacKey: result.eab_hmac_key
    };
  } else {
    throw new Error(`Failed to get EAB credentials: HTTP ${response.status}`);
  }
}

interface Domain {
  host: string;
}

async function obtainAndRenewCertificates(domains: Domain[]): Promise<void> {
  for (const domain of domains) {
    await obtainAndRenewCertificate(domain);
  }
}

async function obtainAndRenewCertificate(domain: Domain): Promise<CertStatus> {
  console.log(process.env.__dirname, process.env);
  const certPath = path.join(certsPath, `${domain.host}`, `${domain.host}.crt`);
  const keyPath = path.join(certsPath, `${domain.host}`, `${domain.host}.key`);
  const jsonPath = path.join(certsPath, `${domain.host}`, `${domain.host}.json`);

  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(jsonPath)) {
      const validCert = checkCertificateValidity(certPath, domain.host);
      if (!validCert) {
        console.log(`Renewing certificate for ${domain.host}`);
      } else {
        return CertStatus.VALID;
      }
    }

    for (const issuer of issuers) {
      try {
        console.log(`Obtaining certificate for ${domain.host} from ${issuer.name} / ${issuer.url}`);
        const client = new acme.Client({
          directoryUrl: issuer.url,
          accountKey: await acme.crypto.createPrivateKey(),
          externalAccountBinding: issuer.name === "ZeroSSL" ? await generateEABCredentials() : undefined,
        });
        const [key, csr] = await acme.crypto.createCsr({
          commonName: String(domain.host),
        });
        const cert = await client.auto({
          csr,
          email: "caddy@zerossl.com",
          termsOfServiceAgreed: true,
          challengePriority: ["http-01"],
          challengeCreateFn: async (authz, challenge, keyAuthorization) => {
            const filePath = path.join(
              challengesPath,
              challenge.token
            );
            fs.writeFileSync(filePath, keyAuthorization);
            console.log("Written challenge");
          },
          challengeRemoveFn: async (authz, challenge) => {
            const filePath = path.join(
              challengesPath,
              challenge.token
            );
            fs.unlinkSync(filePath);
          },
        });
        if (!fs.existsSync(path.join(certsPath, `${domain.host}`))) {
          fs.mkdirSync(path.join(certsPath, `${domain.host}`), { recursive: true });
        }
        const json = `{"sans": ["${domain.host}"],"issuer_data": {"url": "https://media.network/"}}`;
        fs.writeFileSync(certPath, cert);
        fs.writeFileSync(keyPath, key);
        fs.writeFileSync(jsonPath, json);
        console.log(`Certificate for ${domain.host} obtained and saved.`);
        return CertStatus.OBTAINED;
      } catch (error) {
        console.error(`Failed to obtain certificate from ${issuer.name}:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to obtain certificate for ${domain.host}:`, error);
    return CertStatus.FAILED;
  }

  return CertStatus.FAILED;
}

export { obtainAndRenewCertificates, obtainAndRenewCertificate, challengesPath, CertStatus };