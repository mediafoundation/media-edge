const models = require("../models");
const {networks} = require("../evm-contract/truffle-config");
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

    let difference = await models.Caddy.compareDbAndCaddyData(
        dealsFromDB.map(deal => deal.id),
	caddyFile.map(obj => obj['@id']).filter(id => id)
    )

	//console.log(dealsFromDB.map(deal => deal.id))
	//console.log(caddyFile.map(obj => obj['@id']).filter(id => id))

	//console.log("Difference", difference)
    for (const deal of difference) {
        await models.Caddy.deleteRecord(deal)
    }

    await models.Caddy.pendingQueue()
}

let checkDealsShouldBeActive = async function(network){
    //get all deals
    //console.log("Checking deal")
    let deals = await models.Deals.getDealsFromDb()
    let dealsToDelete = []
    let resourcesToDelete = []
    for (const deal of deals) {
        let dealIsActive = await models.Deals.dealIsActive(deal)
        if(!dealIsActive){
            dealsToDelete.push(deal.id)
            //Check if deleted deal's resource has another deals or need to be removed
            let dealsOfResource = await models.Deals.dealsThatHasResource(deal.resourceId)
            if(dealsOfResource.length === 1){
                //remove resource too
                //await models.Evm.deleteRecords(deal.resourceId)
                resourcesToDelete.push(deal.resourceId)
            }
        }
    }

    //Delete deals from db

    if(dealsToDelete.length > 0){
        console.log("Deals id to delete:", dealsToDelete)
        await models.Deals.deleteRecords(dealsToDelete)
        await models.Evm.deleteRecords(resourcesToDelete)

        //Delete deals from caddy
        for (const dealToDelete of dealsToDelete) {
            models.Caddy.deleteRecord(dealToDelete, network)
        }
    }
}

module.exports = {initCaddy, checkDealsShouldBeActive}
