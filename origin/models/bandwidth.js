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
    bandwidth_limit: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  }, {
    updatedAt: false,
  });
  const caddyApiHeaders = {
    headers: {
      'Content-Type': 'application/json'
    }
  }
  Bandwidth.getBandwidthUsageFromElasticsearch = async (deal, bandwidth) => {
    const { Client } = require('@elastic/elasticsearch');
    const client = new Client({ node: 'http://localhost:9200' });
  
    // Set the time range for the query based on the bandwidth's updatedAt field
    const now = new Date();
    const range = {
      gte: bandwidth.updatedAt.toISOString(),
      lte: now.toISOString(),
    };
  
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
      const totalBytes = parseInt(response.body.aggregations.total_bytes.value);
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

  Bandwidth.updateBandwidthUsage = async () => {
    // Fetch all deals from the database
    const Deals = require("./../models/deals")

    const deals = await Deals.findAll()
  
    for (const deal of deals) {
      // Fetch the bandwidth record for the deal
      const bandwidth = await Bandwidth.findByPk(deal.id);
  
      // Check if the billing period has elapsed
      if (Bandwidth.isBillingPeriodElapsed(deal, bandwidth)) {
        // Fetch the bandwidth usage from Elasticsearch
        const { totalBytes, range } = await Bandwidth.getBandwidthUsageFromElasticsearch(deal, bandwidth);

        // Update the resource with the new bandwidth usage
        await bandwidth.update({
          bytes_sent: totalBytes,
          updatedAt: new Date(range.lte),
        });
  
        // Extract the bandwidthLimit from the deal's metadata
        const metadata = JSON.parse(deal.metadata);
        const bandwidthLimit = metadata.bandwidthLimit;
  
        // Calculate the bandwidth limit in bytes
        let limitInBytes = Bandwidth.convertToBytes(bandwidthLimit);
  
        // Check if the bandwidth limit has been reached
        if (bandwidthUsage >= limitInBytes) {
          // Update the Caddy resource configuration to apply the bandwidth limiter
          await Bandwidth.applyBandwidthLimiter(deal, true);
        } else {
          // Remove the bandwidth limiter if it's already applied
          await Bandwidth.applyBandwidthLimiter(deal, false);
        }
      }
    }
  }

  Bandwidth.isBillingPeriodElapsed = (deal, bandwidth) => {
    const { minimumDuration } = deal;
    const now = new Date();
    const elapsedTime = now.getTime() - bandwidth.updatedAt.getTime();
    const minimumDurationInMilliseconds = minimumDuration * 1000;

    return elapsedTime >= minimumDurationInMilliseconds;
  }

  Bandwidth.resetBandwidthUsage = async (dealId) => {
    await Bandwidth.update({ bytes_sent: 0 }, { where: { id: dealId } });
  
    const config = await axios.get(`${caddyApiBaseUrl}${dealId}`, caddyApiHeaders);
    const resource = config.data;
    const headersHandler = resource.handle[0].routes[0].handle.find(
      (handler) => handler.handler === 'headers'
    );
  
    if (headersHandler) {
      delete headersHandler.response.set["X-Bandwidth-Limit"];
      await axios.put(`${caddyApiBaseUrl}${dealId}`, resource, caddyApiHeaders);
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
  

  //Bandwidth.sync({ force: false })
  return Bandwidth;
}