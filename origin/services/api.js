const express = require('express')
const { purgeRecord } = require('./varnish')
const { verifySignature } = require('../utils/signatures')
const app = express()
const port = 3000; // Change this to your desired port number

app.use(express.json())

// Define the endpoint for your remote function
app.post('/api', async (req, res) => {
  const payload = req.body
  try{
    const deal = await Deals.findByPk(parseInt(payload.dealId, {raw: true}))
    //check if address is owner of deal
    if(deal.client == payload.address){
      //todo: check how the arguments comes from the request
      if(verifySignature(payload)){
        switch(payload.action){
          case 'PURGE':
            await purgeRecord(payload.dealId, payload.params.paths)
        }
        res.send('Remote function executed successfully!')
      } else {
        res.send(`Bad signature`, 403)
      }
    } else {
      res.send(`Not owner`, 403)
    }
  } catch(e){
    res.send(`Error performing action ${e}`, 500)
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
