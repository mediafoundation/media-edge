const networks = require('./config/networks')
const env = require('./config/env')
const db = require('./models');
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Marketplace = require('./evm-contract/build/contracts/Marketplace.json')
const Web3 = require('web3');
const {noRawAttributes} = require("sequelize/lib/utils/deprecations");

let lastReadBlock = 0;


const init = async (ResourcesContract, MarketplaceContract, network, web3Instance) => {

    let rpcStatus
    let edgeStatus

    //fetch resources and deals
    let resources = await db.Evm.getPaginatedResources(ResourcesContract, 0, 2);


    let deals = await db.Deals.getPaginatedDeals(MarketplaceContract, 0, 2)

    if (resources && deals) {
        let dealsToDelete = []

        //add to an array all the deal's id to delete
        for (let i = 0; i < deals.length; i++) {
            if (await db.Deals.dealIsActive(deals[i]) === false || deals[i].active === false) {
                dealsToDelete.push(deals[i].id)
            }
        }

        //delete deal from the array of deals
        for (let i = 0; i < dealsToDelete.length; i++) {
            let indexToDelete = deals.map(deal => deal.id).indexOf(dealsToDelete[i])
            deals.splice(indexToDelete, 1)
        }

        //check which resources are not in an active deal
        let resourcesIds = resources.map(obj => obj.resource_id)
        let dealResourcesIds = deals.map(obj => obj.resourceId)
        let resourcesToDelete = await db.Evm.compareDealsResourcesWithResources(dealResourcesIds, resourcesIds)

        //delete resource from the array of resources
        for (let i = 0; i < resourcesToDelete.length; i++) {
            let indexToDelete = resources.map(deal => deal.resource_id).indexOf(resourcesToDelete[i])
            resources.splice(indexToDelete, 1)
        }

        //upsert records in db
        for (const resource of resources) {
            let resourceFormatted = db.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, network.name)
            //store formated resources to be use in caddy
            //formattedResources.push(resourceFormatted)
            await db.Evm.addRecord(resourceFormatted)
        }

        for (const deal of deals) {
            let dealFormatted = db.Deals.formatDataToDb(deal)
            await db.Deals.addRecord(dealFormatted)
        }

        //delete records that are in db but not in blockchain
        resourcesIds = resources.map(obj => obj.resource_id)
        let notCompatibleResources = await db.Evm.compareBlockchainAndDbData(resourcesIds)

        if (notCompatibleResources.length > 0) {
            await db.Evm.deleteRecords(notCompatibleResources)
        }

        let dealsIds = deals.map(obj => obj.id)
        let notCompatibleDeals = await db.Deals.compareBlockchainAndDbData(dealsIds)

        if (notCompatibleDeals.length > 0) {
            await db.Deals.deleteRecords(notCompatibleDeals)
        }

        lastReadBlock = await web3Instance.eth.getBlockNumber()
        console.log("Block:", lastReadBlock)
        rpcStatus = true
    }
    else {
        rpcStatus = false
        console.log("RPC has found errors")
    }


    //add records to caddy

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

    edgeStatus = true

    return edgeStatus && rpcStatus
}


// let CURRENT_NETWORK = networks.bsc
let deployed = [networks.ganache]
deployed.forEach(async CURRENT_NETWORK => {

    const web3 = new Web3(
        new Web3.providers.HttpProvider(CURRENT_NETWORK.URL)
    );
    console.log("Contract address:", Resources.networks[CURRENT_NETWORK.network_id].address, "Start daemon to:", CURRENT_NETWORK.URL)


    const ResourcesInstance = new web3.eth.Contract(
        Resources.abi,
        Resources.networks[CURRENT_NETWORK.network_id].address
    );

    const MarketplaceInstance = new web3.eth.Contract(
        Marketplace.abi,
        Marketplace.networks[CURRENT_NETWORK.network_id].address
    )

    let initResult = await init(ResourcesInstance, MarketplaceInstance, CURRENT_NETWORK, web3)
    //should set an interval and then cancel it when init is successful
    if(initResult){
        console.log("Edge started correctly")

    }

    if(lastReadBlock !== 0){
        //console.log("Start to check events")
        setInterval(async () => {
            await MarketplaceInstance.getPastEvents('DealCreated', {
                fromBlock: lastReadBlock + 1,
                toBlock: 'latest'
            }, async (error, events) => {
                if (events !== undefined) {
                    for (const event of events) {
                        let deal = await db.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId)
                        let resource = await db.Evm.getResource(ResourcesInstance, deal.resourceId)
                        if (await db.Deals.dealIsActive(deal) !== false && deal.active !== false) {
                            let dealFormatted = db.Deals.formatDataToDb(deal)
                            let resourceFormatted = db.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK.name)

                            console.log(dealFormatted, resourceFormatted)
                            await db.Deals.addRecord(dealFormatted)
                            await db.Evm.addRecord(resourceFormatted)
                            await db.Caddy.addRecord({resource: resourceFormatted, deal: dealFormatted})
                        }
                    }
                }
            })

            await ResourcesInstance.getPastEvents('UpdatedResource', {
                fromBlock: lastReadBlock + 1,
                toBlock: 'latest'
            }, async (error, events) => {
                if (events !== undefined) {
                    for (const event of events) {
                        let deals = await db.Deals.dealsThatHasResource(event.returnValues._id)
                        if(deals.length > 0){
                            let resource = await db.Evm.getResource(ResourcesInstance, event.returnValues._id)
                            let formattedResource = await db.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK.name)
                            await db.Evm.addRecord(formattedResource)

                            for (const deal of deals) {
                                //Check if cname is added or deleted
                                let caddyRecords = await db.Caddy.getRecord(deal.id)
                                let dbRecords = []
                                if(formattedResource.domain){
                                    dbRecords.push(formattedResource.domain)
                                }
                                dbRecords.push(...(await db.Caddy.getHostname(deal)))

                                if(!db.Caddy.areArraysEqual(dbRecords, caddyRecords)){
                                    await db.Caddy.updateRecord({resource: formattedResource, deal: deal.dataValues}, caddyRecords)
                                }
                            }
                        }
                    }
                }
            })

            lastReadBlock = await web3.eth.getBlockNumber()
        }, 10000)
    }
});


