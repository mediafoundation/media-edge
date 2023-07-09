const ethers = require("ethers");
const networks = require('../config/networks')

const verifySignature = (object) => {
  
  const domain = {
    name: 'Media Network',
    version: '1', 
    chainId: object.chainId,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
  };
  const recoveredAddress = ethers.utils.verifyTypedData(
    domain, 
    object.struct, 
    object.params, 
    object.hash
  );
  return recoveredAddress === object.address;
}

module.exports = { verifySignature }