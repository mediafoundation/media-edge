const models = require("../models");

let checkBandwidth = async () => {
    let dealsUpdated = await models.DealsBandwidth.updateBandwidthUsage()
    let dealsRestored = await models.DealsBandwidth.resetBandwidthLimitPeriods()

    let dealsToPurge = [...dealsUpdated, ...dealsRestored]

    for (const deal of dealsToPurge) {
        let caddyHosts = await models.Caddy.getHosts(deal.id)
        for (const host of caddyHosts) {
            await models.PurgeLog.addRecord(host+'/')
        }
    }
}

let initBandwidth = async () => {
    let dealsFromDb = await models.Deals.getDealsFromDb()
    for (const deal of dealsFromDb) {
        let formattedDeal = await models.DealsBandwidth.formatDataToDb(deal)
        await models.DealsBandwidth.upsertRecord(formattedDeal)
    }
}

module.exports = {initBandwidth, checkBandwidth}