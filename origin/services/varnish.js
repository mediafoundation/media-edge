const models = require('../models')

const resetVarnish = async () => {
    await models.Varnish.deleteAllRecords
}

const manageBandwidth = async (domain) => {
    await models.Varnish.addRecord(domain[1], '/')
    await models.Varnish.purgeRecord(domain[1]+'/')
}

module.exports = {resetVarnish, manageBandwidth}