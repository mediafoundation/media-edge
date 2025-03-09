import {Client} from "@elastic/elasticsearch";

import {env} from "../config/env";

import axios from "axios";

import {BandwidthsLog} from "../models/BandwidthsLog";

import {DealsController} from "./dealsController";


const caddyApiHeaders = {
    headers: {
        'Content-Type': 'application/json'
    }
}
export class BandwidthController {

    static async getBandwidthFromElastic(bandwidthLog)  {
        const client = new Client({ node: env.elasticsearch_url });

        // Set the time range for the query based on the bandwidth's updatedAt field
        const now = new Date();
        const bandwidthTimeStamp = new Date(bandwidthLog.last_read * 1000)
        const range = {
            gte: bandwidthTimeStamp.toISOString(),
            lte: now.toISOString(),
        };

        if(env.debug) {
            /*console.log("BandwidthTimeStamp:", bandwidthTimeStamp)
            console.log("Bandwidht from db:", bandwidthLog.last_read)
            console.log("Range:", range)*/
        }
        // Elasticsearch query to fetch the bandwidth usage for the specific deal
        const query = {
            index: 'caddy-*',
            body: {
                query: {
                    bool: {
                        filter: [
                            { term: { 'parsed_data.resp_headers.X-Deal-Id': bandwidthLog.dealId } },
                            { range: { 'parsed_data.@timestamp': range } },
                        ],
                    },
                },
                size:0,
                aggs: {
                    total_bytes: { sum: { field: 'parsed_data.size' } },
                },
            },
        };

        try {
            const response: any = await client.search(query);
            //console.log("Response from elastic:", response)
            const totalBytes = parseInt(response.aggregations.total_bytes.value);
            return { totalBytes, range };
        } catch (error) {
            console.error(`Error fetching bandwidth usage for deal ${bandwidthLog.dealId}:`, error);
            return { totalBytes: 0, range };
        }
    };

    static async convertToBytes (bandwidthLimit) {
        const { amount, unit } = bandwidthLimit;
        let bytes;

        switch (unit.toLowerCase()) {
            case 'pb':
                bytes = amount * Math.pow(1024, 5);
                break;
            case 'tb':
                bytes = amount * Math.pow(1024, 4);
                break;
            case 'gb':
                bytes = amount * Math.pow(1024, 3);
                break;
            case 'mb':
                bytes = amount * Math.pow(1024, 2);
                break;
            default:
                throw new Error(`Invalid bandwidth unit: ${unit}`);
        }

        return bytes;
    }
    // This function checks the bandwidth of all deals using elasticsearch,
    // updates the db and applies the header to the Caddyfile
    static async updateBandwidthUsage () {
        let bandwidthsLogs: any = await BandwidthsLog.findAll()
        let dealsToBeUpdated = []
        for (const bandwidthsLog of bandwidthsLogs) {

            // Fetch the bandwidth usage from Elasticsearch
            //if(env.debug) console.log("Bandwidth before all:", bandwidthsLog)
            const { totalBytes, range } = await this.getBandwidthFromElastic(bandwidthsLog);

            //if(env.debug) console.log("Total bytes for deal", bandwidthsLog.dealId, ":", totalBytes)

            let bandwidthUsage = parseInt(bandwidthsLog.bytes_sent) + totalBytes

            // Update the resource with the new bandwidth usage
            //if(env.debug) console.log("Updating bandwidth:", bandwidthUsage)
            //if(env.debug) console.log("Updating last_read:", range.lte, new Date(range.lte).getTime())
            let newDatetime = new Date(range.lte)
           // if(env.debug) console.log("last read new value:", Math.floor(newDatetime.getTime() / 1000))

            await bandwidthsLog.update({
                bytes_sent: bandwidthUsage,
                last_read: Math.floor(newDatetime.getTime() / 1000),
            });


            // Extract the bandwidthLimit from the deal's metadata
            let deal = await DealsController.getDealById(bandwidthsLog.dealId)

            const bandwidthLimit = deal.BandwidthLimit;
            //if(env.debug) console.log("Bandwidth limit:", bandwidthLimit)

            // Calculate the bandwidth limit in bytes
            let limitInBytes = await this.convertToBytes(bandwidthLimit);

            // Check if the bandwidth limit has been reached
            if (bandwidthUsage >= limitInBytes && bandwidthsLog.is_limited === false) {
                // Update the Caddy resource configuration to apply the bandwidth limiter
                await this.applyBandwidthLimiter(bandwidthsLog, true);
                await bandwidthsLog.update({
                    is_limited: true,
                })
                dealsToBeUpdated.push(bandwidthsLog)
            }
        }

        return dealsToBeUpdated

    }


