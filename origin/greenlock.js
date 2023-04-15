const express = require("express");
const Greenlock = require("greenlock");
const fs = require("fs");
const path = require("path");
const models = require("./models");

const challengesPath = "/var/www/challenges";
const certsPath = "/etc/ssl/caddy";

let greenlock;

async function fetchDomainsFromDatabase() {
  // Replace this with your actual implementation to fetch the domains
  let domains = models.Caddy.getCaddySources(['host']);
  return domains;
}

async function updateDomains() {
  const currentDomains = greenlock.manager.get(null, "all").map((cert) => cert.subject);
  const newDomains = await fetchDomainsFromDatabase();

  const domainsToAdd = newDomains.filter((domain) => !currentDomains.includes(domain));
  const domainsToRemove = currentDomains.filter((domain) => !newDomains.includes(domain));

  for (const domain of domainsToAdd) {
    greenlock.add({ subject: domain, altnames: [domain] });
  }

  for (const domain of domainsToRemove) {
    greenlock.remove({ subject: domain });
  }
}

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

async function initGreenlock() {
  const domains = await fetchDomainsFromDatabase();
  greenlock = Greenlock.create({
    packageRoot: __dirname,
    configDir: certsPath,
    maintainerEmail: "your-email@example.com",
    packageAgent: "your-application-name",
    challenges: {
      "http-01": {
        module: "acme-http-01-webroot",
        webrootPath: challengesPath,
      },
    },
    store: {
      module: "greenlock-store-fs",
      basePath: certsPath,
    },
  });

  // Serve ACME challenge files from the shared filesystem
  greenlock.app.use("/.well-known/acme-challenge", express.static(challengesPath));

  for (const domain of domains) {
    greenlock.add({ subject: domain, altnames: [domain] });
  }

  greenlock.serveApp(function() {
    console.log("Greenlock Server listening on port 80 and 443");
  });
}

//Init the greenlock instance
initGreenlock();

//Update greenlock with new domains every hour
const updateInterval = 60 * 60 * 1000; // Update every 1 hour
setInterval(updateDomains, updateInterval);

//Clean up old http-01 challenges every day
const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
setInterval(cleanUpChallenges, cleanupInterval);
