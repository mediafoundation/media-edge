const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const models = require("./models");

const challengesPath = "/var/www/challenges";
const certsPath = "/etc/ssl/caddy";
app.use("/.well-known/acme-challenge", express.static(challengesPath));

const Greenlock = require("greenlock");
let greenlock;

async function fetchDomainsFromDatabase() {
  let domains = models.Caddy.getCaddySources(["host"]);
  return domains;
}

async function updateDomains() {
  const currentDomains = await greenlock.manager.get(null, "all");
  const newDomains = await fetchDomainsFromDatabase();

  const domainsToAdd = newDomains.filter(
    (domain) => !currentDomains.includes(domain)
  );
  const domainsToRemove = currentDomains.filter(
    (domain) => !newDomains.includes(domain)
  );

  for (const domain of domainsToAdd) {
    greenlock.add({ subject: domain, altnames: [domain] });
  }

  for (const domain of domainsToRemove) {
    greenlock.remove({ subject: domain });
  }
}

async function initGreenlock() {
  const domains = await fetchDomainsFromDatabase();
  greenlock = Greenlock.create({
    packageRoot: __dirname,
    configDir: certsPath,
    packageAgent: "your-application-name",
    maintainerEmail: "your-email@example.com",
    staging: true,
    manager: {
      module: "greenlock-manager-test",
      basePath: certsPath,
      memory: {
        live: true,
        staging: true,
      },
    },
    store: require("le-store-fs").create({
      configDir: certsPath,
    }),
    challenges: {
      "http-01": require("le-challenge-fs").create({
        webrootPath: challengesPath,
      }),
    },
  });

  greenlock.manager.defaults({
    agreeToTerms: true,
    subscriberEmail: "webhosting@example.com",
  });

  for (const domain of domains) {
    greenlock.add({ subject: domain, altnames: [domain] });
  }

  app.listen(7878, () => {
    console.log("Greenlock Server listening on port 7878");
  });
}


initGreenlock();

const updateInterval = 60 * 60 * 1000; // Update every 1 hour
setInterval(updateDomains, updateInterval);




function cleanUpChallenges() {
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  fs.readdir(challengesPath, (err, files) => {
    if (err) {
      console.error("Error reading challenge directory:", err);
      return;
    }

    const currentTime = Date.now();
    files.forEach((file) => {
      const filePath = path.join(challengesPath, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error("Error reading file stats:", err);
          return;
        }

        if (currentTime - stats.mtime > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error("Error deleting file:", err);
            } else {
              console.log("Deleted file:", filePath);
            }
          });
        }
      });
    });
  });
}

//Clean up old http-01 challenges every day
const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
setInterval(cleanUpChallenges, cleanupInterval);