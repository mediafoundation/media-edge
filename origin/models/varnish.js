const fs = require('fs');
const axios = require('axios');

module.exports = (sequelize, DataTypes) => {

    const Varnish = sequelize.define('Varnish', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      path: {
        type: DataTypes.STRING,
      },

      bandwidth_limited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    }, {
      updatedAt: false,
    });

    Varnish.addRecord = async (domain, path, bandwidhtLimited) => {

        try {
            let varnishFromDb = await Varnish.findOne({where: {path: domain + path}, order: [['createdAt', 'DESC']], raw: true})
            if(!varnishFromDb || varnishFromDb.bandwidth_limited != bandwidhtLimited){
                varnish_record = await Varnish.create({ path: domain + path , bandwidth_limited: bandwidhtLimited})
                console.log("Created record in varnish table: ", varnish_record.id)
                Varnish.appendToFile({ id: varnish_record.id, path: varnish_record.path , bandwidth_limited: bandwidhtLimited}, '/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/varnish_queue.json')
                await Varnish.purgeRecord(domain + path)
            }
        } catch (e) {
            console.log("Something went wrong during logging varnish purge:", e);
        }
    };



    

    Varnish.purgeRecord = async (url) => {
        try {
            const response = await axios.request({
                method: 'PURGE',
                url: url,
                headers: {
                    'X-Purge-Method': 'regex'
                },
                proxy: {
                    host: '127.0.0.1',
                    port: 80,
                  }            
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

    Varnish.deleteAllRecords = async (filePath) => {
        try {
            await Varnish.destroy({ where: {} });
            console.log('All records deleted successfully.');
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file: ${err}`);
                } else {
                    console.log(`File '${filePath}' deleted successfully.`);
                }
            });
        } catch (error) {
            console.error('Error deleting records:', error);
        }
    }

    // Function to append to or create the file
Varnish.appendToFile = (dataObj, fileName) => {
    // Check if the file exists
    fs.access(fileName, fs.constants.F_OK, (err) => {
      if (err) {
        // File doesn't exist, create a new file
        Varnish.createNewFile(dataObj, fileName);
      } else {
        // File exists, append to it
        Varnish.appendToExistingFile(dataObj, fileName);
      }
    });
  }
  
  // Function to create a new file and write the object
  Varnish.createNewFile = (dataObj, fileName) => {
    const jsonStr = Varnish.convertToJSON(dataObj);
    const line = `${jsonStr}\n`;
  
    fs.writeFile(fileName, line, (err) => {
      if (err) {
        console.error(`Error creating file: ${err}`);
      } else {
        console.log(`File '${fileName}' created successfully.`);
      }
    });
  }
  
  // Function to append the object to an existing file
  Varnish.appendToExistingFile = (dataObj, fileName) => {
    const jsonStr = Varnish.convertToJSON(dataObj);
    const line = `${jsonStr}\n`;
  
    fs.appendFile(fileName, line, (err) => {
      if (err) {
        console.error(`Error appending to file: ${err}`);
      } else {
        console.log(`Data appended to '${fileName}' successfully.`);
      }
    });
  }


Varnish.convertToJSON = (obj) => {
  return JSON.stringify(obj);
}

    
    return Varnish
  }