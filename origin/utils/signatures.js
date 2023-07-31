const ethers = require("ethers");
const networks = require('../config/networks')

const verifySignature = (object, verifyingContract) => {
  
  const domain = {
    name: 'Media Network',
    version: '1', 
    chainId: object.chainId,
    verifyingContract: verifyingContract
  };
  const recoveredAddress = ethers.utils.verifyTypedData(
    domain, 
    object.struct, 
    object.params, 
    object.hash
  );
  return recoveredAddress === object.address;

  /* const recoveredAddress = ethers.utils.verifyMessage(messageHash, signature);
  return recoveredAddress === signer; */
}

module.exports = { verifySignature }