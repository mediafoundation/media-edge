import { initDatabase } from "./services/database";
import { initCaddy, checkQueue, checkCaddy } from "./services/caddy";
import { checkBandwidth, initBandwidth } from "./services/bandwidth";
import { resetPurgeLog } from './services/varnish';
import { resetDB, createRelationsBetweenTables } from "./utils/resetDB";
import { Sdk, Blockchain, validChains, WalletUtils, http } from "media-sdk";
import { CaddyController } from "./controllers/caddyController";
import { checkEvents } from "./services/events";
import { env } from "./config/env";
import { Domain } from "./config/interfaces";
import { providerData, providerState } from "./models/providerState"
import ExpressProvider from "./services/ExpressProvider"
import CertsProvider from "./services/CertsProvider"
import { Network } from "./config/interfaces";
import { obtainAndRenewCertificates } from "./utils/certs";

let lastReadBlock: { [key: string]: string } = {};


const init = async (network: Network, address: string, privateKey: string): Promise<boolean> => {
    let databaseInitStatus = true;
    let caddyInitStatus = true;
    let bandwidthInitStatus = true;
    let blockReadStatus = true;


    let sdk = new Sdk({ chain: validChains[network.id], transport: [http(network.URL)] });

    try {
        await initDatabase(network, sdk, address, privateKey);
    } catch (e) {
        databaseInitStatus = false;
        console.log("Error when init database:", e);
    }

    try {
        await initCaddy(network, privateKey);
    } catch (e) {
        console.log("Error when init caddy", e);
        caddyInitStatus = false;
    }

    try {
        await initBandwidth();
    } catch (e) {
        console.log("Error when init bandwidth", e);
        bandwidthInitStatus = false;
    }

    try {
        let blockchain = new Blockchain(sdk);
        let blockNumber = await blockchain.getBlockNumber()
        lastReadBlock[network.id] = blockNumber.toString()
    } catch (e) {
        lastReadBlock[network.id] = "0";
        console.log("Error when getting last block", e);
        blockReadStatus = false;
    }

    return databaseInitStatus && caddyInitStatus && bandwidthInitStatus && blockReadStatus;
}

async function start() {

    const resetIndex = process.argv.indexOf('--reset');
    
    if (resetIndex !== -1) {
        try {
            await resetDB();
        } catch (e) {
            console.log("Error syncing db", e);
        }

    }

    await CaddyController.initApps();


    await createRelationsBetweenTables();
    for (let i = 0; i < env.providers.length; i++) {
        let address: `0x${string}`;
        let privateKey: `0x${string}`;

        //Infer usage between mnemonic and private key. Mnemonic preferred.
        if(env.providers[i].mnemonic) {
            const hdKey = await WalletUtils.mnemonicToHDAccount(env.providers[i].mnemonic);
            address = env.providers[i].wallet_address ? env.providers[i].wallet_address : hdKey.address
            const privateKeyUnformatted = hdKey.getHdKey().privateKey
            if(!privateKeyUnformatted) {
                throw new Error("Private key not available, check your config/env.ts file and make sure you have a valid mnemonic");
            }

            privateKey = Buffer.from(privateKeyUnformatted).toString("hex") as `0x${string}`;
        }

        else {
            const account = await WalletUtils.privateKeyToAccount(env.providers[i].privateKey);
            address = env.providers[i].wallet_address ? env.providers[i].wallet_address : account.address
            privateKey = env.providers[i].privateKey
        }

        providerState[address] = {privateKey: privateKey};
        providerData[privateKey] = env.providers[i];


        const networks = env.providers[i].supportedChains;
        for (const CURRENT_NETWORK of networks) {
            console.log(CURRENT_NETWORK);

            let initResult = await init(CURRENT_NETWORK, address, privateKey);
            if (initResult) {
                console.log("Edge started correctly");
            }

            if (lastReadBlock[CURRENT_NETWORK.id] !== "0") {
                console.log("Start to check events");
                setInterval(async () => {
                    try {
                        let getLastBlock = await checkEvents(BigInt(lastReadBlock[CURRENT_NETWORK.id]), CURRENT_NETWORK);
                        lastReadBlock[CURRENT_NETWORK.id] = getLastBlock ? getLastBlock : lastReadBlock[CURRENT_NETWORK.id];
                    } catch (e) {
                        console.log("Something failed while checking events", e);
                    }
                }, 60000);
            }

            checkQueue(privateKey);

            setInterval(async () => {
                checkCaddy(privateKey);
            }, 60000);

            setInterval(async () => {
                console.log("Start checking bandwidth");
                //checkBandwidth();
            }, 60000);

            setInterval(async () => {
                resetPurgeLog();
            }, 24 * 7 * 60 * 60 * 1000);
        }
        //obtain all wildcard certificates for this provider
        const updatedDomains = env.providers[i].domains.map((domain: Domain) => ({
            ...domain,
            host: `*.${domain.host}`,
        }));

        obtainAndRenewCertificates(updatedDomains);
    }
}

CertsProvider.init(); // Certificate manager

start();

//this should start once the records are set in DB.

ExpressProvider.init(); // API (for clients)

// // This requires fixing asap. 
// setTimeout(() => {
//   console.log("Starting API");
//   ExpressProvider.init()
// }, 30000);