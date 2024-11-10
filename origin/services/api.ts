//@ts-nocheck
import express from "express";
//const {purgeRecord} = require('./varnish')
import cors from "cors";

import {env} from "../config/env";
//const {Signer} = require("media-sdk");
import {DealsController} from "../controllers/dealsController";

import {PurgeLogsController} from "../controllers/purgeLogsController";

import {CaddyController} from "../controllers/caddyController";

import {generateUniqueItemId, recoverOriginalDataFromUniqueDealId} from "../utils/deals";

import {generateNonce, SiweErrorType, SiweMessage} from "siwe";

import Session from "express-session";

import {manageAddedBalance, manageCancelledDeal, manageDealCreatedOrAccepted, manageResourceUpdated} from "./events";

import psl from "psl";
//const {ResourcesController} = require("../controllers/resourcesController");
import {generateTXTRecord} from "../utils/generateSubdomain";

import {getHostName} from "../utils/domains";

import {CaddySource} from "../models/caddy";

//const {where, Op} = require("sequelize");
import {createRelationsBetweenTables} from "../utils/resetDB";
import {providerState} from "../models/providerState"


/* const helmet = require('helmet'); */


const app = express()

/* app.use(
  helmet({
      contentSecurityPolicy: false,
  }),
); */

app.use(cors({
  origin: '*',
  credentials: true,
}))

const port = 8080; // Change this to your desired port number
//const networks = require("./../config/networks")

//const signer = new Signer()

app.use(express.json())

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

app.use(Session({
  name: 'siwe-quickstarts',
  secret: "siwe-quickstart-secrets",
  resave: true,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: true
  }
}));

app.get('/nonce', async (req, res) => {
  // @ts-ignore
  req.session.nonce = generateNonce();
  // @ts-ignore
  req.session.save(() => res.status(200).send(req.session.nonce).end());
});

app.post('/me', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({message: 'Bad Signature'});
  } else {
    res.status(200)
      .json({
        address: req.body.message.address
      })
      .end();
  }
});

async function checkSignature(req) {
  try {
    const {signature, message} = req.body;
    const siweMessage = new SiweMessage(message);
    return await siweMessage.verify({signature, nonce: req.session.nonce});
  } catch (e) {
    console.log(e)
    return false;
  }
}

app.post('/sign_in', async (req, res) => {
  try {
    const {signature} = req.body;
    if (!req.body.message) {
      res.status(422).json({message: 'Expected signMessage object as body.'});
      return;
    }

    const message = new SiweMessage(req.body.message);

    const {data: fields} = await message.verify({signature, nonce: req.session.nonce});

    req.session.siwe = fields;
    req.session.nonce = null;
    req.session.cookie.expires = new Date(fields.expirationTime);
    req.session.save(() =>
      res
        .status(200)
        .json({
          address: req.session.siwe.address
        })
        .end(),
    );
  } catch (e) {
    req.session.siwe = null;
    req.session.nonce = null;
    console.error(e);
    switch (e) {
      case SiweErrorType.EXPIRED_MESSAGE: {
        req.session.save(() => res.status(440).json({message: e.message}));
        break;
      }
      case SiweErrorType.INVALID_SIGNATURE: {
        req.session.save(() => res.status(422).json({message: e.message}));
        break;
      }
      default: {
        req.session.save(() => res.status(500).json({message: e.message}));
        break;
      }
    }
  }
});

app.post('/logout', async (req, res) => {
  if (!req.session.siwe) {
    res.status(401).json({message: 'You have to first sign_in'});
    return;
  }

  req.session.destroy(() => {
    res.status(205).send();
  });
});

// Define the endpoint for your remote function
/*app.post('/', async (req, res) => {
  const payload = req.body

  if (!await signer.checkSignature({
    address: payload.address,
    domain: payload.domain,
    types: payload.types,
    primaryType: payload.primaryType,
    message: payload.message,
    signature: payload.signature
  })) {
    return res.status(403).send(`Bad Signature`)
  }

  let responsesSucceed = []
  let responseFailed = []

  for (const dealId of payload.deals) {
    try {
      //let network = networks.find((network) => network.chain_id === payload.chainId)
      const deal = await DealsController.getDealById(payload.dealId)

      //check if address is owner of deal
      if (deal.client === payload.address) {
        //todo: check how the arguments comes from the request

        switch (payload.action) {
          case 'PURGE':
            payload.params.paths.forEach(async (path) => {
              await purgeRecord(deal, path)
            });

            //res.status(200).send('Remote function executed successfully!')
            responsesSucceed.push(dealId)
        }
      } else {
        //res.status(403).send(`Not owner`)
        responseFailed.push(dealId)
      }
    } catch (e) {
      console.log(e)
      //res.status(500).send(`Error performing action ${e}`)
      responseFailed.push(dealId)
    }
  }

  let _res = {}
  responsesSucceed && (_res["Succeed"] = responsesSucceed)
  responseFailed && (_res["Failed"] = responseFailed)
  res.status(200).send(_res)

});*/

