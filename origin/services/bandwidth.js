const models = require("../models");
const {DealsController} = require("../controllers/dealsController");
const {BandwidthController} = require("../controllers/bandwidthController");

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
    let dealsFromDb = await DealsController.getDeals()
    for (const deal of dealsFromDb) {
        let formattedDeal = await BandwidthController.formatDataToDb(deal)
        await BandwidthController.upsertRecord(formattedDeal)
    }
}

module.exports = {initBandwidth, checkBandwidth}