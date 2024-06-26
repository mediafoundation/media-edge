const {PurgeLogsController} = require("../controllers/purgeLogsController");
const {CaddyController} = require("../controllers/caddyController");

const resetPurgeLog = async () => {
    await PurgeLogsController.deleteAllRecords()
}

/*const manageBandwidth = async () => {

    let deals = await models.DealsBandwidth.getRecordsFromDb()
    for (const deal of deals) {
        let caddyHosts = await models.Caddy.getHosts(deal.id)
        for (const host of caddyHosts) {
            await models.PurgeLog.addRecord(host+'/')
        }

        // let deal = await models.Deals.getDealById(dealFromDb.id)
        // console.log("Deal in varnish service:", deal);
        // let domains = JSON.parse(deal.domains)
        // for (const domain of domains) {
        //     await models.PurgeLog.addRecord(deal.id + domain[1], '/', dealFromDb.bandwidth_limit_applied)
        // }
        // let resource = await models.Resources.getResourceById(deal.resourceId)
        // let domain = resource.dataValues.domain
        // if(domain != ''){
        //     await models.PurgeLog.addRecord(domain, "/", dealFromDb.bandwidth_limit_applied)
        // }
        // console.log(resource);
    }
}*/

const purgeRecord = async (deal, path) => {
    
    let caddyHosts = await CaddyController.getHosts(deal.id)
    for (const host of caddyHosts) {
        await PurgeLogsController.addRecord("http://"+host + path)
    }

    // let deal = await models.Deals.getDealById(dealId)
    // console.log("Deal in varnish service:", deal);
    // let domains = JSON.parse(deal.domains)
    // for (const domain of domains) {
    //     await models.PurgeLog.addRecord(domain[1], path)
    //     await models.PurgeLog.purgeRecord(domain[1]+path)
    // }
    // let resource = await models.Resources.getResourceById(deal.resourceId)
    // console.log(resource);
}

module.exports = {resetPurgeLog, purgeRecord}