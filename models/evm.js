const config = require('../config/env')
const crypto = require('crypto');
const ethSigUtil = require('@metamask/eth-sig-util');
const {idle_in_transaction_session_timeout} = require("pg/lib/defaults");
const {noRawAttributes} = require("sequelize/lib/utils/deprecations");

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

        return ethSigUtil.decrypt({
            encryptedData: JSON.parse(Buffer.from(encryptedData.slice(2), 'hex').toString('utf8')),
            privateKey: privateKey
        });
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
                resource_id: resource.resource_id
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

    Evm.formatDataToDb = (resource_id, owner, data) => {
        let parsedData = JSON.parse(data)
        parsedData.resource_id = resource_id
        parsedData.owner = owner
        parsedData.label = parsedData.label ? parsedData.label : ""
        parsedData.protocol = parsedData.protocol ? parsedData.protocol : ""
        parsedData.origin = parsedData.origin ? parsedData.origin : ""
        parsedData.path = parsedData.path ? parsedData.path : ""
        parsedData.domain = parsedData.domain ? parsedData.domain : ""

        return parsedData
    }

    Evm.compareBlockchainAndDbData = async (blockchainIds) => {
        let difference = [];
        let rawDbResources = await Evm.findAll({attributes: ['resource_id']})
        let dbResourcesIds = rawDbResources.map(row => row.resource_id)
        let set1 = new Set(blockchainIds);
        for (let i = 0; i < dbResourcesIds.length; i++) {
            if (!set1.has(dbResourcesIds[i])) {
                difference.push(dbResourcesIds[i]);
            }
        }
        return difference;

    }

    Evm.deleteRecords = async (ids) => {
        for (const id of ids) {
            let row = await Evm.findOne({where: {["resource_id"] : id}})
            await row.destroy()
        }
    }

    Evm.sync({force: false})
    return Evm

}