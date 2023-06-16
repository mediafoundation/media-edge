const express = require("express");
const app = express();
const acme = require("acme-client");
const fs = require("fs");
const path = require("path");
const models = require("./models");
const crypto = require('crypto');
const fetch = require('node-fetch');
const querystring = require('querystring');
const { obtainAndRenewCertificates } = require("./utils/certs");

const getDomains = async(req, res) => {
  try {
    let domain = false
    //add protocol to validate URL object if missing (should be missing always)
    let protocol = (/^https?:\/\//).test(req.query.domain) ? "" : "http://";
    let url = new URL(protocol+req.query.domain)
    //check if its a subdomain
    if((/[\w]+\.[\w]+\.[\w]+$/).test(url.hostname)){
      domain = await models.Caddy.checkDomain(url.hostname)
    } else {
      console.log("Domain is not a subdomain", req.query.domain)
    }
    return res.sendStatus(domain ? 200 : 404)
  } catch(_){
    console.log("Invalid domain requested", req.query.domain)
    return res.sendStatus(404)
  }
}


setInterval(obtainAndRenewCertificates, 60 * 60 * 1000); // Update every 1 hour

obtainAndRenewCertificates()

app.use("/.well-known/acme-challenge", express.static(challengesPath));
app.use('/domains', getDomains)

app.listen(7878, () => {
  console.log("Server listening on port 7878");
});
