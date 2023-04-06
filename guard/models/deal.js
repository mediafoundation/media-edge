const config = require('../config/env')
const {BigNumber} = require("ethers");
const state = require("./../models/state")

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
            domains: DataTypes.STRING,
            network: DataTypes.STRING
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
            console.log("Created deal in deals table: ", deal.id)
        }
        return deal_record
    }

    Deals.deleteRecords = async (ids) => {
        for (const id of ids) {
            console.log("Deleted resource in deals table: ", id)
            let row = await Deals.findOne({
                where: { id: id }
            })
            if(row){
                await row.destroy()
                if(env.debug) console.log("Deleted deal ID: ", id)
            } else {
                if(env.debug) console.log("Could not found deal ID", id);
            }
        }
    }

    Deals.formatDataToDb = (deal, network) => {
        let parsedData = {}
        parsedData.id = deal.id + "_" + network.network_id + "_" + network.chain_id
        parsedData.offerId = deal.offerId
        parsedData.client = deal.client
        parsedData.provider = deal.provider
        parsedData.resourceId = deal.resourceId + "_" + network.network_id + "_" + network.chain_id
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
        parsedData.network = network.name ? network.name : ""

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

    Deals.getDealsFromDb = async() => {
        let deals = []
        let dealsInDb =  await Deals.findAll({attributes: {exclude: ['createdAt', 'updatedAt']}})
        dealsInDb.forEach(deal => {
            deals.push(deal.dataValues)
        })
        return deals
    }

    Deals.getDeal = async (contract, dealId) => {
        return await contract.methods.getDeal(dealId).call()
    }

    Deals.dealsThatHasResource = async (resourceId) => {
        return await Deals.findAll({
            where: {
                resourceId: resourceId
            },
            attributes: {exclude: ['createdAt', 'updatedAt']}
        })
    }

    //Deals.sync({force: state.resetDb})
    return Deals

}