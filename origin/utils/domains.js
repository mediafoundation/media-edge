const psl = require("psl");
function isHostDomain(host) {
    if(psl.isValid(host)){
        const parsed = psl.parse(host);
        return !parsed.subdomain;
    } else {
        throw new Error("Invalid host");
    }
}

module.exports = {isHostDomain};