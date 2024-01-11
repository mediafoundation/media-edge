const express = require('express')
const { purgeRecord } = require('./varnish')
const cors = require('cors')
const env = require("./../config/env")
const {Signer} = require("media-sdk");
const {DealsController} = require("../controllers/dealsController");
const {PurgeLogsController} = require("../controllers/purgeLogsController");
const {CaddyController} = require("../controllers/caddyController");
const {generateUniqueDealId} = require("../utils/deals");
const {generateNonce, SiweMessage, SiweErrorType} = require("siwe");
const Session = require("express-session");

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
    return;
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
  if (!req.session.siwe) {
    res.status(401).json({ message: 'You have to first sign_in' });
    return;
  }
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

app.post('/getDealEndpoints', async (req, res) => {
  const data = await checkSignature(req);

  if (!data) {
    console.log('Bad Signature')
    res.status(401).json({ message: 'Bad Signature' });
    return;
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
    } catch (e){
      res.status(500).json({ message: 'Unknown error: '+ e });
    }
  }

})


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
