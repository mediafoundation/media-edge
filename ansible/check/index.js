"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const media_sdk_1 = require("media-sdk");
const eth_sig_util_1 = require("@metamask/eth-sig-util");
const media_sdk_2 = require("media-sdk");
const fs_1 = __importDefault(require("fs"));
const yaml_1 = require("yaml");
const file = fs_1.default.readFileSync("../user_config.yml", "utf8");
const env = (0, yaml_1.parse)(file);
//console.log(util.inspect(env, {showHidden: false, depth: null, colors: true}))
const init = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log(`Detected ${env.providers.length} provider(s)`);
    console.log("--------------------------------------------");
    for (let i = 0; i < env.providers.length; i++) {
        const provider = env.providers[i];
        console.log(`\nProvider #${i + 1}`);
        console.log("----------------------");
        let privateKey;
        let account;
        //Infer usage between mnemonic and private key. Mnemonic preferred.
        if (provider.mnemonic) {
            account = yield media_sdk_1.WalletUtils.mnemonicToHDAccount(provider.mnemonic, provider.addressIndex);
            const arrayBuffer = account.getHdKey().privateKey;
            privateKey = `0x${Buffer.from(arrayBuffer).toString("hex")}`;
        }
        else if (provider.privateKey) {
            account = yield media_sdk_1.WalletUtils.privateKeyToAccount(provider.privateKey);
            privateKey = provider.privateKey;
        }
        else {
            throw new Error("No mnemonic or private key found in user_config.yml");
        }
        const address = provider.wallet_address
            ? provider.wallet_address
            : account.address;
        const publicKey = (0, eth_sig_util_1.getEncryptionPublicKey)(privateKey.slice(2));
        console.log("Staking Address: ", address);
        console.log("Decryption Address: ", account.address);
        console.log("Decryption Private Key: ", privateKey);
        console.log("Decryption Public Key: ", publicKey);
        console.log("----------------------");
        if ((provider === null || provider === void 0 ? void 0 : provider.supportedChains) && ((_a = provider === null || provider === void 0 ? void 0 : provider.supportedChains) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            console.log(`\nFound ${provider.supportedChains.length} chain(s) for Provider #${i + 1}`);
            console.log("----------------------");
            const supportedChains = {};
            for (const chain of provider.supportedChains) {
                supportedChains[chain.id] = media_sdk_2.validChains[chain.id];
                if ((_b = supportedChains[chain.id]) === null || _b === void 0 ? void 0 : _b.name) {
                    const vanityName = `${supportedChains[chain.id].name} (${chain.id})`;
                    let transport = undefined;
                    if (chain.URL) {
                        transport = [(0, media_sdk_1.http)(chain.URL)];
                    }
                    const sdk = new media_sdk_2.Sdk({
                        chain: supportedChains[chain.id],
                        transport
                    });
                    const marketplace = new media_sdk_2.Marketplace(sdk);
                    try {
                        const isRegistered = yield marketplace.view("isRegisteredProvider", [
                            1,
                            address,
                        ]);
                        if (!isRegistered) {
                            console.log(`${vanityName}: Error! Provider not registered`);
                        }
                        else {
                            const providerData = yield marketplace.view("getProvider", [1, address]);
                            if (providerData.publicKey === publicKey) {
                                console.log(`${vanityName}: Success! Provider registered correctly, encryption key matches.`);
                            }
                            else {
                                console.log(`${vanityName}: Error! Provider registered but encryption key does not match.`);
                                console.log("Expected: ", providerData.publicKey);
                                console.log("Actual: ", publicKey);
                            }
                            //console.log(JSON.parse(providerData.metadata));
                        }
                    }
                    catch (e) {
                        console.log(`${vanityName}: Error! Could not get provider status. Try with another RPC endpoint. Current URL: ${chain.URL ? chain.URL : supportedChains[chain.id].rpcURL}`);
                    }
                }
                else {
                    console.log(`Error! Chain ID ${chain.id} not found in validChains`);
                }
            }
        }
        else {
            console.log(`Error! No chains found for Provider #${i + 1}`);
        }
        console.log("----------------------");
    }
});
init();
