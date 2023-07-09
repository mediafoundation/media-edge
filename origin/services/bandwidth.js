const models = require("../models");

let checkBandwidth = async () => {
    await models.Bandwidth.updateBandwidthUsage()
    await models.Bandwidth.resetBandwidthLimitPeriods()
}

let initBandwidth = async () => {
    let dealsFromDb = await models.Deals.getDealsFromDb()
    for (const deal of dealsFromDb) {
        let formattedDeal = await models.Bandwidth.formatDataToDb(deal)
        await models.Bandwidth.upsertRecord(formattedDeal)
    }
}

module.exports = {initBandwidth, checkBandwidth}