const config = require('../config/env')
const web3 = require('web3');
const crypto = require('crypto');
const ethSigUtil = require('@metamask/eth-sig-util');
const Resources = require('../evm-contract/build/contracts/Resources.json')

module.exports = (sequelize, DataTypes) => {

    const Evm = sequelize.define('Evm', {
            resource_id: DataTypes.STRING,
            owner: DataTypes.STRING,
            label: DataTypes.STRING,
            protocol: DataTypes.STRING,
            origin: DataTypes.STRING,
            path: DataTypes.STRING,
            domain: DataTypes.STRING,
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

        console.log("Prueba de", await contract.methods.getResource(0, config.WALLET).call())
        let resources = []

        let paginatorIndex = start
        let steps = count


        try {
            let result = await contract.methods.getPaginatedResources(config.WALLET, paginatorIndex, steps).call()
            //resources.push(...result._resources)
            for (const resource of result._resources) {
                let attr = JSON.parse(resource.encryptedData)
                let decryptedSharedKey = await ethSigDecrypt(
                    resource.encryptedSharedKey,
                    config.PRIVATE_KEY
                );

                let decrypted = await decrypt(
                    decryptedSharedKey,
                    attr.iv,
                    attr.tag,
                    attr.encryptedData
                );

                resources.push({resource_id: resource.id, owner: resource.owner, data: decrypted})
            }

            if(result._totalResources > resources.length){
                let totalResources = result._totalResources
                for (let i = 1; i * steps < totalResources; i++) {
                    let result = await contract.methods.getPaginatedResources(config.WALLET, steps * i, steps).call()
                    for (const resource of result._resources) {
                        let attr = JSON.parse(resource.encryptedData)
                        let decryptedSharedKey = await ethSigDecrypt(
                            resource.encryptedSharedKey,
                            config.PRIVATE_KEY
                        );

                        let decrypted = await decrypt(
                            decryptedSharedKey,
                            attr.iv,
                            attr.tag,
                            attr.encryptedData
                        );

                        resources.push({resource_id: resource.id, owner: resource.owner, data: decrypted})
                    }
                }

                if(totalResources > resources.length){
                    let result = await contract.methods.getPaginatedResources(config.WALLET, resources.length, totalResources - resources.length).call()
                    for (const resource of result._resources) {
                        let attr = JSON.parse(resource.encryptedData)
                        let decryptedSharedKey = await ethSigDecrypt(
                            resource.encryptedSharedKey,
                            config.PRIVATE_KEY
                        );

                        let decrypted = await decrypt(
                            decryptedSharedKey,
                            attr.iv,
                            attr.tag,
                            attr.encryptedData
                        );

                        resources.push({resource_id: resource.id, owner: resource.owner, data: decrypted})
                    }
                }
            }

            return resources
        } catch (error) {
            console.log(error);
        }

        return resources
    }

    Evm.addRecord = async (resource) => {
        let evm_record = await Evm.findOne({
            where: {
                id: resource.id
            }
        })
        if(evm_record){
            await evm_record.set(resource)
            evm_record.save()
        } else {
            evm_record = await Evm.create(resource)
            console.log("Created resource in evm table")
        }
        return evm_record
    }

    Evm.sync({force: true})
    return Evm

}