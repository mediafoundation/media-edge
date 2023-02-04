const config = require('../config/env')
const web3 = require('web3');
const crypto = require('crypto');
const ethSigUtil = require('@metamask/eth-sig-util');
const Resources = require('../evm-contract/build/contracts/Resources.json')

module.exports = (sequelize, DataTypes) => {

    const Evm = sequelize.define('Evm', {
            account: DataTypes.STRING,
            resource_id: DataTypes.STRING,
            origin: DataTypes.STRING,
            wallet: DataTypes.STRING,
            domain: DataTypes.STRING,
            path: DataTypes.STRING,
            protocol: DataTypes.STRING,
            label: DataTypes.STRING,
            network: DataTypes.STRING,
        }, {freezeTableName: true}
    )

    const ethSigDecrypt = async (encryptedData, privateKey) => {

        let decrypt = await ethSigUtil.decrypt({
            encryptedData: JSON.parse(Buffer.from(encryptedData.slice(2), 'hex').toString('utf8')),
            privateKey: privateKey
        });
        return decrypt;
    }

    const decrypt = async (key, iv, tag, resourceData) => {
        let decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(key, 'base64'),
            Buffer.from(iv, "base64")
        );
        decipher.setAuthTag(Buffer.from(tag, "base64"));
        let decrypted = decipher.update(resourceData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    Evm.getPaginatedResources = async (contract, start, count) => {
        let resources = []

        let paginatorIndex = start
        let steps = count


        try {
            let result = await contract.methods.getPaginatedResources(config.WALLET, paginatorIndex, steps).call()
            resources.push(...result._resources)

            if(result._totalResources > resources.length){
                console.log("In if")
                let totalResources = result._totalResources
                for (let i = 1; i * steps < totalResources; i++) {
                    console.log(i * steps, steps)
                    let result = await contract.methods.getPaginatedResources(config.WALLET, steps * i, steps).call()
                    result._resources.forEach(resource => {
                        resources.push(ethSigDecrypt(resource, config.PRIVATE_KEY))
                    })
                }

                if(totalResources > resources.length){
                    let result = await contract.methods.getPaginatedResources(config.WALLET, resources.length, totalResources > resources.length).call()
                    result._resources.forEach(resource => {
                        resources.push(ethSigDecrypt(resource, config.PRIVATE_KEY))
                    })
                }
            }

            return resources
        } catch (error) {
            console.log(error);
        }
    }

    Evm.sync({force: true})
    return Evm

}