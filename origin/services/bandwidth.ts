import { DealsController } from "../controllers/dealsController";
import { BandwidthController } from "../controllers/bandwidthController";
import { CaddyController } from "../controllers/caddyController";
import { PurgeLogsController } from "../controllers/purgeLogsController";

const checkBandwidth = async (): Promise<void> => {
    const dealsUpdated = await BandwidthController.updateBandwidthUsage();
    const dealsRestored = await BandwidthController.resetBandwidthLimitPeriods();

    const dealsToPurge = [...dealsUpdated, ...dealsRestored];

    for (const deal of dealsToPurge) {
        const caddyHosts = await CaddyController.getHosts(deal.id);
        for (const host of caddyHosts) {
            await PurgeLogsController.addRecord(`${host}/`);
        }
    }
};

const initBandwidth = async (): Promise<void> => {
    const dealsFromDb = await DealsController.getDeals();
    for (const deal of dealsFromDb) {
        const formattedDeal = await BandwidthController.formatDataToDb(deal);
        await BandwidthController.upsertRecord(formattedDeal);
    }
};

export { initBandwidth, checkBandwidth };