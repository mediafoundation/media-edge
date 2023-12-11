const {sequelize} = require("../models");
const {Client} = require("../models/Client");
const {Provider} = require("../models/Provider");
const {Resource} = require("../models/Resource");
const {Deal} = require("../models/deals/Deal");
const {DealsMetadata} = require("../models/deals/DealsMetadata");
const {DealsBandwidthLimit} = require("../models/deals/DealsBandwidthLimit");
const {DealsNodeLocations} = require("../models/deals/DealsNodeLocations");
const {DealsMetadataNodeLocations} = require("../models/deals/DealsMetadataNodeLocations");
const resetDB = async () => {

    // Deals
    await Deal.drop();
    await DealsMetadataNodeLocations.drop();
    await DealsMetadata.drop();
    await DealsNodeLocations.drop();
    await DealsBandwidthLimit.drop();

    await Client.drop();
    await Provider.drop();
    await Resource.drop();

    // Recreate tables
    await Resource.sync({force: true});
    await Provider.sync({force: true});
    await Client.sync({force: true});

    await DealsBandwidthLimit.sync({force: true});
    await DealsNodeLocations.sync({force: true});
    await DealsMetadata.sync({force: true});
    await DealsMetadataNodeLocations.sync({force: true});
    await Deal.sync({force: true});

}

module.exports = {resetDB}