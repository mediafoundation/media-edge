const express = require('express');
const { purgeRecord } = require('./services/varnish');
const { verifySignature } = require('./services/signatures');
const app = express();
const port = 3000; // Change this to your desired port number

// Define the endpoint for your remote function
app.put('/purge', async (req, res) => {

  let dealId = req.query.dealId
  let path = req.query.path


  //todo: check how the arguments comes from the request
  if(verifySignature()){
    try{
      await purgeRecord(dealId, path)
  
      res.send('Remote function executed successfully!');
    }catch(e){
      res.send(`Error performing purge ${e}`, 500)
    }
  }

  

  
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
