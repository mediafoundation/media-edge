import { http, WalletUtils } from "media-sdk";
import { getEncryptionPublicKey } from "@metamask/eth-sig-util";
import { Sdk, Marketplace, validChains } from "media-sdk";

import util from "util";

import fs from "fs";
import { parse } from "yaml";

const file = fs.readFileSync("../user_config.yml", "utf8");

const env = parse(file);

//console.log(util.inspect(env, {showHidden: false, depth: null, colors: true}))

const init = async (): Promise<void> => {
  
  console.log(`Detected ${env.providers.length} provider(s)`);
  console.log("--------------------------------------------");
  for (let i = 0; i < env.providers.length; i++) {
    const provider = env.providers[i];
    console.log(`\nProvider #${i+1}`);
    console.log("----------------------");
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
    console.log("----------------------");

    if(provider?.supportedChains && provider?.supportedChains?.length > 0) {

      console.log(`\nFound ${provider.supportedChains.length} chain(s) for Provider #${i+1}`);
      console.log("----------------------");

      const supportedChains: any = {};

      for (const chain of provider.supportedChains) {

        supportedChains[chain.id] = validChains[chain.id as keyof typeof validChains];
        if(supportedChains[chain.id]?.name) {
          const vanityName = `${supportedChains[chain.id].name} (${chain.id})`;
          let transport = undefined;
          if (chain.URL) {
            transport = [http(chain.URL)];
          }
          const sdk = new Sdk({ 
            chain: supportedChains[chain.id], 
            transport 
          });

          const marketplace = new Marketplace(sdk);

          try {
            const isRegistered = await marketplace.view("isRegisteredProvider", [
              1,
              address,
            ]);
        
            if (!isRegistered) {
              console.log(`${vanityName}: Error! Provider not registered`);
            } else {
              const providerData = await marketplace.view("getProvider", [1, address]);
              if (providerData.publicKey === publicKey) {
                console.log(`${vanityName}: Success! Provider registered correctly, encryption key matches.`);
              } else {
                console.log(`${vanityName}: Error! Provider registered but encryption key does not match.`);
                console.log("Expected: ", providerData.publicKey);
                console.log("Actual: ", publicKey);
              }
              //console.log(JSON.parse(providerData.metadata));
            }
          } catch (e) {
            console.log(`${vanityName}: Error! Could not get provider status. Try with another RPC endpoint. Current URL: ${chain.URL ? chain.URL : supportedChains[chain.id].rpcURL}`);
          }
        } else {
          console.log(`Error! Chain ID ${chain.id} not found in validChains`);
        }
      }
    } else {
      console.log(`Error! No chains found for Provider #${i+1}`);
    }
    console.log("----------------------");
  }
};

init();
