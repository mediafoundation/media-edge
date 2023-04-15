const express = require("express");
const app = express();
const acme = require("acme-client");
const fs = require("fs");
const path = require("path");
const models = require("./models");
const forge = require('node-forge');

const challengesPath = "/var/www/challenges";
const certsPath = "/etc/ssl/caddy";

const privateKeyPath = path.join(__dirname, '/account-private-key.pem');

if (!fs.existsSync(privateKeyPath)) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const privateKey = keys.privateKey;
  const pem = forge.pki.privateKeyToPem(privateKey);

  fs.writeFileSync(privateKeyPath, pem);
} else {
  const pem = fs.readFileSync(privateKeyPath, 'utf8');
  const privateKey = forge.pki.privateKeyFromPem(pem);
}

app.use("/.well-known/acme-challenge", express.static(challengesPath));

async function fetchDomainsFromDatabase() {
  let domains = await models.Caddy.getCaddySources(['host']);
  console.log(domains)
  return domains;
}

async function obtainAndRenewCertificates() {
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.staging,
    accountKey: await acme.crypto.createPrivateKey(),
  });

  const domains = await fetchDomainsFromDatabase();

  for (const domain of domains) {
    try {
      const certPath = path.join(certsPath, `${domain.host}.pem`);
      const keyPath = path.join(certsPath, `${domain.host}-key.pem`);

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const cert = fs.readFileSync(certPath, "utf8");
        const certInfo = await client.getCertificateInfo(cert);

        if (Date.now() + 30 * 24 * 60 * 60 * 1000 > certInfo.notAfter) {
          console.log(`Renewing certificate for ${domain.host}`);
        } else {
          console.log(`Certificate for ${domain.host} is still valid.`);
          continue;
        }
      } else {
        console.log(`Obtaining certificate for ${domain.host}`);
      }
  /* Create CSR */
  const [key, csr] = await acme.crypto.createCsr({
    commonName: String(domain.host),
  });

      const cert = await client.auto({
        csr,
    email: 'test@medianetwork.app',
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
        challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
          const filePath = path.join(
            challengesPath,
            challenge.token
          );
          fs.unlinkSync(filePath);
        },
      });

      fs.writeFileSync(certPath, cert);
      fs.writeFileSync(keyPath, key);
      console.log(`Certificate for ${domain.host} obtained and saved.`);
    } catch (error) {
      console.error(`Failed to obtain certificate for ${domain.host}:`, error);
    }
  }
}

app.listen(7878, () => {
  console.log("Server listening on port 7878");
});

const updateInterval = 60 * 60 * 1000; // Update every 1 hour
setInterval(obtainAndRenewCertificates, updateInterval);

obtainAndRenewCertificates();

