const challengesPath = "/var/www/challenges";
const certsPath = "/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory";

async function fetchDomainsFromDatabase() {
  let domains = await models.Caddy.getCaddySources(['host']);
  console.log(domains)
  return domains;
}

function checkCertificateValidity(certificatePath, host) {
  try {
    // Read the certificate file
    const certData = fs.readFileSync(certificatePath, 'utf-8');
    // Create a certificate object
    const cert = new crypto.X509Certificate(certData);
    // Get the current date
    const currentDate = new Date();

    // Check the certificate's validity period
    // Check if the certificate is one week away from expiring
    const oneWeekAway = new Date();
    oneWeekAway.setDate(oneWeekAway.getDate() + 7);
    if (currentDate >= new Date(cert.validFrom) && new Date(cert.validTo) <= oneWeekAway) {
      console.log('The SSL certificate is less than one week away from expiring. Time to issue a new certificate.');
      return false;
    } else if(currentDate >= new Date(cert.validFrom) && currentDate <= new Date(cert.validTo)) {
      console.log(`The SSL certificate for ${host} is valid.`);
      return true;
    } else {
      console.log(`The SSL certificate for ${host} has expired or is not yet valid. Current date: ${currentDate} - Certificate Valid from ${cert.validFrom} to ${cert.validTo}`);
      return false;
    }
  } catch (error) {
    console.error(`Error while checking ${host}'s SSL certificate:`, error.message);
    return false;
  }
}

async function generateEABCredentials(email, apiKey) {
  const zerosslAPIBase = 'https://api.zerossl.com/acme';
  const endpoint  = apiKey
                  ? `${zerosslAPIBase}/eab-credentials?${querystring.stringify({ access_key: apiKey })}`
                  : `${zerosslAPIBase}/eab-credentials-email`;
  const headers = {
    'User-Agent': 'CertMagic'
  };

  if (!apiKey) {
    if (!email) {
      console.warn('Missing email address for ZeroSSL; it is strongly recommended to set one for next time');
      email = 'caddy@zerossl.com';
    }
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const requestOptions = {
    method: 'POST',
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

async function obtainAndRenewCertificates() {

  const issuers = [
    { name: 'Let\'s Encrypt', url: acme.directory.letsencrypt.production },
    { name: 'ZeroSSL', url: 'https://acme.zerossl.com/v2/DV90' },
    { name: 'Buypass Go SSL', url: 'https://api.buypass.com/acme/directory' },
    // Add more ACME endpoints as needed...
  ];
  const domains = await fetchDomainsFromDatabase();

  for (const domain of domains) {
    try {
      const certPath = path.join(certsPath, `${domain.host}`, `${domain.host}.crt`);
      const keyPath = path.join(certsPath, `${domain.host}`, `${domain.host}.key`);
      const jsonPath = path.join(certsPath, `${domain.host}`, `${domain.host}.json`);

      if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(jsonPath)) {
        const validCert = checkCertificateValidity(certPath, domain.host);
        if (!validCert) {
          console.log(`Renewing certificate for ${domain.host}`);
        } else {
          continue;
        }
      }

      for (const issuer of issuers) {
        try {
          console.log(`Obtaining certificate for ${domain.host} from ${issuer.name} / ${issuer.url}`);
          const client = new acme.Client({
            directoryUrl: issuer.url,
            accountKey: await acme.crypto.createPrivateKey(),
            externalAccountBinding: issuer.name === 'ZeroSSL' ? await generateEABCredentials() : undefined,
          });
          const [key, csr] = await acme.crypto.createCsr({
            commonName: String(domain.host),
          });
          const cert = await client.auto({
            csr,
            email: 'caddy@zerossl.com',
            termsOfServiceAgreed: true,
            challengePriority: ["http-01"],
            challengeCreateFn: async (authz, challenge, keyAuthorization) => {
              const filePath = path.join(
                challengesPath,
                challenge.token
              );
              fs.writeFileSync(filePath, keyAuthorization);
              console.log("Written challenge")
            },
            challengeRemoveFn: async (authz, challenge) => {
              const filePath = path.join(
                challengesPath,
                challenge.token
              );
              fs.unlinkSync(filePath);
            },
          });
          // Certificate obtained successfully!
          if (!fs.existsSync(path.join(certsPath, `${domain.host}`))){
              fs.mkdirSync(path.join(certsPath, `${domain.host}`), { recursive: true });
          }
          const json = `{"sans": ["${domain.host}"],"issuer_data": {"url": "https://media.network/"}}`;
          fs.writeFileSync(certPath, cert);
          fs.writeFileSync(keyPath, key);
          fs.writeFileSync(jsonPath, json);
          console.log(`Certificate for ${domain.host} obtained and saved.`);
          break;
        } catch (error) {
          console.error(`Failed to obtain certificate from ${issuer.name}:`, error);
          // Try the next ACME endpoint...
        }
      }
    } catch (error) {
      console.error(`Failed to obtain certificate for ${domain.host}:`, error);
    }
  }
}

async function obtainAndRenewCertificate(domain) {
    try {
        const certPath = path.join(certsPath, `${domain.host}`, `${domain.host}.crt`);
        const keyPath = path.join(certsPath, `${domain.host}`, `${domain.host}.key`);
        const jsonPath = path.join(certsPath, `${domain.host}`, `${domain.host}.json`);
  
        if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(jsonPath)) {
          const validCert = checkCertificateValidity(certPath, domain.host);
          if (!validCert) {
            console.log(`Renewing certificate for ${domain.host}`);
          }
        }
  
        for (const issuer of issuers) {
          try {
            console.log(`Obtaining certificate for ${domain.host} from ${issuer.name} / ${issuer.url}`);
            const client = new acme.Client({
              directoryUrl: issuer.url,
              accountKey: await acme.crypto.createPrivateKey(),
              externalAccountBinding: issuer.name === 'ZeroSSL' ? await generateEABCredentials() : undefined,
            });
            const [key, csr] = await acme.crypto.createCsr({
              commonName: String(domain.host),
            });
            const cert = await client.auto({
              csr,
              email: 'caddy@zerossl.com',
              termsOfServiceAgreed: true,
              challengePriority: ["http-01"],
              challengeCreateFn: async (authz, challenge, keyAuthorization) => {
                const filePath = path.join(
                  challengesPath,
                  challenge.token
                );
                fs.writeFileSync(filePath, keyAuthorization);
                console.log("Written challenge")
              },
              challengeRemoveFn: async (authz, challenge) => {
                const filePath = path.join(
                  challengesPath,
                  challenge.token
                );
                fs.unlinkSync(filePath);
              },
            });
            // Certificate obtained successfully!
            if (!fs.existsSync(path.join(certsPath, `${domain.host}`))){
                fs.mkdirSync(path.join(certsPath, `${domain.host}`), { recursive: true });
            }
            const json = `{"sans": ["${domain.host}"],"issuer_data": {"url": "https://media.network/"}}`;
            fs.writeFileSync(certPath, cert);
            fs.writeFileSync(keyPath, key);
            fs.writeFileSync(jsonPath, json);
            console.log(`Certificate for ${domain.host} obtained and saved.`);
            break;
          } catch (error) {
            console.error(`Failed to obtain certificate from ${issuer.name}:`, error);
            // Try the next ACME endpoint...
          }
        }
      } catch (error) {
        console.error(`Failed to obtain certificate for ${domain.host}:`, error);
      }
}

module.exports = {obtainAndRenewCertificates, obtainAndRenewCertificate}