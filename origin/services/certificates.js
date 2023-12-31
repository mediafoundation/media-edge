//Certificate manager
const express = require("express");
const app = express();
const { obtainAndRenewCertificates, challengesPath } = require("../utils/certs");
const {CaddyController} = require("../controllers/caddyController");

const getDomains = async(req, res) => {
  try {
    let domain = false
    //add protocol to validate URL object if missing (should be missing always)
    let protocol = (/^https?:\/\//).test(req.query.domain) ? "" : "http://";
    let url = new URL(protocol+req.query.domain)
    domain = await CaddyController.checkDomain(url.hostname)
    return res.sendStatus(domain ? 200 : 404)
  } catch(_){
    console.log("Invalid domain requested", req.query.domain)
    return res.sendStatus(404)
  }
}

app.use("/.well-known/acme-challenge", express.static(challengesPath));
app.use('/domains', getDomains)

app.listen(7878, () => {
  console.log("Server listening on port 7878");
});

async function checkCerts(){
    let domains = await CaddyController.getCaddySources(['host']);
    await obtainAndRenewCertificates(domains);
}

setInterval(async() => checkCerts(), 60 * 60 * 1000); // Update every 1 hour