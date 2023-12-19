const {Client} = require("../models/Client");
const {Provider} = require("../models/Provider");
const {Resource} = require("../models/Resource");
const {Deal} = require("../models/deals/Deal");
const {DealsMetadata} = require("../models/deals/DealsMetadata");
const {DealsBandwidthLimit} = require("../models/deals/DealsBandwidthLimit");
const {DealsLocations} = require("../models/deals/DealsLocations");
const {CaddySource} = require("../models/caddy");
const {BandwidthsLog} = require("../models/BandwidthsLog");
const {DealsResources} = require("../models/associations/DealsResources");
const {DealsNodeLocations} = require("../models/deals/DealsNodeLocations");
const resetDB = async () => {

    // Drop tables
    await DealsResources.drop();
    await DealsLocations.drop();
    await DealsMetadata.drop();
    await BandwidthsLog.drop();
    await DealsNodeLocations.drop();
    await DealsBandwidthLimit.drop();

    await Deal.drop();
    await Client.drop();
    await Provider.drop();

    await Resource.drop();
    await CaddySource.drop();

    // Recreate tables

    await CaddySource.sync({force: true})
    // Recreate tables

    await Resource.sync({force: true});
    await Provider.sync({force: true});
    await Client.sync({force: true});
    await Deal.sync({force: true});

    await DealsBandwidthLimit.sync({force: true});
    await BandwidthsLog.sync({force: true});
    await DealsNodeLocations.sync({force: true});
    await DealsMetadata.sync({force: true});
    await DealsLocations.sync({force: true});
    await DealsResources.sync({force: true});

    Deal.hasOne(DealsMetadata, {
        foreignKey: 'dealId',
        as: 'Metadata', // This alias should match the one used in your query
    });

    Deal.hasOne(DealsBandwidthLimit, {
        foreignKey: 'dealId',
        as: 'BandwidthLimit', // This alias should match the one used in your query
    });

}

module.exports = {resetDB}