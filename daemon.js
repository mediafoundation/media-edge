
const networks = require('./config/networks')
const env = require('./config/env')
const db = require('./models');
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Web3 = require('web3');


const init = async(Contract)=>{
  
  let resources = await db.Evm.getPaginatedResources(Contract, 0, 2);
  for (const resource of resources) {
    let resourceFormatted = db.Evm.formatDataToDB(resource.resource_id, resource.owner, resource.data)
    await db.Evm.addRecord(resourceFormatted)
  }
}


// let CURRENT_NETWORK = networks.bsc
let deployed = [networks.ganache]
deployed.forEach(CURRENT_NETWORK => {

  const web3 = new Web3(
    new Web3.providers.HttpProvider(CURRENT_NETWORK.URL)
  );
  console.log("Contract address:",Resources.networks[CURRENT_NETWORK.network_id].address,"Start daemon to:", CURRENT_NETWORK.URL)
  

  const ResourcesInstance = new web3.eth.Contract(
    Resources.abi,  
    Resources.networks[CURRENT_NETWORK.network_id].address
  );

  /* ResourcesInstance.events.NewResource({filter: {value: []}})
  .on('data', event => {
    console.log("New Resources:",event.returnValues[0],event.returnValues[1],
    event.returnValues.servardata)
    // Evm.upsert({address: res.toLowerCase()}, {index: index.toString()})
  })    
  .on('changed', changed => console.log("Changed!",changed))
  .on('error', err => console.warn("Error",err) )
  // .on('connected', str => console.log("NewResource conection:",str))

  ResourcesInstance.events.RemoveResource({filter: {value: []}})
  .on('data', event => {console.log("RemoveResource:",event.returnValues)})    
  .on('changed', changed => console.log("Changed!",changed))
  .on('error', err => console.warn("Error",err) )
  // .on('connected', str => console.log("RemoveResource conection:",str))

  ResourcesInstance.events.NewAddress({filter: {value: []}})
  .on('data', event => {console.log("NewAddress:",event.returnValues)})    
  .on('changed', changed => console.log("Changed!",changed))
  .on('error', err => console.warn("Error",err) )
  // .on('connected', str => console.log("NewAddress conecton:",str))


  ResourcesInstance.events.RemoveAddress({filter: {value: []}})
  .on('data', event => {console.log("RemoveAddress:",event.returnValues)})    
  .on('changed', changed => console.log("Changed!",changed))
  .on('error', err => console.warn("Error",err) )
  // .on('connected', str => console.log("RemoveAddress conecton:",str)) */

  init(ResourcesInstance)
});


