const { Client } = require('@elastic/elasticsearch');
const env = require("../config/env");
const axios = require("axios");

module.exports = (sequelize, DataTypes) => {

  const Bandwidth = sequelize.define('Bandwidth', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
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
  Bandwidth.getBandwidthUsageFromElasticsearch = async (deal, bandwidth) => {
    const client = new Client({ node: 'http://localhost:9200' });
  
    // Set the time range for the query based on the bandwidth's updatedAt field
    const now = new Date();
    const bandwidthTimeStamp = new Date(bandwidth.dataValues.last_read * 1000)
    const range = {
      gte: bandwidthTimeStamp.toISOString(),
      lte: now.toISOString(),
    };

    console.log("BandwidthTimeStamp:", bandwidthTimeStamp)
    console.log("Bandwidht from db:", bandwidth.dataValues.last_read)
    console.log("Range:", range)
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
      console.error(`Error fetching bandwidth usage for deal ${deal.id}:`, error.msg);
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

  Bandwidth.updateBandwidthUsage = async (deals) => {
  
    for (const deal of deals) {
      // Fetch the bandwidth record for the deal
      const bandwidth = await Bandwidth.findByPk(deal.id);
  
      // Check if the billing period has elapsed
      //console.log("Deal", deal)

      // Fetch the bandwidth usage from Elasticsearch
      if(env.debug) console.log("Bandwidth before all:", bandwidth)
      const { totalBytes, range } = await Bandwidth.getBandwidthUsageFromElasticsearch(deal, bandwidth);

      if(env.debug) console.log("Total bytes for deal", deal.id, ":", totalBytes)

      //console.log("TotalBytes", totalBytes, "range", range)

      let bandwidthUsage = bandwidth.dataValues.bytes_sent + totalBytes

      // Update the resource with the new bandwidth usage
      //console.log(bandwidth)
      if(env.debug) console.log("Updating bandwidth:", bandwidthUsage)
      if(env.debug) console.log("Updating last_read:", range.lte, new Date(range.lte).getTime())
      let newDatetime = new Date(range.lte)
      await bandwidth.update({
        bytes_sent: bandwidthUsage,
        last_read: newDatetime.getUTCSeconds(),
      });

      // Extract the bandwidthLimit from the deal's metadata
      const metadata = JSON.parse(deal.metadata);
      const bandwidthLimit = metadata["bandwidthLimit"];
      if(env.debug) console.log("Bandwidth limit:", bandwidthLimit)

      // Calculate the bandwidth limit in bytes
      let limitInBytes = Bandwidth.convertToBytes(bandwidthLimit);

      // Check if the bandwidth limit has been reached
      if (bandwidthUsage >= limitInBytes) {
        // Update the Caddy resource configuration to apply the bandwidth limiter
        await Bandwidth.applyBandwidthLimiter(deal, true);
      } else {
        // todo: check why remove it if its already applied
        // Remove the bandwidth limiter if it's already applied
        //await Bandwidth.applyBandwidthLimiter(deal, false);
      }
    }

  }

  Bandwidth.isBillingPeriodElapsed = (deal, bandwidth) => {
    //const { minimumDuration } = deal;
    //console.log(deal.minDuration)
    const now = new Date();
    //console.log("Now time", now.getTime(), "last read", bandwidth.last_read * 1000)
    const elapsedTime = now.getTime() - (bandwidth.last_read * 1000);
    const minimumDurationInMilliseconds = deal.minDuration * 1000;

    //console.log(elapsedTime >= minimumDurationInMilliseconds, "elapsed time", elapsedTime, "minDuration", minimumDurationInMilliseconds)


    return elapsedTime >= minimumDurationInMilliseconds;
  }

  Bandwidth.resetBandwidthUsage = async (dealId) => {
    await Bandwidth.update({ bytes_sent: 0 }, { where: { id: dealId } });
  
    const config = await axios.get(`${env.caddyUrl}${dealId}`, caddyApiHeaders);
    const resource = config.data;
    const headersHandler = resource.handle[0].routes[0].handle.find(
      (handler) => handler.handler === 'headers'
    );
  
    if (headersHandler) {
      delete headersHandler.response.set["X-Bandwidth-Limit"];
      await axios.put(`${env.caddyUrl}${dealId}`, resource, caddyApiHeaders);
    }
  
    console.log(`Reset bandwidth usage for deal ${dealId}`);
  }

  Bandwidth.applyBandwidthLimiter = async (deal, enable) => {
    try {
      const config = await axios.get(`http://localhost:2019/id/${deal.id}`);
      const resource = config.data;
  
      // Parse the metadata JSON string and get the bandwidthLimit
      const metadata = JSON.parse(deal.metadata);
      const bandwidthLimit = metadata.bandwidthLimit;
  
      // Convert bandwidthLimit to bytes
      const bytesLimit = convertToBytes(bandwidthLimit);
  
      let headersHandler = resource.handle[0].routes[0].handle.find(
        (handler) => handler.handler === 'headers'
      );
  
      if (enable) {
        if (!headersHandler) {
          headersHandler = {
            "handler": "headers",
            "response": {
              "set": {}
            }
          };
          resource.handle[0].routes[0].handle.unshift(headersHandler);
        }
  
        headersHandler.response.set["X-Bandwidth-Limit"] = [bytesLimit.toString()];
      } else {
        if (headersHandler) {
          delete headersHandler.response.set["X-Bandwidth-Limit"];
        }
      }
  
      await axios.put(`http://localhost:2019/id/${deal.id}`, resource);
      console.log(`Bandwidth limiter ${enable ? 'enabled' : 'disabled'} for resource ${deal.id}`);
    } catch (err) {
      console.error(`Error updating resource ${deal.id}:`, err.message);
    }
  }

  Bandwidth.upsertRecord = async (deal) => {
    //console.log(Bandwidth.calculatePeriodEnd(deal.startTime, deal))
    let bandwidth_record = await Bandwidth.findOne({
      where: {
        id: deal.id
      }
    })
    if(bandwidth_record){
      await bandwidth_record.set(deal)
      bandwidth_record.save()
    } else {
      bandwidth_record = await Bandwidth.create(deal)
      console.log("Created deal in Bandwidth table: ", deal.id)
    }
    return bandwidth_record
  }

  Bandwidth.deleteRecords = async (ids) => {
    for (const id of ids) {
      console.log("Deleted resource in deals table: ", id)
      let row = await Bandwidth.findOne({
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

  Bandwidth.formatDataToDb = async (deal) => {
    return {
      id: deal.id,
      bytes_sent: 0,
      last_read: deal.startTime,
      period_end: Bandwidth.calculatePeriodEnd(deal.startTime, deal)
    }
  }

  Bandwidth.resetBandwidthLimitPeriod = async (bandwidth) => {
    let now = new Date().getTime()
    if(now >= bandwidth.period_end){
      let bandwidth_record = await Bandwidth.findOne({
        where: {
          id: bandwidth.id
        }
      })
      if(bandwidth_record){
        let bandwidthPeriods = bandwidth.periods
        let bandwidthPeriodEnds = bandwidth.period_end
        Bandwidth.update({period_end: (bandwidthPeriodEnds / bandwidthPeriods) * bandwidthPeriods + 1, bandwidthPeriods: bandwidthPeriods + 1}, {where: {id: bandwidth.id}})
        await Bandwidth.resetBandwidthUsage(bandwidth.id)
      }
    }
  }

  Bandwidth.calculatePeriodEnd = (startTime, deal) => {
    let metadata = JSON.parse(deal.metadata)
    let period_end = 0
    switch (metadata.bandwidthLimit.period) {
      case 'hourly':
        period_end = startTime + 3600
        break
      case 'daily':
        period_end = startTime + 86400
        break
      case 'monthly':
        const oneMonthLater = new Date(startTime * 1000);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        period_end = oneMonthLater.getTime() / 1000
        break
      case 'yearly':
        const oneYearLater = new Date(startTime * 1000);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

        period_end = oneYearLater.getTime() / 1000
        break
    }

    return period_end
  }

  Bandwidth.sync({ force: true })
  return Bandwidth;
}