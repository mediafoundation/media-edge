const env = require('../config/env')
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
            minDuration: DataTypes.BIGINT,
            billFullPeriods: DataTypes.BOOLEAN,
            createdAt: DataTypes.BIGINT,
            acceptedAt: DataTypes.BIGINT,
            billingStart: DataTypes.BIGINT,
            active: DataTypes.BOOLEAN,
            cancelled: DataTypes.BOOLEAN,
            cancelledAt: DataTypes.BIGINT,
            metadata: DataTypes.STRING,
            network: DataTypes.STRING
        }, {freezeTableName: true}
    )

    Deals.getPaginatedDeals = async (contract, start, count) => {
        let deals = []

        let paginatorIndex = start
        let steps = count

        try {
            let result = await contract.methods.getPaginatedDeals(env.WALLET, true, paginatorIndex, steps).call()

            //console.log("Deal 1: ", result._deals)
            deals.push(...result._deals)

            if(result._totalDeals > deals.length){
                let totalDeals = result._totalDeals
                for (let i = 1; i * steps < totalDeals; i++) {
                    let result = await contract.methods.getPaginatedDeals(env.WALLET, true, steps * i, steps).call()
                    deals.push(...result._deals)
                }

                if(totalDeals > deals.length){
                    let result = await contract.methods.getPaginatedDeals(env.WALLET, true, deals.length, totalDeals - deals.length).call()
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

        let billingStart = deal.status ? deal.status['billingStart'] : deal.billingStart
        let elapsedTime = unixTime.sub(billingStart);
        let totalTime = BigNumber.from(deal.blockedBalance).div(deal.pricePerSecond);
        totalTime.sub(elapsedTime);
        let calculatedEnd = BigNumber.from(billingStart).add(totalTime);
        let d = new Date(calculatedEnd * 1000);
        const pad2 = (n) => { return (n < 10 ? '0' : '') + n }
        let formattedCalculatedEnd = pad2(d.getFullYear()) + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());

        return Date.parse(formattedCalculatedEnd) > Date.now()
    }

    Deals.addRecord = async (deal) => {
        console.log(deal)
        try {
            // This will either create a new record or update the existing one
            const [record, created] = await Deals.upsert(deal, {
            returning: true // This option asks Sequelize to return the updated/created record
            });
            if (created) {
            console.log("Created deal in deals table: ", deal.id);
            }
            return record;
        } catch (err) {
            console.error('Error in Deals.addRecord: ', err);
            throw err;
        }
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
                if(env.debug) console.log("Deal not found. ID", id);
            }
        }
    }

    Deals.formatDataToDb = (deal, network) => {
        let data = {}
        data.id = `${deal.id}_${network.network_id}_${network.chain_id}`
        data.offerId = deal.offerId
        data.client = deal.client
        data.provider = deal.provider
        data.resourceId = `${deal.resourceId}_${network.network_id}_${network.chain_id}`
        data.totalBlockedBalance = deal.totalBlockedBalance
        data.blockedBalance = deal.blockedBalance
        data.pricePerSecond = deal.pricePerSecond
        data.minDuration = deal.minDuration
        data.billFullPeriods = deal.billFullPeriods
        data.createdAt = deal.status['createdAt']
        data.acceptedAt = deal.status['acceptedAt']
        data.billingStart = deal.status['billingStart']
        data.active = deal.status['active']
        data.cancelled = deal.status['cancelled']
        data.cancelledAt = deal.status['cancelledAt']
        data.metadata = deal.metadata
        data.network = network.name ? network.name : ""
        return data
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
        const dealsInDb = await Deals.findAll({ 
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            },
            raw: true
        })
        return dealsInDb
    }

    Deals.getDeal = async (contract, dealId) => {
        return await contract.methods.getDeal(dealId).call()
    }

    Deals.getDealById = async(id) => {
        try{
            let deal = await Deals.findByPk(id, {raw: true})
            return deal
        } catch(e){
            console.log("Error fetching deal from db:", e);
        }
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