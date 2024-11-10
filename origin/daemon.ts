import { initDatabase } from "./services/database";
import { initCaddy, checkQueue, checkCaddy } from "./services/caddy";
import { checkBandwidth, initBandwidth } from "./services/bandwidth";
import { resetPurgeLog } from './services/varnish';
import { resetDB, createRelationsBetweenTables } from "./utils/resetDB";
import {Sdk, Blockchain, validChains, WalletUtils, http} from "media-sdk";
import { CaddyController } from "./controllers/caddyController";
import { checkEvents } from "./services/events";
import {env} from "./config/env";
import {networks} from "./config/networks";
import {providerState} from "./models/providerState"
import ExpressProvider from "./services/ExpressProvider"

let lastReadBlock: { [key: string]: string } = {};

interface Network {
    id: string;
    URL?: string;
}

const init = async (network: Network, address: string, privateKey: string): Promise<boolean> => {
    let databaseInitStatus = true;
    let caddyInitStatus = true;
    let bandwidthInitStatus = true;
    let blockReadStatus = true;

    const resetIndex = process.argv.indexOf('--reset');

    let sdk = new Sdk({ chain: validChains[network.id], transport: [http(network.URL)] });

    if (resetIndex !== -1) {
        try {
            await resetDB();
        } catch (e) {
            console.log("Error syncing db", e);
            databaseInitStatus = false;
        }

        try {
            await CaddyController.initApps();
        } catch (e) {
            console.log("Error syncing caddy", e);
            caddyInitStatus = false;
        }
    }

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

const filteredNetworks = (ids: number[], networks: any[]): any[] => {
    return networks.filter(element => ids.includes(element.id));
}

async function start() {
    await createRelationsBetweenTables();
    for (let i = 0; i < env.providers.length; i++) {
        let address: `0x${string}`;
        let privateKey: `0x${string}`;

        //Infer usage between mnemonic and private key. Mnemonic preferred.
        if(env.providers[i].mnemonic) {
            const hdKey = await WalletUtils.mnemonicToHDAccount(env.providers[i].mnemonic);
            address = hdKey.address
            const privateKeyUnformatted = hdKey.getHdKey().privateKey
            if(!privateKeyUnformatted) {
                throw new Error("Private key not available, check your config/env.ts file and make sure you have a valid mnemonic");
            }

            privateKey = Buffer.from(privateKeyUnformatted).toString("hex") as `0x${string}`;

            providerState[address] = {privateKey: privateKey};
        }

        else {
            const account = await WalletUtils.privateKeyToAccount(env.providers[i].privateKey);
            address = account.address
            privateKey = env.providers[i].privateKey
            providerState[address] = {privateKey: privateKey};
        }



        const networksFiltered = filteredNetworks(env.providers[i].supportedChains, networks);
        for (const CURRENT_NETWORK of networksFiltered) {
            console.log(CURRENT_NETWORK);

            let initResult = await init(CURRENT_NETWORK, address, privateKey);
            if (initResult) {
                console.log("Edge started correctly");
            }

            if (lastReadBlock[CURRENT_NETWORK.id] !== "0") {
                console.log("Start to check events");
                setInterval(async () => {
                    try {
                        let getLastBlock = await checkEvents(BigInt(lastReadBlock[CURRENT_NETWORK.id]), CURRENT_NETWORK, privateKey, address);
                        lastReadBlock[CURRENT_NETWORK.id] = getLastBlock ? getLastBlock : lastReadBlock[CURRENT_NETWORK.id];
                    } catch (e) {
                        console.log("Something failed while checking events", e);
                    }
                }, 60000);
            }

            checkQueue(privateKey);

            setInterval(async () => {
                await checkCaddy(privateKey);
            }, 60000);

            setInterval(async () => {
                console.log("Start checking bandwidth");
                await checkBandwidth();
            }, 60000);

            setInterval(async () => {
                await resetPurgeLog();
            }, 24 * 7 * 60 * 60 * 1000);
        }
    }
}

start()
.then(() => {
    console.log("Started");
    ExpressProvider.init()
})