const crypto = require('crypto');
const env = require("./../config/env")

function generateSubdomain(marketplaceId, dealId, networkId, chainId) {
    let hash = crypto.createHash('sha256');
    hash.update(marketplaceId + dealId + networkId + chainId + env.PRIVATE_KEY);

    let result = hash.digest('base64').replace(/[^a-z0-9]/gi, '0'); // replace invalid characters with '0'

    return result.toLocaleLowerCase().slice(0, 6);  // Only take first 6 characters
}

function generateTXTRecord(owner, domain) {
    let hash = crypto.createHash('sha256');
    hash.update(owner + domain + env.PRIVATE_KEY);

    let result = hash.digest('base64').replace(/[^a-z0-9]/gi, '0'); // replace invalid characters with '0'

    return `mn-verify=${result.toLocaleLowerCase().slice(0, 10)}`;
}

//Following an example of usage
//let subdomain = generateSubdomain('1','1', '1', '5db5ce9b809700f12b1990a44a82a5fc223dd023efb0723f771fb38d3e4ffd5b');
//console.log(subdomain);  // e.g., 'abc123'

module.exports = {generateSubdomain, generateTXTRecord}