    // This function applies or remove the X-Bandwidth-Limit header to Caddyfile
    static async applyBandwidthLimiter (bandwidthsLog, enable) {
        try {
            if(env.debug) console.log("Applying bandwidth limit to deal:", bandwidthsLog.dealId);
            const dealURL = `${env.caddy_url}id/${bandwidthsLog.dealId}`;
            const config = await axios.get(dealURL);
            const resource = config.data;

            // set the headersHandler to the referenced resource
            let headersHandler = resource.handle[0].routes[0].handle.find(
                (handler) => handler.handler === 'headers'
            );
            if (enable) {
                // if the record has no headersHandler, create a new one
                if (!headersHandler) {
                    headersHandler = {
                        "handler": "headers",
                        "response": {
                            "set": {}
                        }
                    };
                    resource.handle[0].routes[0].handle.unshift(headersHandler);
                }
                headersHandler.response.set["X-Bandwidth-Limit"] = ["Yes"];
            } else {
                if (headersHandler) {
                    delete headersHandler.response.set["X-Bandwidth-Limit"];
                }
            }
            // send the modified resource
            await axios.put(dealURL, resource, caddyApiHeaders);
            if(env.debug) console.log(`Bandwidth limiter ${enable ? 'enabled' : 'disabled'} for deal ${bandwidthsLog.dealId}`);

            //Making purge for axios


        } catch (err) {
            console.error(`Error updating deal ${bandwidthsLog.dealId}:`, err.message);
        }
    }

    // This function disables the X-Bandwidth-Limit from Caddyfile for a single deal.
    static async removeBandwidthHeader (dealId){

        const dealURL = `${env.caddy_url}id/${dealId}`;
        const config = await axios.get(
            dealURL,
            caddyApiHeaders
        );
        const resource = config.data;
        const headersHandler = resource.handle[0].routes[0].handle.find(
            (handler) => handler.handler === 'headers'
        );

        if (headersHandler) {
            delete headersHandler.response.set["X-Bandwidth-Limit"];
            await axios.put(dealURL, resource, caddyApiHeaders);
        }

        if(env.debug) console.log(`Reset bandwidth usage for deal ${dealId}`);
    }

    static async upsertRecord (bandwidthsLog) {
        try {
            // This will either create a new record or update the existing one
            const [record, created] = await BandwidthsLog.upsert(bandwidthsLog, {
                returning: true // This option asks Sequelize to return the updated/created record
            });
            if (created) {
                if(env.debug) console.log("Created record in Bandwidth table for deal: ", bandwidthsLog.dealId);
            }
            return record;
        } catch (err) {
            console.error('Error in DealsBandwidth.upsertRecord: ', err);
            throw err;
        }
    }

    static async deleteRecords (ids){
        try {
            const deletedRows = await BandwidthsLog.destroy({
                where: {
                    dealId: ids
                }
            });
            if(env.debug) console.log("Number of deals deleted: ", deletedRows);
        } catch (err) {
            console.error("Error deleting deals: ", err);
        }
    }

    // This function retrieves all deals from bandwidth db and resets the bandwidth if required
    static async resetBandwidthLimitPeriods(){
        let now = new Date().getTime()
        let bandwidthRecords: any = await BandwidthsLog.findAll({ raw:true })
        let dealsToBeUpdated = []
        for (const record of bandwidthRecords) {
            if(now >= record.period_end && record.is_limited === true){
                if(env.debug) console.log("Resetting bandwidth record:", record.id)
                await BandwidthsLog.update({
                    bytes_sent: 0,
                    period_end: parseInt(String((record.period_end / record.periods) * record.periods + 1)),
                    periods: record.periods + 1,
                    is_limited: false
                }, {
                    where: { id: record.id }
                })
                await this.removeBandwidthHeader(record.id)
                dealsToBeUpdated.push(record)
            }
        }

        return dealsToBeUpdated
    }

    static async isBillingPeriodElapsed(dealsBandwidthLimit, bandwidthsLog){
        const now = new Date();
        const elapsedTime = now.getTime() - (bandwidthsLog.last_read * 1000);
        const minimumDurationInMilliseconds = dealsBandwidthLimit.minDuration * 1000;
        return elapsedTime >= minimumDurationInMilliseconds;
    }

    static calculatePeriodEnd(deal){
        let period_end = 0
        let billingStart = Number(deal.billingStart)
        switch (deal.BandwidthLimit.period) {
            case 'hourly':
                period_end = billingStart + 3600
                break
            case 'daily':
                period_end = billingStart + 86400
                break
            case 'monthly':
                const oneMonthLater = new Date(billingStart * 1000);
                oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                period_end = oneMonthLater.getTime() / 1000
                break
            case 'yearly':
                const oneYearLater = new Date(billingStart * 1000);
                oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

                period_end = oneYearLater.getTime() / 1000
                break
        }

        return period_end
    }


    static async formatDataToDb (deal){
        return {
            dealId: deal.id,
            bytes_sent: 0,
            last_read: Number(deal.billingStart),
            period_end: this.calculatePeriodEnd(deal)
        }
    }

    static async getRecordsFromDb (){
        try{
            return await BandwidthsLog.findAll({raw: true})
        } catch(e){
            console.error("Error fetching records from bandwidth:", e);
        }
    }
}