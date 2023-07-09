const models = require('../models')

const resetVarnish = async () => {
    await models.Varnish.deleteAllRecords()
}

const manageBandwidth = async () => {

    let deals = await models.Bandwidth.getRecordsFromDb()
    for (const dealFromDb of deals) {
        let caddyHosts = await db.Caddy.getHosts(deal.id)
        for (const host of caddyHosts) {
            await models.Varnish.addRecord(host+path)
        }

        // let deal = await models.Deals.getDealById(dealFromDb.id)
        // console.log("Deal in varnish service:", deal);
        // let domains = JSON.parse(deal.domains)
        // for (const domain of domains) {
        //     await models.Varnish.addRecord(deal.id + domain[1], '/', dealFromDb.bandwidth_limit_applied)
        // }
        // let resource = await models.Evm.getResourceById(deal.resourceId)
        // let domain = resource.dataValues.domain
        // if(domain != ''){
        //     await models.Varnish.addRecord(domain, "/", dealFromDb.bandwidth_limit_applied)
        // }
        // console.log(resource);
    }
}

const purgeRecord = async (dealId, path) => {
    
    let caddyHosts = await db.Caddy.getHosts(dealId)
    for (const host of caddyHosts) {
        await models.Varnish.addRecord(host + path)
    }

    // let deal = await models.Deals.getDealById(dealId)
    // console.log("Deal in varnish service:", deal);
    // let domains = JSON.parse(deal.domains)
    // for (const domain of domains) {
    //     await models.Varnish.addRecord(domain[1], path)
    //     await models.Varnish.purgeRecord(domain[1]+path)
    // }
    // let resource = await models.Evm.getResourceById(deal.resourceId)
    // console.log(resource);
}

module.exports = {resetVarnish, manageBandwidth, purgeRecord}