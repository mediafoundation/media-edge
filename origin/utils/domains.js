const psl = require("psl");
function isARecord(host) {
    if(psl.isValid(host)){
        const parsed = psl.parse(host);
        return !parsed.subdomain;
    } else {
        throw new Error("Invalid host");
    }
}
function getHostName(host) {
    if(psl.isValid(host)){
        const parsed = psl.parse(host);
        return parsed.domain;
    } else {
        throw new Error("Invalid host");
    }
}

module.exports = {isARecord, getHostName};