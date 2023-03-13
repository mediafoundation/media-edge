const networks = require('./config/networks')
const env = require('./config/env')
const db = require('./models');
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Marketplace = require('./evm-contract/build/contracts/Marketplace.json')
const Web3 = require('web3');
const {initDatabase} = require("./services/database");
const {initCaddy} = require("./services/caddy");

let lastReadBlock = 0;


const init = async (ResourcesContract, MarketplaceContract, network, web3Instance) => {
    let databaseInitStatus = true
    let caddyInitStatus = true
    let blockReadStatus = true
    try{
        await initDatabase(ResourcesContract, MarketplaceContract, network, web3Instance)
    } catch (e) {
        databaseInitStatus = false
    }

    //add records to caddy

    try{
        await initCaddy()
    }catch (e) {
        caddyInitStatus = false
    }

    try {
        lastReadBlock = await web3Instance.eth.getBlockNumber()
    }catch (e){
        lastReadBlock = 0
        blockReadStatus = false
    }

    return databaseInitStatus && caddyInitStatus && blockReadStatus
/*
    edgeStatus = true

    return edgeStatus && rpcStatus*/
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
        console.log("Start to check events")
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


