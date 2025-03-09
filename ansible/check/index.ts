import { WalletUtils } from "media-sdk";
import { getEncryptionPublicKey } from "@metamask/eth-sig-util";
import { Sdk, Marketplace, validChains } from "media-sdk";

import util from "util";

import fs from "fs";
import { parse } from "yaml";

const file = fs.readFileSync("../user_config.yml", "utf8");

const env = parse(file);

//console.log(util.inspect(env, {showHidden: false, depth: null, colors: true}))

const sdk = new Sdk({ chain: validChains[11155111] });

const marketplace = new Marketplace(sdk);

const init = async (): Promise<void> => {
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
    const publicKey = getEncryptionPublicKey(privateKey.slice(2));

    console.log("Staking Address: ", address);
    console.log("Decryption Address: ", account.address);
    console.log("Decryption Private Key: ", privateKey);
    console.log("Decryption Public Key: ", publicKey);

    const isRegistered = await marketplace.view("isRegisteredProvider", [
      1,
      address,
    ]);

    if (!isRegistered) {
      console.log("Provider not registered");
    } else {
      const providerData = await marketplace.view("getProvider", [1, address]);
      if (providerData.publicKey === publicKey) {
        console.log("Provider registered correctly, encryption key matches");
      } else {
        console.log("Provider registered but encryption key does not match");
      }
      //console.log(JSON.parse(providerData.metadata));
    }
    console.log("----------------------");
  }
};

init();
