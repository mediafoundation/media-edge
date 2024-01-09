const express = require('express')
const { purgeRecord } = require('./varnish')
const cors = require('cors')
const app = express()
app.use(cors())
const port = 8080; // Change this to your desired port number
const networks = require("./../config/networks")
const env = require("./../config/env")
const {Signer} = require("media-sdk");
const {DealsController} = require("../controllers/dealsController");
const {PurgeLogsController} = require("../controllers/purgeLogsController");
const {CaddyController} = require("../controllers/caddyController");
const {generateUniqueDealId} = require("../utils/deals");
const {generateNonce, SiweMessage} = require("siwe");
const Session = require("express-session");

const signer = new Signer()

app.use(express.json())

app.use(Session({
  name: 'siwe-quickstart',
  secret: "siwe-quickstart-secret",
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false, sameSite: false }
}));

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
      let network = networks.find((network) => network.chain_id === payload.chainId)
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

app.get('/purge', async (req, res) => {
  const password = req.query.password
  const host = req.query.host
  const path = req.query.path ? req.query.path : '/*'
  if (password === env.PURGE_PASSWORD) {
    try {
      await PurgeLogsController.addRecord("http://"+host + path)
      res.send('Purge executed successfully!')
    } catch (e) {
      console.log(e)
      res.send(`Error performing purge ${e}`, 500)
    }
  } else {
    res.send(`Bad password`, 403)
  }
});


app.get('/getAllDealsEndpoints', async (req, res) => {
  let payload = req.body
  let signer = new Signer()
  await signer.checkTypedSignature({
    address: payload.address,
    domain: payload.domain,
    types: payload.types,
    primaryType: payload.primaryType,
    message: payload.message,
    signature: payload.signature
  })
  try{
    const endpoints = {}
    for (const dealId of payload.dealIds) {
        endpoints[dealId] = await CaddyController.getHosts(generateUniqueDealId(dealId, payload.chainId))
    }
    res.send(endpoints)
  } catch (e){
    res.send(e)
  }
})

app.post('/getDealsEndpoints', async (req, res) => {
  let payload = req.body
  try{
    const endpoints = {}
    endpoints[payload.dealId] = await CaddyController.getHosts(payload.dealId)
    res.send(endpoints)
  } catch (e){
    res.send(e)
  }
})

app.get('/nonce', function (_, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.send(generateNonce());
});

app.post('/verify', async function (req, res) {
  try {
    if (!req.body.message) {
      res.status(422).json({ message: 'Expected prepareMessage object as body.' });
      return;
    }

    let SIWEObject = new SiweMessage(req.body.message);
    const { data: message } = await SIWEObject.verify({ signature: req.body.signature, nonce: req.session.nonce });

    req.session.siwe = message;
    req.session.cookie.expires = new Date(message.expirationTime);
    req.session.save(() => res.status(200).send(true));
  } catch (e) {
    req.session.siwe = null;
    req.session.nonce = null;
    console.error(e);
    switch (e) {
      case ErrorTypes.EXPIRED_MESSAGE: {
        req.session.save(() => res.status(440).json({ message: e.message }));
        break;
      }
      case ErrorTypes.INVALID_SIGNATURE: {
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


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
