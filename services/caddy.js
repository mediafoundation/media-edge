const models = require("../models");
let initCaddy = async function(){
    let caddyRecords = await models.Caddy.getRecords()
    if(!caddyRecords){
        await models.Caddy.initApps()
        caddyRecords = await models.Caddy.getRecords()
    }

    let dealsFromDB = await models.Deals.getDealsFromDb()
    let resourcesFromDB = await models.Evm.getResources()

    let matchDealResources = []

    dealsFromDB.forEach(deal => {
        let matchDealResource = {}
        matchDealResource.deal = deal
        matchDealResource.resource = resourcesFromDB.find(resource => resource.id === deal.resourceId)
        matchDealResources.push(matchDealResource)
    })

    //console.log("Caddy records", caddyRecords)
    await models.Caddy.addRecords(matchDealResources, caddyRecords)

    //delete records from caddy sources that are not in deals table

    //let caddySources = await models.Caddy.getCaddySources()

    let caddyFile = await models.Caddy.getRecords()

    console.log(caddyFile.find(o => o["@id"]))
    let difference = await models.Caddy.compareDbAndCaddyData(
        dealsFromDB.map(deal => deal.id),
        caddyFile.find(o => o["@id"])
    )

    for (const deal of difference) {
        await models.Caddy.deleteRecord(deal)
    }

    await models.Caddy.pendingQueue()
}

let checkDealsShouldBeActive = async function(){
    //get all deals
    let deals = await models.Deals.getDealsFromDb()
    let dealsToDelete = []
    for (const deal of deals) {
        let dealIsActive = await models.Deals.dealIsActive(deal)
        if(!dealIsActive){
            dealsToDelete.push(deal.id)
            //Check if deleted deal's resource has another deals or need to be removed
            let dealsOfResource = await models.Deals.dealsThatHasResource(deal.resourceId)
            if(dealsOfResource.length === 1){
                //remove resource too
                await models.Evm.deleteRecord(deal.resourceId)
            }
        }
    }

    //Delete deals from db
    await models.Deals.deleteRecords(dealsToDelete)


    //Delete deals from caddy
    for (const dealToDelete of dealsToDelete) {
        models.Caddy.deleteRecord(dealToDelete)
    }
}

module.exports = {initCaddy, checkDealsShouldBeActive}