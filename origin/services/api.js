const express = require('express')
const { purgeRecord } = require('./varnish')
const { verifySignature } = require('../utils/signatures')
const cors = require('cors')
const app = express()
app.use(cors())
const port = 8080; // Change this to your desired port number
const models = require("../models")
const networks = require("./../config/networks")
const env = require("./../config/env")
const Marketplace = require("./../../media-evm-abis/Marketplace.json")

app.use(express.json())

// Define the endpoint for your remote function
app.post('/', async (req, res) => {
  const payload = req.body
  console.log(payload)
  
  for (const dealId of payload.deals) {
    try {
      let network = networks.find((network) => network.chain_id === payload.chainId)
      const deal = await models.Deals.getDealById(`${dealId}_${network.network_id}_${network.chain_id}_${env.MARKETPLACE_ID}`)

      //check if address is owner of deal
      if (deal.client === payload.address) {
        //todo: check how the arguments comes from the request
        if (verifySignature(payload, Marketplace.networks[payload.chainId].address)) {
          switch (payload.action) {
            case 'PURGE':
              payload.params.paths.forEach(async path => {
                await purgeRecord(deal, path)
              });
          }
          res.send('Remote function executed successfully!')
        } else {
          res.send(`Bad signature`, 403)
        }
      } else {
        res.send(`Not owner`, 403)
      }
    } catch (e) {
      console.log(e)
      res.send(`Error performing action ${e}`, 500)
    }
  }

});

app.get('/api/getAllDealsEndpoints', async (req, res) => {
  let payload = req.query
  try{
    const endpoints = {}
    for (const dealId of payload.dealIds) {
        endpoints[dealId] = await models.Caddy.getHosts(dealId)
    }
    res.send(endpoints)
  } catch (e){
    res.send(e)
  }
})

app.get('/api/getDealsEndpoints', async (req, res) => {
  let payload = req.body
  try{
    const endpoints = {}
    endpoints[payload.dealId] = await models.Caddy.getHosts(payload.dealId)
    res.send(endpoints)
  } catch (e){
    res.send(e)
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
