const fs = require('fs');
const http = require('http');
const greenlock = require('greenlock').create({
  packageRoot: __dirname,
  configDir: './greenlock.d',
  maintainerEmail: 'your-email@example.com',
  server: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  store: require('greenlock-store-fs'),
  challenges: {
    'http-01': require('greenlock-challenge-http-01').create({}),
    'dns-01': require('greenlock-challenge-dns-01-cloudns').create({
      apiKey: 'your-api-key',
      apiSecret: 'your-api-secret',
    }),
  },
});

const domains = [
  'example1.com',
  'example2.com',
  'example3.com',
  '*.medianetwork.app',
  '*.otherdomain.com',
];

async function manageCertificates() {
  for (const domain of domains) {
    const certPath = `/path/to/certificates/${domain}`;
    let shouldRenew = true;

    if (fs.existsSync(certPath)) {
      const cert = fs.readFileSync(certPath, 'utf8');
      const certInfo = greenlock.forge.readCertificateInfo(cert);
      const expiresIn = certInfo.notAfter - new Date();

      shouldRenew = expiresIn < 30 * 24 * 60 * 60 * 1000;
    }

    if (shouldRenew) {
      try {
        const certData = await greenlock.certificates.get({ subject: domain });

        if (!certData || (certData && new Date(certData.expiresAt) < new Date())) {
          const challengeType = domain.startsWith('*.') ? 'dns-01' : 'http-01';
          await greenlock.certificates.set({
            subject: domain,
            altnames: [domain],
            challenges: { 'preferred': [challengeType] },
          });
        }
      } catch (error) {
        console.error(`Failed to renew certificate for ${domain}`, error);
      }
    }
  }
}

// Run the manageCertificates function periodically
manageCertificates();
setInterval(manageCertificates, 24 * 60 * 60 * 1000); // Check for certificate renewal every 24 hours

// HTTP server to serve the /.well-known/acme-challenge files
const server = http.createServer(greenlock.middleware());

server.listen(7878, () => {
  console.log('HTTP server listening on port 80');
});
