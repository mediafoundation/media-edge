const networks = require('./config/networks')
const {initDatabase} = require("./services/database");
const {initCaddy, checkDealsShouldBeActive, checkQueue, checkCaddy} = require("./services/caddy");
//const {checkEvents} = require("./services/events");
const {checkBandwidth, initBandwidth} = require("./services/bandwidth");
const { resetPurgeLog } = require('./services/varnish');
const {resetDB} = require("./utils/resetDB");
const {initSdk, Blockchain, validChains} = require("media-sdk");
const {PRIVATE_KEY} = require("./config/env");
const {CaddyController} = require("./controllers/caddyController");
const {checkEvents} = require("./services/events");

// Initialize the lastReadBlock variable to 0
let lastReadBlock = {};

/**
 * Initializes the dApp on a specific network
 * @param {Object} network - The network configuration object
 * @returns {boolean} - True if initialization was successful, false otherwise
 */

const init = async (network) => {

    let databaseInitStatus = true
    let caddyInitStatus = true
    let bandwidthInitStatus = true
    let blockReadStatus = true

    //Check if daemon needs to run a full reset
    const resetIndex = process.argv.indexOf('--reset');

    initSdk({privateKey: PRIVATE_KEY, transport: network.URL !== "undefined" ? network.URL : undefined, chain: validChains[network.id]})

    if(resetIndex !== -1){
        try{
            await resetDB()
            //await resetPurgeLog()
        } catch (e) {
            console.log("Error syncing db", e)
            databaseInitStatus = false
        }

        try{
            await CaddyController.initApps()
        }catch (e){
            console.log("Error syncing caddy", e)
            caddyInitStatus = false
        }
    }

    //Init database (get data from blockchain)
    try{
        await initDatabase(network)
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
        let blockchain = new Blockchain()
        let blockNumber = await blockchain.getBlockNumber()
        lastReadBlock[network.id] = Number(blockNumber)
    }catch (e){
        lastReadBlock[network.id] = 0
        console.log("Error when getting last block", e)
        blockReadStatus = false
    }

    return databaseInitStatus && caddyInitStatus && bandwidthInitStatus && blockReadStatus
/*
    edgeStatus = true

    return edgeStatus && rpcStatus*/
}

async function start(){
    // let CURRENT_NETWORK = networks.bsc
    for(const CURRENT_NETWORK of networks ){

        console.log(CURRENT_NETWORK)

        let initResult = init(CURRENT_NETWORK)
        //should set an interval and then cancel it when init is successful
        if(initResult){
            console.log("Edge started correctly")
        }

        if(lastReadBlock[CURRENT_NETWORK.chain_id] !== 0){
            console.log("Start to check events")
            setInterval(async () => {
                try { 
                    let getLastBlock = await checkEvents(lastReadBlock[CURRENT_NETWORK.id], CURRENT_NETWORK)
                    lastReadBlock[CURRENT_NETWORK.id] = getLastBlock ? getLastBlock : lastReadBlock[CURRENT_NETWORK.id];
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
        }, 60000)

        //reset varnish every 1 week
        setInterval(async() => {
            await resetPurgeLog()
        }, 24 * 7 * 60 * 60 * 1000)
    }
}

start()