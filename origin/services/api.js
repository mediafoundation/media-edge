const express = require('express')
const { purgeRecord } = require('./varnish')
const cors = require('cors')
const env = require("./../config/env")
const {Signer} = require("media-sdk");
const {DealsController} = require("../controllers/dealsController");
const {PurgeLogsController} = require("../controllers/purgeLogsController");
const {CaddyController} = require("../controllers/caddyController");
const {generateUniqueDealId, recoverOriginalDataFromUniqueDealId} = require("../utils/deals");
const {generateNonce, SiweMessage, SiweErrorType} = require("siwe");
const Session = require("express-session");
const {manageDealCreatedOrAccepted} = require("./events");
const psl = require('psl');
const {ResourcesController} = require("../controllers/resourcesController");
const {generateTXTRecord} = require("../utils/generateSubdomain");

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

const signer = new Signer()

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
  req.session.nonce = generateNonce();
  req.session.save(() => res.status(200).send(req.session.nonce).end());
});

app.post('/me', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({ message: 'Bad Signature' });
  } else {
    res.status(200)
    .json({
        address: req.body.message.address
    })
    .end();
  }
});

async function checkSignature(req){
  try {
    const { signature, message } = req.body;
    const siweMessage = new SiweMessage(message);
    const data = await siweMessage.verify({ signature, nonce: req.session.nonce });
    return data;
  } catch (e) {
    console.log(e)
    return false;
  }
}

app.post('/sign_in', async (req, res) => {
  try {
      const { signature } = req.body;
      if (!req.body.message) {
          res.status(422).json({ message: 'Expected signMessage object as body.' });
          return;
      }

      const message = new SiweMessage(req.body.message);

      const { data: fields} = await message.verify({ signature, nonce: req.session.nonce });

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
              req.session.save(() => res.status(440).json({ message: e.message }));
              break;
          }
          case SiweErrorType.INVALID_SIGNATURE: {
              req.session.save(() => res.status(422).json({ message: e.message }));
              break;
          }
          default: {
              req.session.save(() => res.status(500).json({ message: e.message }));
              break;
          }
      }
  }
});

app.post('/logout', async (req, res) => {
  if (!req.session.siwe) {
      res.status(401).json({ message: 'You have to first sign_in' });
      return;
  }

  req.session.destroy(() => {
      res.status(205).send();
  });
});

// Define the endpoint for your remote function
app.post('/', async (req, res) => {
  const payload = req.body

  if (!await signer.checkSignature({address: payload.address, domain: payload.domain, types: payload.types, primaryType: payload.primaryType, message: payload.message, signature: payload.signature})) {
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

});

app.post('/purge', async (req, res) => {

  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    return res.status(401).json({ message: 'Bad Signature' });
  } else {
    try{
      let owner = await DealsController.getDealOwner(req.body.dealId);
      if(owner === req.body.message.address){

        const paths = req.body.paths ? req.body.paths : ['/*']
        const hostnames = await CaddyController.getHosts(req.body.dealId)

        for(const host of hostnames){
          for(const path of paths){
            await PurgeLogsController.addRecord("http://"+host + path)
          }
        }
        console.log('Purge executed successfully!')
        res.json({ success: 'true' });
      } else {
        res.status(401).send({ message: 'You are not the owner of the deal' });
      }
    } catch (error){
      console.log(error)
      res.status(500).send({message: error});
    }
  }
});


app.get('/getAllDealsEndpoints', async (req, res) => {
  let payload = req.body
  if (!req.session.siwe) {
    res.status(401).json({ message: 'You have to first sign_in' });
  }
  try{
    const endpoints = {}
    for (const dealId of payload.dealIds) {
        endpoints[dealId] = await CaddyController.getHosts(generateUniqueDealId(dealId, payload.chainId))
    }
    res.send(endpoints)
  } catch (error){
    res.status(500).json({message: error});
  }
})

app.post('/getDealEndpoints', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({ message: 'Bad Signature' });
  } else {
    try{
      const endpoints = {}
      let owner = await DealsController.getDealOwner(req.body.dealId);
      console.log("owner",owner)
      if(owner === req.body.message.address){
        endpoints[req.body.dealId] = await CaddyController.getHosts(req.body.dealId)
        res.send(endpoints)
      } else {
        res.status(401).json({ message: 'You are not the owner of the deal' });
      }
    } catch (error){
      res.status(500).json({message: error});
    }
  }

})

app.post('/getDNSConfig', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({ message: 'Bad Signature' });
  } else {
    try{
      let owner = await DealsController.getDealOwner(req.body.dealId);
      if(owner === req.body.message.address){
        if(psl.isValid(req.body.domain)){
          const parsed = psl.parse(req.body.domain);
            let generatedTxt = generateTXTRecord(env.MARKETPLACE_ID, req.body.dealId, req.body.chainId, req.body.domain)
            let deal = await DealsController.getDealResource(req.body.dealId)
            let txtForDomain = await ResourcesController.getDomainTxtRecord(req.body.domain, deal.resourceId, req.body.dealId)
            let txtData;
            if(txtForDomain !== null){
                txtData = {
                    type: 'TXT',
                    name: "_mediafoundation",
                    value: generatedTxt
                }
            }
          if(parsed.subdomain){
            res.json({
                txtOptional: true,
                type: 'CNAME', 
                name: parsed.domain, 
                subdomain: parsed.subdomain, 
                value: env.cname,
                txtRecord: generatedTxt,
                txtData
            });
          } else {
            res.json({
                txtOptional: true,
                type: 'A', 
                name: parsed.domain, 
                value: env.a_record,
                txtRecord: generatedTxt,
                txtData
            });
          }
        } else {
          res.status(400).json({ message: 'Invalid domain' });
        }
      } else {
        res.status(401).json({ message: 'You are not the owner of the deal' });
      }
    } catch (error){
        console.log("Error", error)
      res.status(500).json({message: error});
    }
  }

})

app.post('/syncDeal', async (req, res) => {
    const {dealId} = req.body
    const splitIds = recoverOriginalDataFromUniqueDealId(dealId)
    await manageDealCreatedOrAccepted(splitIds.marketplaceId, splitIds.dealId, splitIds.chainId)
    res.send('Deal synced successfully!')
})

app.get("/ipAddress", async (req, res) => {
  const data = await checkSignature(req)

     if (!data) {
         console.log("Bad Signature")
         res.status(401).json({ message: "Bad Signature" })
     } else {
         res.send({ipAddress: env.ipAddress})
     }

})
// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
