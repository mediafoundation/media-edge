const Web3 = require('web3');

const getMessageHash = async (to, amount, message, nonce) => {
    return Web3.utils.soliditySha3(
        { t: 'address', v: to },
        { t: 'uint256', v: amount },
        { t: 'string', v: message },
        { t: 'uint256', v: nonce }
      );   
}

const getEthSignedMessageHash = async (messageHash) => {
    const prefix = '\x19Ethereum Signed Message:\n32';
    const prefixedMessageHash = Web3.utils.soliditySha3(
      { t: 'string', v: prefix },
      { t: 'bytes32', v: messageHash }
    );
    return prefixedMessageHash;
}


const verifySignature = async (signer, to, amount, message, nonce, signature) => {
    const messageHash = getMessageHash(to, amount, message, nonce);
    const ethSignedMessageHash = getEthSignedMessageHash(messageHash);
    const { r, s, v } = Web3.utils.fromRpcSig(signature);
  
    const web3 = new Web3();
    const recoveredSigner = web3.eth.accounts.recover(ethSignedMessageHash, v, r, s);
  
    return recoveredSigner === signer;
  }

  module.exports = {verifySignature}