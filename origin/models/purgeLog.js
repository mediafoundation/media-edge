const fs = require('fs');
const axios = require('axios');

module.exports = (sequelize, DataTypes) => {

    const PurgeLog = sequelize.define('PurgeLog', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      url: {
        type: DataTypes.STRING,
      }
    }, {
      updatedAt: false,
    });

    const queueFile = '/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/varnish_queue.json';

    PurgeLog.addRecord = async (url) => {
        try {
          let created = await PurgeLog.create(
            { 
              url: url
            }
          )
          console.log("Created record in varnish table: ", created.id)
          PurgeLog.writeToFile(
            { 
              id: created.id, 
              url: created.url
            }, 
            queueFile
          )
          await PurgeLog.purgeRecord(url)
        } catch (e) {
            console.log("Something went wrong during logging varnish purge:", e);
        }
    };

    PurgeLog.purgeRecord = async (url) => {
        try {
	let _url = new URL(url);
            const response = await axios.request({
                method: 'PURGE',
                url: "http://127.0.0.1:6969"+_url.pathname,
                headers: {
                    'host':_url.host
                },
                //proxy: {
                //    host: '127.0.0.1',
                //    port: 6969,
                //}            
            });

            if (response.status === 200) {
                console.log(`Successfully purged Varnish record for ${url}`);
            } else {
                console.error(`Failed to purge Varnish record for ${url}`);
            }
        } catch (error) {
            console.error('Error purging Varnish record:', error);
        }
    }

    PurgeLog.deleteAllRecords = async () => {
        try {
            await PurgeLog.destroy({ where: {} });
            console.log('All records deleted successfully.');
            fs.unlink(queueFile, (err) => {
                if (err) {
                    console.error(`Error deleting file: ${err}`);
                } else {
                    console.log(`File '${queueFile}' deleted successfully.`);
                }
            });
        } catch (error) {
            console.error('Error deleting records:', error);
        }
    }

    PurgeLog.writeToFile = (dataObj, fileName) => {
      const jsonStr = JSON.stringify(dataObj);
      const line = `${jsonStr}\n`;
    
      fs.access(fileName, fs.constants.F_OK, (err) => {
        if (err) {
          // File doesn't exist, create a new file
          fs.writeFile(fileName, line, (err) => {
            if (err) {
              console.error(`Error creating file: ${err}`);
            } else {
              console.log(`File '${fileName}' created successfully.`);
            }
          });
        } else {
          // File exists, append to it
          fs.appendFile(fileName, line, (err) => {
            if (err) {
              console.error(`Error appending to file: ${err}`);
            } else {
              console.log(`Data appended to '${fileName}' successfully.`);
            }
          });
        }
      });
    }

    
    return PurgeLog
  }
