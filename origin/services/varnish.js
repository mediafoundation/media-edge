const models = require('../models')

const resetVarnish = async () => {
    await models.Varnish.deleteAllRecords
}

module.exports = {resetVarnish}