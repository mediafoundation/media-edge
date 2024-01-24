const {Client} = require("../models/Client");
const {Provider} = require("../models/Provider");
const {Resource} = require("../models/resources/Resource");
const {Deal} = require("../models/deals/Deal");
const {DealsMetadata} = require("../models/deals/DealsMetadata");
const {DealsBandwidthLimit} = require("../models/deals/DealsBandwidthLimit");
const {DealsLocations} = require("../models/deals/DealsLocations");
const {CaddySource} = require("../models/caddy");
const {BandwidthsLog} = require("../models/BandwidthsLog");
const {DealsResources} = require("../models/associations/DealsResources");
const {DealsNodeLocations} = require("../models/deals/DealsNodeLocations");
const {Domains} = require("../models/resources/Domains");
const {sequelize} = require("../models");
const { PurgeLog } = require("../models/purgeLog");
const resetDB = async () => {

    // Drop tables

    await sequelize.drop({cascade: true})



    // Recreate tables

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
    await Domains.sync({force: true})

    await CaddySource.sync({force: true})
    await PurgeLog.sync({force: true})

    Deal.hasOne(DealsMetadata, {
        foreignKey: 'dealId',
        as: 'Metadata', // This alias should match the one used in your query
        onDelete: 'cascade'
    });

    Deal.hasOne(DealsBandwidthLimit, {
        foreignKey: 'dealId',
        as: 'BandwidthLimit', // This alias should match the one used in your query
        onDelete: 'cascade'
    });

    Resource.hasMany(Domains, {
        foreignKey: 'resourceId',
        as: 'Domains', // This alias should match the one used in your query
        onDelete: 'cascade'
    });

    Deal.hasOne(Domains, {
        foreignKey: "dealId",
        as: "Deals",
        onDelete: 'cascade'
    })

}

module.exports = {resetDB}