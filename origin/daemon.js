const networks = require('./config/networks')
const Resources = require('../media-evm-abis/Resources.json');
const Marketplace = require('../media-evm-abis/Marketplace.json')
const Web3 = require('web3');
const models = require("./models");
const env = require("./config/env")

const {initDatabase} = require("./services/database");
const {initCaddy, checkDealsShouldBeActive, checkQueue, checkCaddy} = require("./services/caddy");
const {checkEvents} = require("./services/events");
const {checkBandwidth, initBandwidth} = require("./services/bandwidth");
const { resetVarnish, manageBandwidth } = require('./services/varnish');

// Initialize the lastReadBlock variable to 0
let lastReadBlock = 0;

/**
 * Initializes the dApp on a specific network
 * @param {Object} ResourcesContract - The Resources smart contract instance
 * @param {Object} MarketplaceContract - The Marketplace smart contract instance
 * @param {Object} network - The network configuration object
 * @param {Object} web3Instance - The web3 provider instance
 * @returns {boolean} - True if initialization was successful, false otherwise
 */

const init = async (ResourcesContract, MarketplaceContract, network, web3Instance) => {

    let databaseInitStatus = true
    let caddyInitStatus = true
    let bandwidthInitStatus = true
    let blockReadStatus = true

    //Check if daemon needs to run a full reset
    const resetIndex = process.argv.indexOf('--reset');
    if(resetIndex !== -1){
        try{
            await models.Evm.sync({force: true})
            await models.Deals.sync({force: true})
            await models.Caddy.syncCaddySources({force: true})
            await models.Varnish.sync({force: true})
            await models.Bandwidth.sync({force: true})
            await resetVarnish()
        } catch (e) {
            console.log("Error syncing db", e)
            databaseInitStatus = false
        }

        try{
            await models.Caddy.initApps()
        }catch (e){
            console.log("Error syncing caddy", e)
            caddyInitStatus = false
        }
    }

    //Init database (get data from blockchain)
    try{
        await initDatabase(ResourcesContract, MarketplaceContract, network, web3Instance)
    } catch (e) {
        databaseInitStatus = false
        console.log("Error when init database:", e)

    }

    //Init caddy (get data from db)
    try{
        await initCaddy(network)
    }catch (e) {
        console.log("Error when init caddy", e)
        caddyInitStatus = false
    }

    //Init bandwidth limiter
    try{
        await initBandwidth()
    }catch(e) {
        console.log("Error when init bandwidth", e)
        bandwidthInitStatus = false
    }

    //Read block to use in events
    try {
        lastReadBlock = await web3Instance.eth.getBlockNumber()
    }catch (e){
        lastReadBlock = 0
        console.log("Error when getting last block", e)
        blockReadStatus = false
    }

    return databaseInitStatus && caddyInitStatus && bandwidthInitStatus && blockReadStatus
/*
    edgeStatus = true

    return edgeStatus && rpcStatus*/
}


// let CURRENT_NETWORK = networks.bsc
networks.forEach(async CURRENT_NETWORK => {

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
            try { 
                let getLastBlock = await checkEvents(MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK, web3)
                lastReadBlock = getLastBlock ? getLastBlock : lastReadBlock;
            } catch(e){
                console.log("Something failed while checking events", e)
            }
        }, 10000)
    }

    //Check if deals has balance to remain
    setInterval(async () => {
        await checkDealsShouldBeActive()
    }, 10000)

    checkQueue()

    setInterval(async () => {
        await checkCaddy(CURRENT_NETWORK)
    }, 60000)

    setInterval(async () => {
        console.log("Start checking bandwidth")
        await checkBandwidth()
        await manageBandwidth()
    }, 60000)

    //reset varnish every 1 week
    setInterval(async() => {
        await resetVarnish()
    }, 24 * 7 * 60 * 60 * 1000)
});


