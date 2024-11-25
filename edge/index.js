const fs = require('fs').promises;
const axios = require('axios');
const chokidar = require('chokidar');
const async = require('async');

const fileName = '/usr/src/app/certs/varnish_queue.json';
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
async function processRecords(callback) {
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
    callback(); // finished processing this task
  } catch(e){
    console.log("Couldnt read file", e)
    callback(e); // forward the error to the queue
  }
}

// Create a queue with a single worker to ensure tasks (processRecords) are executed one at a time.
const q = async.queue((task, callback) => {
  processRecords(callback);
}, 1);

// If there are any errors, handle them here
q.error((err) => {
  console.error('Error processing a task:', err);
});

processRecords(() => {});

const watcher = chokidar.watch(fileName, {
  persistent: true,
  usePolling: true, // especially useful on network file systems
  interval: 1000    // poll every second (adjust if needed)
});

watcher.on('change', path => {
  if (path === fileName) {
    // Push a task onto the queue. It won't run immediately if there's another task currently running.
    q.push({}, (err) => {
      if (err) console.error('Error:', err);
    });
  }
});