const fs = require('fs');
const axios = require('axios');

module.exports = (sequelize, DataTypes) => {

    const Varnish = sequelize.define('Varnish', {
        id: { type: DataTypes.STRING, primaryKey: true, autoIncrement: true },
        path: DataTypes.STRING
    }, { freezeTableName: true }
    )

    Varnish.addRecord = async (domain, path) => {

        try {
            varnish_record = await Varnish.create({ path: domain + path })
            console.log("Created record in varnish table: ", varnish_record.id)
            Varnish.appendFile({ id: varnish_record.id, path: varnish_record.path }, '/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/varnish_queue.json')
        } catch (e) {
            console.log("Something went wrong during logging varnish purge:", e);
        }
    };



    // Function to append to or create the file
    Varnish.appendToFile = (dataObj, fileName) => {
        // Check if the file exists
        fs.access(fileName, fs.constants.F_OK, (err) => {
            if (err) {
                // File doesn't exist, create a new file
                createNewFile(dataObj, fileName);
            } else {
                // File exists, append to it
                appendToExistingFile(dataObj, fileName);
            }
        });
    }

    Varnish.purgeRecord = async (url) => {
        try {
            const response = await axios.request({
                method: 'PURGE',
                url: url,
                headers: {
                    'X-Purge-Method': 'regex'
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
            await MyModel.destroy({ where: {} });
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

    //Varnish.sync({force: state.resetDb})

    // Function to create a new file and write the object
    function createNewFile(dataObj, fileName) {
        const jsonStr = convertToJSON(dataObj);
        const line = `${jsonStr}\n`;

        fs.writeFile(fileName, line, (err) => {
            if (err) {
                console.error(`Error creating file: ${err}`);
            } else {
                console.log(`File '${fileName}' created successfully.`);
            }
        });
    }

    // Function to convert object to JSON string
    function convertToJSON(obj) {
        return JSON.stringify(obj);
    }

    // Function to append the object to an existing file
    function appendToExistingFile(dataObj, fileName) {
        const jsonStr = convertToJSON(dataObj);
        const line = `${jsonStr}\n`;

        fs.appendFile(fileName, line, (err) => {
            if (err) {
                console.error(`Error appending to file: ${err}`);
            } else {
                console.log(`Data appended to '${fileName}' successfully.`);
            }
        });
    }
    return Varnish
}