app.post('/purge', async (req, res) => {

  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    return res.status(401).json({message: 'Bad Signature'});
  } else {
    try {
      let owner = await DealsController.getDealOwner(req.body.dealId);
      if (owner === req.body.message.address) {

        const paths = req.body.paths ? req.body.paths : ['/*']
        const hostnames = await CaddyController.getHosts(req.body.dealId)

        for (const host of hostnames) {
          for (const path of paths) {
            await PurgeLogsController.addRecord("http://" + host + path)
          }
        }
        console.log('Purge executed successfully!')
        res.json({success: 'true'});
      } else {
        res.status(401).send({message: 'You are not the owner of the deal'});
      }
    } catch (error) {
      console.log(error)
      res.status(500).send({message: error});
    }
  }
});


app.get('/getAllDealsEndpoints', async (req, res) => {
  let payload = req.body
  if (!req.session.siwe) {
    res.status(401).json({message: 'You have to first sign_in'});
  }
  try {
    const endpoints = {}
    for (const dealId of payload.dealIds) {
      endpoints[dealId] = await CaddyController.getHosts(generateUniqueItemId(dealId, payload.chainId))
    }
    res.send(endpoints)
  } catch (error) {
    res.status(500).json({message: error});
  }
})

app.post('/getDealEndpoints', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({message: 'Bad Signature'});
  } else {
    try {
      const endpoints = {}
      let owner = await DealsController.getDealOwner(req.body.dealId);
      console.log("owner", owner)
      if (owner === req.body.message.address) {
        endpoints[req.body.dealId] = await CaddyController.getHosts(req.body.dealId)
        res.send(endpoints)
      } else {
        res.status(401).json({message: 'You are not the owner of the deal'});
      }
    } catch (error) {
      res.status(500).json({message: error});
    }
  }

})

app.post('/getDNSConfig', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({message: 'Bad Signature'});
  } else {
    try {
      let owner = await DealsController.getDealOwner(req.body.dealId);
      const provider = await DealsController.getDealProvider(req.body.dealId);
      if (owner === req.body.message.address) {
        if (psl.isValid(req.body.domain)) {
          const parsed = psl.parse(req.body.domain);

          console.log("Owner", owner)
          console.log("Domain", getHostName(req.body.domain))

          const privateKey = providerState[provider].privateKey

          console.log(privateKey)

          let generatedTxt = generateTXTRecord(owner, getHostName(req.body.domain), privateKey)

          let txtValid = await CaddyController.checkTxtRecord(
            getHostName(req.body.domain),
            generatedTxt
          )

          let domain = await CaddySource.findOne({
            where: {
              host: req.body.domain
            }
          })
          let warning = false;
          let patchedDomain = !!domain
          try {
            if (txtValid && domain && domain.deal_id !== req.body.dealId) {
              warning = true
            }
          } catch (e) {
            console.log(e)
          }
          let txtData = {
            type: 'TXT',
            name: "_medianetwork",
            value: generatedTxt,
            txtValid
          };
          if (parsed.subdomain) {
            res.json({
              type: 'CNAME',
              name: parsed.domain,
              subdomain: parsed.subdomain,
              value: env.cname,
              txtData,
              warning,
              patchedDomain
            });
          } else {
            res.json({
              type: 'A',
              name: parsed.domain,
              value: env.a_record,
              txtData,
              warning,
              patchedDomain
            });
          }
        } else {
          res.status(400).json({message: 'Invalid domain'});
        }
      } else {
        res.status(401).json({message: 'You are not the owner of the deal'});
      }
    } catch (error) {
      console.log("Error", error)
      res.status(500).json({message: error});
    }
  }

})

app.post('/syncDeal', async (req, res) => {
  const {dealId} = req.body
  const splitIds = recoverOriginalDataFromUniqueDealId(dealId)
  await manageDealCreatedOrAccepted(splitIds.dealId, splitIds.chainId)
  res.send('Deal synced successfully!')
})

app.get("/ipAddress", async (req, res) => {
  const data = await checkSignature(req)

  if (!data) {
    console.log("Bad Signature")
    res.status(401).json({message: "Bad Signature"})
  } else {
    res.send({ipAddress: env.ipAddress})
  }

})

/*
Following params for network should be and object on the following form:
{
    id: 1
  chain_id: 1,
  network_id: 1
}
 */
app.post("/dealCreated", async (req, res) => {
  const {dealId, network} = req.body
  try {
    await manageDealCreatedOrAccepted(BigInt(dealId), network)
    res.send('Deal synced successfully!')
  } catch (e) {
    console.log(e)
    res.status(500).send('Error syncing deal')
  }

})

app.post("/resourceUpdated", async (req, res) => {
  const {resourceId, network} = req.body
  try {
    await manageResourceUpdated(resourceId, network)
    res.send('Resource updated successfully!')
  } catch (e) {
    console.log(e)
    res.status(500).send('Error updating resources')
  }
})

app.post("/dealCancelled", async (req, res) => {
  const {dealId, network} = req.body
  try {
    await manageCancelledDeal(dealId, network)
    res.send('Deal cancelled successfully!')
  } catch (e) {
    console.log(e)
    res.status(500).send('Error cancelling deal')
  }
})

app.post("/addedBalance", async (req, res) => {
  const {dealId, network} = req.body
  try {
    await manageAddedBalance(dealId, network.id)
    res.send('Balance added successfully!')
  } catch (e) {
    console.log(e)
    res.status(500).send('Error adding balance')
  }
})
// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
createRelationsBetweenTables().then(_ => console.log("Relations created"))
