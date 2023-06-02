const models = require("../models");

let checkBandwidth = async () => {
    let deals = await models.Deals.getDealsFromDb()
    await models.Bandwidth.updateBandwidthUsage(deals)
    await models.Bandwidth.resetBandwidthLimitPeriod()
}

let initBandwidth = async () => {
    let dealsFromDb = await models.Deals.getDealsFromDb()
    for (const deal of dealsFromDb) {
        //console.log(deal)
        let formattedDeal = await models.Bandwidth.formatDataToDb(deal)
        //console.log("FormattedDeal", formattedDeal)
        await models.Bandwidth.upsertRecord(formattedDeal)
    }
}

module.exports = {initBandwidth, checkBandwidth}