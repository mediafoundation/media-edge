import acme from "acme-client";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import querystring from "querystring";
import { getDNSProvider } from "../services/dnsProviders/factory";
import { Domain } from "../config/interfaces";
import { env } from "../config/env";

export enum CertStatus {
  VALID = "valid",
  FAILED = "failed",
  OBTAINED = "obtained"
}

export const challengesPath = `/usr/src/app/challenges`;
const certsPath = `/usr/src/app/certs`;
const accountsDir = `/usr/src/app/certs/accounts`;

// List of ACME issuers.
const issuers: { name: string; url: string }[] = [
  { name: "ZeroSSL", url: acme.directory.zerossl.production },
  { name: "Let's Encrypt", url: acme.directory.letsencrypt.production },
  { name: "Buypass Go SSL", url: acme.directory.buypass.production },
];

// Check if an existing certificate is valid.
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

// Generate External Account Binding credentials for ZeroSSL.
async function generateEABCredentials(email?: string, apiKey?: string): Promise<{ kid: string; hmacKey: string }> {
  const zerosslAPIBase = "https://api.zerossl.com/acme";
  const endpoint = apiKey
    ? `${zerosslAPIBase}/eab-credentials?${querystring.stringify({ access_key: apiKey })}`
    : `${zerosslAPIBase}/eab-credentials-email`;
  const headers: Record<string, string> = {
    "User-Agent": "CertMagic"
  };

  if (!apiKey) {
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

async function getAccountKey(email: string): Promise<string> {
  fs.mkdirSync(accountsDir, { recursive: true });
  const sanitizedEmail = email.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const accountKeyPath = path.join(accountsDir, `${sanitizedEmail}.key`);
  if (fs.existsSync(accountKeyPath)) {
    console.log(`Loading existing account key for ${email}`);
    return fs.readFileSync(accountKeyPath, "utf8");
  } else {
    console.log(`Creating new account key for ${email}`);
    const keyBuffer = await acme.crypto.createPrivateKey();
    const key = keyBuffer.toString();
    fs.writeFileSync(accountKeyPath, key);
    return key;
  }
}

export async function obtainAndRenewCertificates(domains: Domain[]): Promise<void> {
  for (const domain of domains) {
    await obtainAndRenewCertificate(domain);
  }
}

export async function obtainAndRenewCertificate(domain: Domain): Promise<CertStatus> {
  const folderName = domain.host.replace(/^\*\./, "wildcard_");
  const certPath = path.join(certsPath, folderName, `${folderName}.crt`);
  const keyPath = path.join(certsPath, folderName, `${folderName}.key`);
  const jsonPath = path.join(certsPath, folderName, `${folderName}.json`);
  const pemPath = path.join(certsPath, folderName, `${folderName}.pem`);
  const challengeType = domain.dns_provider ? "dns-01" : "http-01";
  // Use domain.email if provided, otherwise fallback to global env.email.
  const email = domain.email || env.email;

  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(jsonPath)) {
      const validCert = checkCertificateValidity(certPath, folderName);
      if (validCert) {
        return CertStatus.VALID;
      }
      console.log(`Renewing certificate for ${domain.host}`);
    }

    // Get or create the account key for this email.
    const accountKey = await getAccountKey(email);

    // Loop through the defined issuers.
    for (const issuer of issuers) {
      try {
        console.log(`Obtaining certificate for ${domain.host} from ${issuer.name} / ${issuer.url}`);
        const client = new acme.Client({
          directoryUrl: issuer.url,
          accountKey: accountKey,
          externalAccountBinding: issuer.name === "ZeroSSL" ? await generateEABCredentials(email) : undefined,
        });
        const [key, csr] = await acme.crypto.createCsr({ commonName: domain.host });
        const cert = await client.auto({
          csr,
          email: email,
          termsOfServiceAgreed: true,
          challengePriority: [challengeType],
          challengeCreateFn: async (authz, challenge, keyAuthorization) => {
            if (challengeType === "dns-01") {
              // For DNS-01, use the DNS provider.
              const dnsProvider = await getDNSProvider(domain);
              await dnsProvider.set(keyAuthorization, domain);
              console.log(`DNS challenge record for ${domain.host} set`);
            } else {
              // For HTTP-01, write the challenge file.
              const filePath = path.join(challengesPath, challenge.token);
              fs.writeFileSync(filePath, keyAuthorization);
              console.log("Written HTTP challenge file");
            }
          },
          challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
            if (challengeType === "dns-01") {
              const dnsProvider = await getDNSProvider(domain);
              await dnsProvider.remove(keyAuthorization, domain);
              console.log(`Removed DNS challenge for ${domain.host}`);
            } else {
              const filePath = path.join(challengesPath, challenge.token);
              fs.unlinkSync(filePath);
              console.log("Removed HTTP challenge file");
            }
          },
        });

        fs.mkdirSync(path.join(certsPath, folderName), { recursive: true });
        const jsonData = JSON.stringify({ sans: [domain.host], issuer_data: { url: issuer.url } });
        fs.writeFileSync(certPath, cert);
        fs.writeFileSync(keyPath, key);
        fs.writeFileSync(jsonPath, jsonData);
        fs.writeFileSync(pemPath, `${cert}\n${key}`);
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
