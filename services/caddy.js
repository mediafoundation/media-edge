const db = require("../models");
let initCaddy = async function(){
    let caddyRecords = await db.Caddy.getRecords()
    if(!caddyRecords){
        await db.Caddy.initApps()
        caddyRecords = await db.Caddy.getRecords()
    }

    let dealsFromDB = await db.Deals.getDeals()
    let resourcesFromDB = await db.Evm.getResources()

    let matchDealResources = []

    dealsFromDB.forEach(deal => {
        let matchDealResource = {}
        matchDealResource.deal = deal
        matchDealResource.resource = resourcesFromDB.find(resource => resource.id === deal.resourceId)
        matchDealResources.push(matchDealResource)
    })

    //console.log("Caddy records", caddyRecords)
    await db.Caddy.addRecords(matchDealResources, caddyRecords)

    //delete records from caddy sources that are not in deals table

    let caddySources = await db.Caddy.getCaddySources()

    let difference = await db.Caddy.compareDbAndCaddyData(
        dealsFromDB.map(deal => deal.id),
        Array.from(new Set(caddySources.map(caddySource => caddySource.deal_id)))
    )

    for (const deal of difference) {
        await db.Caddy.deleteRecord(deal)
    }

    await db.Caddy.pendingQueue()
}

module.exports = {initCaddy}