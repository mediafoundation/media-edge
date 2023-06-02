const models = require('../models')

const resetVarnish = async () => {
    await models.Varnish.deleteAllRecords("/root/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/varnish_queue.json")
}

const manageBandwidth = async () => {

    let dealsIds = await models.Bandwidth.getLimitedRecordIds()
    for (const id of dealsIds) {
        let deal = await models.Deals.getDealById(id.dataValues.id)
        console.log("Deal in varnish service:", deal);
        let domains = JSON.parse(deal.domains)
        for (const domain of domains) {
            await models.Varnish.addRecord(domain[1], '/')
            await models.Varnish.purgeRecord(domain[1]+'/')
        }
        let resource = await models.Evm.getResourceById(deal.resourceId)
        console.log(resource);
    }
}

module.exports = {resetVarnish, manageBandwidth}