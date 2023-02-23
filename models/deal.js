const config = require('../config/env')
const crypto = require('crypto');
const ethSigUtil = require('@metamask/eth-sig-util');
const Web3RequestManager = require('web3-core-requestmanager');
const {BigNumber} = require("ethers");

module.exports = (sequelize, DataTypes) => {

    const Deals = sequelize.define('Deals', {
            id: {type: DataTypes.STRING, primaryKey: true},
            offerId: DataTypes.STRING,
            client: DataTypes.STRING,
            provider: DataTypes.STRING,
            resourceId: DataTypes.STRING,
            totalBlockedBalance: DataTypes.STRING,
            blockedBalance: DataTypes.STRING,
            pricePerSecond: DataTypes.STRING,
            minDuration: DataTypes.STRING,
            startTime: DataTypes.STRING,
            endTime: DataTypes.STRING,
            active: DataTypes.STRING,
            cancelled: DataTypes.STRING,
            metadata: DataTypes.STRING,
            domains: DataTypes.STRING
        }, {freezeTableName: true}
    )

    Deals.getPaginatedDeals = async (contract, start, count) => {
        let deals = []

        let paginatorIndex = start
        let steps = count

        try {
            let result = await contract.methods.getPaginatedDeals(config.WALLET, true, paginatorIndex, steps).call()

            //console.log("Deal 1: ", result._deals)
            deals.push(...result._deals)

            if(result._totalDeals > deals.length){
                let totalDeals = result._totalDeals
                for (let i = 1; i * steps < totalDeals; i++) {
                    let result = await contract.methods.getPaginatedDeals(config.WALLET, true, steps * i, steps).call()
                    deals.push(...result._deals)
                }

                if(totalDeals > deals.length){
                    let result = await contract.methods.getPaginatedDeals(config.WALLET, true, deals.length, totalDeals - deals.length).call()
                    deals.push(...result._deals)
                }
            }

            return deals
        } catch (error) {

            //console.log(Web3RequestManager.Manager.)
        }
    }

    Deals.dealIsActive = async (deal) => {
        let unixTime = BigNumber.from(Math.floor(Date.now() / 1000));
        let elapsedTime = unixTime.sub(deal.startTime);
        let totalTime = BigNumber.from(deal.blockedBalance).div(deal.pricePerSecond);
        totalTime.sub(elapsedTime);
        let calculatedEnd = BigNumber.from(deal.startTime).add(totalTime);
        let d = new Date(calculatedEnd * 1000);
        const pad2 = (n) => { return (n < 10 ? '0' : '') + n }
        let formattedCalculatedEnd = pad2(d.getFullYear()) + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
        console.log("Formatted calculated end ", formattedCalculatedEnd)

        return Date.parse(formattedCalculatedEnd) > Date.now()
    }

    Deals.addRecord = async (deal) => {
        let deal_record = await Deals.findOne({
            where: {
                id: deal.id
            }
        })
        if(deal_record){
            await deal_record.set(deal)
            deal_record.save()
        } else {
            deal_record = await Deals.create(deal)
            console.log("Created resource in evm table: ", deal.id)
        }
        return deal_record
    }

    Deals.deleteRecords = async (ids) => {
        for (const id of ids) {
            console.log("Deleted resource in deals table: ", id)
            let row = await Deals.findOne({where: {["id"] : id}})
            await row.destroy()
        }
    }

    Deals.formatDataToDb = (deal) => {
        let parsedData = {}
        parsedData.id = deal.id
        parsedData.offerId = deal.offerId
        parsedData.client = deal.client
        parsedData.provider = deal.provider
        parsedData.resourceId = deal.resourceId
        parsedData.totalBlockedBalance = deal.totalBlockedBalance
        parsedData.blockedBalance = deal.blockedBalance
        parsedData.pricePerSecond = deal.pricePerSecond
        parsedData.minDuration = deal.minDuration
        parsedData.startTime = deal.startTime
        parsedData.endTime = deal.endTime ? deal.endTime : ""
        parsedData.active = deal.active
        parsedData.cancelled = deal.cancelled
        parsedData.metadata = deal.metadata
        parsedData.domains = JSON.stringify(deal.domains)

        return parsedData
    }

    Deals.compareDealsResourcesWithResources = async (dealsIds, resourcesIds) => {
        let difference = [];
        let set1 = new Set(dealsIds);
        for (let i = 0; i < resourcesIds.length; i++) {
            if (!set1.has(resourcesIds[i])) {
                difference.push(resourcesIds[i]);
            }
        }
        return difference;
    }

    Deals.compareBlockchainAndDbData = async (blockchainIds) => {
        let difference = [];
        let rawDbDeals = await Deals.findAll({attributes: ['id']})
        let dbDealsIds = rawDbDeals.map(row => row.id)
        let set1 = new Set(blockchainIds);
        for (let i = 0; i < dbDealsIds.length; i++) {
            if (!set1.has(dbDealsIds[i])) {
                difference.push(dbDealsIds[i]);
            }
        }
        return difference;

    }

    Deals.sync({force: false})
    return Deals

}