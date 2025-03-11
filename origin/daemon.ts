import { env } from "./config/env";
import { initDatabase } from "./services/database";
import { initCaddy, checkQueue, checkCaddy } from "./services/caddy";
import { checkBandwidth, initBandwidth } from "./services/bandwidth";
import { resetPurgeLog } from './services/varnish';
import { resetDB, createRelationsBetweenTables } from "./utils/resetDB";
import { Sdk, Blockchain, validChains, WalletUtils, http } from "media-sdk";
import { CaddyController } from "./controllers/caddyController";
import { checkEvents } from "./services/events";
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
    for (const provider of env.providers) {
        let privateKey: `0x${string}`;
        let account: any;
        //Infer usage between mnemonic and private key. Mnemonic preferred.
        if (provider.mnemonic) {
          account = await WalletUtils.mnemonicToHDAccount(
            provider.mnemonic,
            provider.addressIndex
          );
          const arrayBuffer = account.getHdKey().privateKey as Uint8Array;
          privateKey = `0x${Buffer.from(arrayBuffer).toString("hex")}`;
        } else if (provider.privateKey) {
          account = await WalletUtils.privateKeyToAccount(
            provider.privateKey
          );
          privateKey = provider.privateKey;
        } else {
          throw new Error("No mnemonic or private key found in user_config.yml");
        }
        const address = provider.wallet_address
          ? provider.wallet_address
          : account.address;

        providerState[address] = {privateKey: privateKey};
        providerData[privateKey] = provider;


        const networks = provider.supportedChains;
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
        const updatedDomains = provider.domains.map((domain: Domain) => ({
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