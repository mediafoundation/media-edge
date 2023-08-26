const fs = require('fs').promises;
const axios = require('axios');

const fileName = '/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/varnish_queue.json';
let lastReadId = 0;

// Function to purge a record using Axios
async function purgeRecord(record) {
  //console.log("Data first run", processedURLsFirstRun)
  try {

    let _url = new URL(record.url);
    let headers = { 'host': _url.host }
    if(_url.pathname.includes("*")){
      headers['X-Purge-Method'] = 'regex'
    }
    let response = await axios.request({
      method: 'PURGE',
      url: "http://127.0.0.1:80"+_url.pathname,
      headers
    });

   //console.log("Response status", response)

    if (response.status === 200) {
      console.log(`Successfully purged Varnish record for ${record.url}`);
    } else {
      console.error(`Failed to purge Varnish record for ${record.url}`);
    }
  } catch (error) {
    if (error.response.status === 503) {
      console.log(`Successfully purged Varnish record for ${record.url}`);
    } else {
      console.error(`Failed to purge Varnish record for ${record.url}`);
    }
    //console.error('Error purging Varnish record:', error.response);
  }
}

// Function to read the file and process records
async function processRecords() {
  let processedURLs = [];
  try {
    const data = await fs.readFile(fileName, 'utf-8');

    const records = data.split('\n');
/*     console.log(`------------------------`);
    console.log(`${records.length} purge requests found in file`);
    console.log(`Last proccesed purge id ${lastReadId}`); */

    for (const _record of records){
      try {
        const record = JSON.parse(_record);
        //if (lastReadId < (record.id - 1)) {
          // If last read ID is less than the first record ID minus one,
          // purge all varnish (purge everything)
          //await purgeRecord(record);
          //lastReadId = parseInt(records[0].id) - 1;
        //}
        if (record.id > lastReadId) {
          if (processedURLs.includes(record.url)) {
            console.log(`Skipping #${record.id} - ${record.url}, it was already proccessed.`)
          } else {
            console.log(`Purging #${record.id} - ${record.url}`)
            await purgeRecord(record);
            processedURLs.push(record.url);
          }
          lastReadId = record.id;
        } 
      } catch(_){/* Invalid JSON */}
    }
  } catch(e){
      console.log("Couldnt read file", e)
  }
}

processRecords()

setInterval(() => {
  processRecords();
}, 30000)
