const models = require("../models");

let checkBandwidth = async () => {
    await models.DealsBandwidth.updateBandwidthUsage()
    await models.DealsBandwidth.resetBandwidthLimitPeriods()
}

let initBandwidth = async () => {
    let dealsFromDb = await models.Deals.getDealsFromDb()
    for (const deal of dealsFromDb) {
        let formattedDeal = await models.DealsBandwidth.formatDataToDb(deal)
        await models.DealsBandwidth.upsertRecord(formattedDeal)
    }
}

module.exports = {initBandwidth, checkBandwidth}