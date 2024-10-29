import { initDatabase } from "./services/database";
import { initCaddy, checkQueue, checkCaddy } from "./services/caddy";
import { checkBandwidth, initBandwidth } from "./services/bandwidth";
import { resetPurgeLog } from './services/varnish';
import { resetDB, createRelationsBetweenTables } from "./utils/resetDB";
import {Sdk, Blockchain, validChains, WalletUtils} from "media-sdk";
import { CaddyController } from "./controllers/caddyController";
import { checkEvents } from "./services/events";
import { toHex } from "viem";
import {env} from "./config/env";
import {networks} from "./config/networks";

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

    let sdk = new Sdk({ chain: validChains[network.id] });

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
        let blockNumber = toHex(await blockchain.getBlockNumber());
        lastReadBlock[network.id] = toHex(Number(blockNumber));
    } catch (e) {
        lastReadBlock[network.id] = toHex(0);
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
        const hdKey = await WalletUtils.mnemonicToHDAccount(env.providers[i].mnemonic);
        const address = hdKey.address
        const privateKeyUnformatted = hdKey.getHdKey().privateKey
        if(!privateKeyUnformatted) {
            throw new Error("Private key not available, check your config/env.ts file and make sure you have a valid mnemonic");
        }
        const privateKey = Buffer.from(privateKeyUnformatted).toString("hex")
        const networksFiltered = filteredNetworks(env.providers[i].supportedChains, networks);
        for (const CURRENT_NETWORK of networksFiltered) {
            console.log(CURRENT_NETWORK);

            let initResult = await init(CURRENT_NETWORK, address, privateKey);
            if (initResult) {
                console.log("Edge started correctly");
            }

            if (lastReadBlock[CURRENT_NETWORK.id] !== toHex(0)) {
                console.log("Start to check events");
                setInterval(async () => {
                    try {
                        let getLastBlock = await checkEvents(lastReadBlock[CURRENT_NETWORK.id], CURRENT_NETWORK, privateKey, address);
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

start();