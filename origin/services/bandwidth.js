const {DealsController} = require("../controllers/dealsController");
const {BandwidthController} = require("../controllers/bandwidthController");
const {CaddyController} = require("../controllers/caddyController");
const {PurgeLogsController} = require("../controllers/purgeLogsController");

let checkBandwidth = async () => {
    let dealsUpdated = await BandwidthController.updateBandwidthUsage()
    let dealsRestored = await BandwidthController.resetBandwidthLimitPeriods()

    let dealsToPurge = [...dealsUpdated, ...dealsRestored]

    for (const deal of dealsToPurge) {
        let caddyHosts = await CaddyController.getHosts(deal.id)
        for (const host of caddyHosts) {
            await PurgeLogsController.addRecord(host+'/')
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