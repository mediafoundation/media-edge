const { Client } = require('@elastic/elasticsearch');
const env = require("../config/env");
const axios = require("axios");

module.exports = (sequelize, DataTypes) => {

  const Bandwidth = sequelize.define('Bandwidth', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    metadata: DataTypes.STRING,
    bytes_sent: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    last_read: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    period_end: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    is_limited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    periods: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 1
    }
  }, {
    updatedAt: false,
  });
  const caddyApiHeaders = {
    headers: {
      'Content-Type': 'application/json'
    }
  }
  Bandwidth.getBandwidthFromElastic = async (deal) => {
    const client = new Client({ node: env.elasticSearchUrl });
  
    // Set the time range for the query based on the bandwidth's updatedAt field
    const now = new Date();
    const bandwidthTimeStamp = new Date(deal.last_read * 1000)
    const range = {
      gte: bandwidthTimeStamp.toISOString(),
      lte: now.toISOString(),
    };

    if(env.debug) {
      console.log("BandwidthTimeStamp:", bandwidthTimeStamp)
      console.log("Bandwidht from db:", deal.last_read)
      console.log("Range:", range)
    }
    // Elasticsearch query to fetch the bandwidth usage for the specific deal
    const query = {
      index: 'caddy-*',
      body: {
        query: {
          bool: {
            filter: [
              { term: { 'parsed_data.resp_headers.X-Deal-Id': deal.id } },
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
      const response = await client.search(query);
      const totalBytes = parseInt(response.aggregations.total_bytes.value);
      return { totalBytes, range };
    } catch (error) {
      console.error(`Error fetching bandwidth usage for deal ${deal.id}:`, error);
      return { totalBytes: 0, range };
    }
  };

  Bandwidth.convertToBytes = (bandwidthLimit) => {
    const { amount, unit } = bandwidthLimit;
    let bytes;
  
    switch (unit) {
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
  Bandwidth.updateBandwidthUsage = async () => {
    let deals = await Bandwidth.findAll({raw: true})
    for (const deal of deals) {

      // Fetch the bandwidth usage from Elasticsearch
      if(env.debug) console.log("Bandwidth before all:", deal)
      const { totalBytes, range } = await Bandwidth.getBandwidthFromElastic(deal);

      if(env.debug) console.log("Total bytes for deal", deal.id, ":", totalBytes)

      let bandwidthUsage = parseInt(bandwidth.dataValues.bytes_sent) + totalBytes

      // Update the resource with the new bandwidth usage
      if(env.debug) console.log("Updating bandwidth:", bandwidthUsage)
      if(env.debug) console.log("Updating last_read:", range.lte, new Date(range.lte).getTime())
      let newDatetime = new Date(range.lte)
      if(env.debug) console.log("last read new value:", Math.floor(newDatetime.getTime() / 1000))
      await bandwidth.update({
        bytes_sent: bandwidthUsage,
        last_read: Math.floor(newDatetime.getTime() / 1000),
      });

      // Extract the bandwidthLimit from the deal's metadata
      const metadata = JSON.parse(deal.metadata);
      const bandwidthLimit = metadata["bandwidthLimit"];
      if(env.debug) console.log("Bandwidth limit:", bandwidthLimit)

      // Calculate the bandwidth limit in bytes
      let limitInBytes = Bandwidth.convertToBytes(bandwidthLimit);

      // Check if the bandwidth limit has been reached
      if (bandwidthUsage >= limitInBytes && bandwidth.dataValues.is_limited == false) {
        // Update the Caddy resource configuration to apply the bandwidth limiter
        await Bandwidth.applyBandwidthLimiter(deal, true);
        await bandwidth.update({
          is_limited: true
        })
      } else {
        // todo: check why would we want to remove it if its already applied
        // in any case it would be removed if the next period starts.
        // Remove the bandwidth limiter if it's already applied
        //await Bandwidth.applyBandwidthLimiter(deal, false);
      }
    }

  }


  // This function applies or remove the X-Bandwidth-Limit header to Caddyfile
  Bandwidth.applyBandwidthLimiter = async (deal, enable) => {
    try {
      if(env.debug) console.log("Applying bandwidth limit to deal:", deal.id);
      const dealURL = `${env.caddyUrl}id/${deal.id}`;
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
      if(env.debug) console.log(`Bandwidth limiter ${enable ? 'enabled' : 'disabled'} for resource ${deal.id}`);

      //Making purge for axios

      
    } catch (err) {
      console.error(`Error updating resource ${deal.id}:`, err.message);
    }
  }

  // This function disables the X-Bandwidth-Limit from Caddyfile for a single deal.
  Bandwidth.removeBandwidthHeader = async (dealId) => {

    const dealURL = `${env.caddyUrl}id/${dealId}`;
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

  Bandwidth.upsertRecord = async (deal) => {
    try {
      // This will either create a new record or update the existing one
      const [record, created] = await Bandwidth.upsert(deal, {
        returning: true // This option asks Sequelize to return the updated/created record
      });
      if (created) {
        if(env.debug) console.log("Created deal in Bandwidth table: ", deal.id);
      }
      return record;
    } catch (err) {
      console.error('Error in Bandwidth.upsertRecord: ', err);
      throw err;
    }
  }

  Bandwidth.deleteRecords = async (ids) => {
    try {
      const deletedRows = await Bandwidth.destroy({
        where: { 
          id: ids
        }
      });
      if(env.debug) console.log("Number of deals deleted: ", deletedRows);
    } catch (err) {
      console.error("Error deleting deals: ", err);
    }
  }

  // This function retrieves all deals from bandwidth db and resets the bandwidth if required
  Bandwidth.resetBandwidthLimitPeriods = async () => {
    let now = new Date().getTime()
    let bandwidthRecords = await Bandwidth.findAll({ raw:true })
    for (const record of bandwidthRecords) {
      if(now >= record.period_end){
        if(env.debug) console.log("Reseting bandwidth record:", record.id)
        Bandwidth.update({
          bytes_sent: 0,
          period_end: (record.period_end / record.periods) * record.periods + 1, 
          periods: record.periods + 1, 
          is_limited: false
        }, {
          where: { id: record.id }
        })
        await Bandwidth.removeBandwidthHeader(record.id)
      } 
    }
  }

  Bandwidth.isBillingPeriodElapsed = (deal, bandwidth) => {
    const now = new Date();
    const elapsedTime = now.getTime() - (bandwidth.last_read * 1000);
    const minimumDurationInMilliseconds = deal.minDuration * 1000;
    return elapsedTime >= minimumDurationInMilliseconds;
  }

  Bandwidth.calculatePeriodEnd = (deal) => {
    let metadata = JSON.parse(deal.metadata)
    let period_end = 0
    let billingStart = Number(deal.billingStart)
    switch (metadata.bandwidthLimit.period) {
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

  // this function formats a deal from Deals DB to Bandwidth db format. Also copies the deal metadata (maybe formatting it instead of saving the json string would be nice)
  Bandwidth.formatDataToDb = async (deal) => {
    return {
      id: deal.id,
      metadata: deal.metadata,
      bytes_sent: 0,
      last_read: Number(deal.billingStart),
      period_end: Bandwidth.calculatePeriodEnd(deal)
    }
  }

  Bandwidth.getRecordsFromDb = async () => {
    try{
      let records = await Bandwidth.findAll({ raw: true })
      return records
    } catch(e){
      console.error("Error fetching records from bandwidth:", e);
    }
  }

  Bandwidth.sync({ force: true })
  return Bandwidth;
}