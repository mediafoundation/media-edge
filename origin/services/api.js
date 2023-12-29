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

const signer = new Signer()

app.use(express.json())

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
  try{
    const endpoints = {}
    for (const dealId of payload.dealIds) {
        endpoints[dealId] = await CaddyController.getHosts(dealId)
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
