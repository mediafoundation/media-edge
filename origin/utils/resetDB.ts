import { Resource } from "../models/resources/Resource";
import { Deal } from "../models/deals/Deal";
import { DealsMetadata } from "../models/deals/DealsMetadata";
import { DealsBandwidthLimit } from "../models/deals/DealsBandwidthLimit";
import { DealsLocations } from "../models/deals/DealsLocations";
import { DealsNodeLocations } from "../models/deals/DealsNodeLocations";
import { Domains } from "../models/resources/Domains";
import { sequelize } from "../models";
import {DealsResources} from "../models/associations/DealsResources";

const resetDB = async (): Promise<void> => {
    await sequelize.sync({ force: true });
};

const createRelationsBetweenTables = async (): Promise<void> => {
    Deal.hasOne(DealsMetadata, {
        foreignKey: 'dealId',
        as: 'Metadata', // This alias should match the one used in your query
        onDelete: 'CASCADE'
    });

    DealsMetadata.belongsTo(Deal, {
        foreignKey: 'dealId',
        as: 'Deal',
        onDelete: 'CASCADE'
    });

    Deal.hasOne(DealsBandwidthLimit, {
        foreignKey: 'dealId',
        as: 'BandwidthLimit', // This alias should match the one used in your query
        onDelete: 'CASCADE'
    });

    Resource.hasMany(Domains, {
        foreignKey: 'resourceId',
        as: 'Domains', // This alias should match the one used in your query
        onDelete: 'CASCADE'
    });

    Deal.hasOne(Domains, {
        foreignKey: "dealId",
        as: "Deals",
        onDelete: 'CASCADE'
    });

    DealsNodeLocations.belongsToMany(Deal, {
        through: DealsLocations,
        foreignKey: 'nodeId'
    });

    Deal.belongsToMany(DealsNodeLocations, {
        through: DealsLocations,
        foreignKey: "dealId"
    });

    Resource.belongsToMany(Deal, {
        through: DealsResources,
        foreignKey: 'resourceId'
    });

    Deal.belongsToMany(Resource, {
        through: DealsResources,
        foreignKey: "dealId"
    });
};

export { resetDB, createRelationsBetweenTables };