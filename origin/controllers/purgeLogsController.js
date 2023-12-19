const axios = require("axios");
const fs = require("fs");
const {PurgeLog} = require("../models/purgeLog");


const queueFile = '/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/varnish_queue.json';
class PurgeLogsController {

    static async addRecord (url)  {
        try {
            let created = await PurgeLog.create(
                {
                    url: url
                }
            )
            console.log("Created record in varnish table: ", created.id)
            this.writeToFile(
                {
                    id: created.id,
                    url: created.url
                },
                queueFile
            )
            await this.purgeRecord(url)
        } catch (e) {
            console.log("Something went wrong during logging varnish purge:", e);
        }
    };

    static async purgeRecord (url) {
        try {
            let _url = new URL(url);
            let headers = { 'host': _url.host }
            if(_url.pathname.includes("*")){
                headers['X-Purge-Method'] = 'regex'
            }
            let response = await axios.request({
                method: 'PURGE',
                url: "http://127.0.0.1:6969"+_url.pathname,
                headers
            });
            if (response.status === 200) {
                console.log(`Successfully purged Varnish record for ${url}`);
            } else {
                console.error(`Failed to purge Varnish record for ${url}`);
            }
        } catch (error) {
            if (error.response.status === 503) {
                console.log(`Successfully purged Varnish record for ${url}`);
            } else {
                console.error(`Failed to purge Varnish record for ${url}`);
            }
        }
    }

    static async deleteAllRecords () {
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

    static writeToFile (dataObj, fileName){
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
}

module.exports = {PurgeLogsController}