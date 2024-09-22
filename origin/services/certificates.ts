//Certificate manager
import express, { Request, Response } from "express";
const app = express();
import { obtainAndRenewCertificates, challengesPath } from "../utils/certs";
import { CaddyController } from "../controllers/caddyController";

const getDomains = async (req: Request, res: Response): Promise<void> => {
  try {
    let domain = false;
    //add protocol to validate URL object if missing (should be missing always)
    let protocol = (/^https?:\/\//).test(req.query.domain as string) ? "" : "http://";
    let url = new URL(protocol + (req.query.domain as string));
    domain = await CaddyController.checkDomain(url.hostname);
    res.sendStatus(domain ? 200 : 404);
  } catch (_) {
    console.log("Invalid domain requested", req.query.domain);
    res.sendStatus(404);
  }
};

app.use("/.well-known/acme-challenge", express.static(challengesPath));
app.use('/domains', getDomains);

app.listen(7878, () => {
  console.log("Server listening on port 7878");
});

const checkCerts = async (): Promise<void> => {
  let domains: any = await CaddyController.getCaddySources(['host']);
  await obtainAndRenewCertificates(domains);
};

setInterval(async () => checkCerts(), 60 * 60 * 1000); // Update every 1 hour