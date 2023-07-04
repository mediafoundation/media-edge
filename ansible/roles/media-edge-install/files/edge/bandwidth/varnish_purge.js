const fs = require('fs');
const axios = require('axios');

const fileName = 'path/to/file.txt';
let lastReadId = 0;

// Function to purge a record using Axios
async function purgeRecord(record) {
  try {
    const response = await axios.request({
      method: 'PURGE',
      url: record.path,
      headers: {
        'X-Purge-Method': 'regex',
        'X-Key': 'your-secret-key' // Replace with your secret key if required
      }
    });

    if (response.status === 200) {
      console.log(`Successfully purged Varnish record for ID ${record.id}`);
    } else {
      console.error(`Failed to purge Varnish record for ID ${record.id}`);
    }
  } catch (error) {
    console.error(`Error purging Varnish record for ID ${record.id}:`, error);
  }
}

// Function to read the file and process records
function processRecords() {
  const fileStream = fs.createReadStream(fileName, { encoding: 'utf8' });
  let isFirstLine = true;

  fileStream.on('data', (data) => {
    const records = data.split('\n');
    const startIndex = isFirstLine ? 0 : 1;

    for (let i = startIndex; i < records.length; i++) {
      const record = JSON.parse(records[i]);

      if (record.id > lastReadId) {
        purgeRecord(record);
        lastReadId = record.id;
      } else if (lastReadId < parseInt(records[0].id) - 1) {
        // If last read ID is less than the first record ID minus one,
        // purge all varnish (purge everything)
        purgeRecord(record);
        lastReadId = parseInt(records[0].id) - 1;
      }
    }

    isFirstLine = false;
  });

  fileStream.on('end', () => {
    console.log('File processing completed.');
  });

  fileStream.on('error', (error) => {
    console.error('Error reading the file:', error);
  });
}

// Usage
processRecords();
