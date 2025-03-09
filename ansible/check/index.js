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
const util_1 = __importDefault(require("util"));
const fs_1 = __importDefault(require("fs"));
const yaml_1 = require("yaml");
const file = fs_1.default.readFileSync("../user_config.yml", "utf8");
const env = (0, yaml_1.parse)(file);
console.log(util_1.default.inspect(env, { showHidden: true, depth: null, colors: true }));
const sdk = new media_sdk_2.Sdk({ chain: media_sdk_2.validChains[11155111] });
const marketplace = new media_sdk_2.Marketplace(sdk);
const init = () => __awaiter(void 0, void 0, void 0, function* () {
    for (const provider of env.providers) {
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
        const publicKey = (0, eth_sig_util_1.getEncryptionPublicKey)(privateKey.slice(2));
        const address = provider.wallet_address
            ? provider.wallet_address
            : account.address;
        console.log("Staking Address: ", address);
        console.log("Decryption Address: ", account.address);
        console.log("Decryption Private Key: ", privateKey);
        console.log("Decryption Public Key: ", publicKey);
        const isRegistered = yield marketplace.view("isRegisteredProvider", [
            1,
            address,
        ]);
        if (!isRegistered) {
            console.log("Provider not registered");
        }
        else {
            const providerData = yield marketplace.view("getProvider", [1, address]);
            if (providerData.publicKey === publicKey) {
                console.log("Provider registered correctly, encryption key matches");
            }
            else {
                console.log("Provider registered but encryption key does not match");
            }
            //console.log(JSON.parse(providerData.metadata));
        }
        console.log("----------------------");
    }
});
init();
