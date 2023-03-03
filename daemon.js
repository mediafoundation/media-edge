const networks = require('./config/networks')
const env = require('./config/env')
const db = require('./models');
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Marketplace = require('./evm-contract/build/contracts/Marketplace.json')
const Web3 = require('web3');

let lastReadBlock = 0;


const init = async (ResourcesContract, MarketplaceContract, network, web3Instance) => {

    await db.Caddy.initApps()

    //fetch resources and deals
    let resources = await db.Evm.getPaginatedResources(ResourcesContract, 0, 2);


    let deals = await db.Deals.getPaginatedDeals(MarketplaceContract, 0, 2)

    console.log("Deal", deals[0])

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
            console.log("Netowrk", network)
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
    } else {
        console.log("RPC has found errors")
    }


    //add records to caddy
    let caddyRecords = await db.Caddy.getRecords()
    let dealsFromDB = await db.Deals.getDeals()
    let resourcesFromDB = await db.Evm.getResources()

    let matchDealResources = []

    dealsFromDB.forEach(deal => {
        let matchDealResource = {}
        matchDealResource.deal = deal
        matchDealResource.resource = resourcesFromDB.find(resource => resource.id === deal.resourceId)
        matchDealResources.push(matchDealResource)
    })

    await db.Caddy.addRecords(matchDealResources, caddyRecords)

    await db.Caddy.pendingQueue()

    console.log("Finish")
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

    /* ResourcesInstance.events.NewResource({filter: {value: []}})
    .on('data', event => {
      console.log("New Resources:",event.returnValues[0],event.returnValues[1],
      event.returnValues.servardata)
      // Evm.upsert({address: res.toLowerCase()}, {index: index.toString()})
    })
    .on('changed', changed => console.log("Changed!",changed))
    .on('error', err => console.warn("Error",err) )
    // .on('connected', str => console.log("NewResource conection:",str))

    ResourcesInstance.events.RemoveResource({filter: {value: []}})
    .on('data', event => {console.log("RemoveResource:",event.returnValues)})
    .on('changed', changed => console.log("Changed!",changed))
    .on('error', err => console.warn("Error",err) )
    // .on('connected', str => console.log("RemoveResource conection:",str))

    ResourcesInstance.events.NewAddress({filter: {value: []}})
    .on('data', event => {console.log("NewAddress:",event.returnValues)})
    .on('changed', changed => console.log("Changed!",changed))
    .on('error', err => console.warn("Error",err) )
    // .on('connected', str => console.log("NewAddress conecton:",str))


    ResourcesInstance.events.RemoveAddress({filter: {value: []}})
    .on('data', event => {console.log("RemoveAddress:",event.returnValues)})
    .on('changed', changed => console.log("Changed!",changed))
    .on('error', err => console.warn("Error",err) )
    // .on('connected', str => console.log("RemoveAddress conecton:",str)) */



    await init(ResourcesInstance, MarketplaceInstance, CURRENT_NETWORK, web3)

    if(lastReadBlock !== 0){
        setInterval(async () => {
            console.log("Checking events")
            console.log("Reading event from:", lastReadBlock)
            MarketplaceInstance.getPastEvents('DealCreated', {fromBlock: lastReadBlock + 1, toBlock: 'latest'}, function (error, events){
                //console.log(events)
                if(events !== undefined){
                    events.forEach(event => {
                        console.log(event.returnValues._dealId)
                    })
                }
            })

            lastReadBlock = await web3.eth.getBlockNumber()
        }, 10000)
    }
});


