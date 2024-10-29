import {env} from "../config/env";

import http from "http";

import {CaddyController, queues} from "../controllers/caddyController";

import {DealsController} from "../controllers/dealsController";

import {ResourcesController} from "../controllers/resourcesController";


let caddyNeedsUpdate = false;

let initCaddy = async function (network: any, privateKey: string) {
    let caddyRecords = await CaddyController.getRecords();
    if (!caddyRecords) {
        await CaddyController.initApps();
        caddyRecords = await CaddyController.getRecords();
    }

    let dealsFromDB = await DealsController.getDeals();
    let resourcesFromDB = await ResourcesController.getResources();

    let matchDealResources = []

    for (const deal of dealsFromDB) {
        let matchDealResource: {[index: string | number] : any} = {};
        matchDealResource.deal = deal;
        let dealsResource: any = await DealsController.getDealResource(deal.id);
        matchDealResource.resource = resourcesFromDB.find((resource: any) => resource.id === dealsResource.resourceId);
        matchDealResource.domains = await ResourcesController.getResourceDomain(matchDealResource.resource.id, deal.id);
        matchDealResources.push(matchDealResource);
    }

    await CaddyController.addRecords(matchDealResources, caddyRecords, network, privateKey);

    let caddyFile = await CaddyController.getRecords();

    let difference = await CaddyController.compareDbAndCaddyData(
        dealsFromDB.map((deal: any) => deal.id),
        caddyFile.map((obj: any) => obj['@id']).filter((id: any) => id)
    );

    for (const deal of difference) {
        await CaddyController.deleteRecord(deal);
    }

    await CaddyController.checkQueue(queues.Minutely, "Minutely", 60, privateKey);
};

let checkDealsShouldBeActive = async function () {
    let deals = await DealsController.getDeals();
    let dealsToDelete = [];
    let resourcesToDelete = [];
    for (const deal of deals) {
        let dealIsActive = deal.active === true;
        if (!dealIsActive) {
            dealsToDelete.push(deal.id);
            let dealsOfResource = await ResourcesController.getResourcesDeals(deal.resourceId);
            if (dealsOfResource.length === 1) {
                if (env.debug) console.log("deals of resource", dealsOfResource);
                resourcesToDelete.push(deal.resourceId);
            }
        }
    }

    if (dealsToDelete.length > 0) {
        console.log("Deals id to delete:", dealsToDelete);
        for (const dealToDelete of dealsToDelete) {
            await CaddyController.deleteRecord(dealToDelete);
            await DealsController.deleteDealById(dealToDelete.id);
        }

        for (const resource of resourcesToDelete) {
            await ResourcesController.deleteResourceById(resource.id);
        }
    }
};

let checkQueue = (privateKey: string) => {
    setInterval(() => CaddyController.checkQueue(queues.Minutely, "Minutely", 60, privateKey), 60000);
    setInterval(() => CaddyController.checkQueue(queues.Hourly, "Hourly", 24, privateKey), 3600000);
    setInterval(() => CaddyController.checkQueue(queues.Daily, "Daily", 30, privateKey), 86400 * 1000);
    setInterval(() => CaddyController.checkQueue(queues.Monthly, "Monthly", 12, privateKey), 259200 * 1000);
};

let checkCaddy = async (privateKey: string) => {
    let url = new URL(env.caddyUrl);
    let host = url.hostname;
    let port = url.port;
    const options = {
        host: host,
        port: port,
        path: '/config'
    };

    try {
        const request = http.request(options);
        await new Promise((resolve, reject) => {
            request.on('response', (response) => {
                resolve(response.statusCode === 200);
            });
            request.on('error', (error) => {
                reject(error);
            });
            request.end();
        });
        if (caddyNeedsUpdate) {
            try {
                console.log("Caddy failed, trying to restart");
                //todo: Check what pass over network param
                await initCaddy("NETWORK", privateKey);
                caddyNeedsUpdate = false;
            } catch (e) {
                console.log("Error restarting caddy:", e);
                caddyNeedsUpdate = true;
            }
        }
    } catch (error) {
        console.error('Error checking Caddy server:', error);
        caddyNeedsUpdate = true;
    }
};

export { initCaddy, checkDealsShouldBeActive, checkQueue, checkCaddy };