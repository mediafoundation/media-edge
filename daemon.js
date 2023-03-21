const networks = require('./config/networks')
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Marketplace = require('./evm-contract/build/contracts/Marketplace.json')
const Web3 = require('web3');
const {initDatabase} = require("./services/database");
const {initCaddy, checkDealsShouldBeActive} = require("./services/caddy");
const {checkEvents} = require("./services/events");

let lastReadBlock = 0;


const init = async (ResourcesContract, MarketplaceContract, network, web3Instance) => {
    let databaseInitStatus = true
    let caddyInitStatus = true
    let blockReadStatus = true
    try{
        await initDatabase(ResourcesContract, MarketplaceContract, network, web3Instance)
    } catch (e) {
        databaseInitStatus = false
        console.log("Error when init database:", e)

    }

    //add records to caddy

    try{
        await initCaddy(network)
    }catch (e) {
        console.log("Error when init caddy", e)
        caddyInitStatus = false
    }

    try {
        lastReadBlock = await web3Instance.eth.getBlockNumber()
    }catch (e){
        lastReadBlock = 0
        console.log("Error when getting last block", e)
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
            try {
                lastReadBlock = await checkEvents(MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK, web3)
            } catch(e){
                console.log("Something failed while checking events", e)
            }
        }, 10000)
    }

    //console.log("Check deals")
    setInterval(async () => {
        await checkDealsShouldBeActive()
    }, 10000)
});


