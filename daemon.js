
const networks = require('./config/networks')
const env = require('./config/env')
const db = require('./models');
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Marketplace = require('./evm-contract/build/contracts/Marketplace.json')
const Web3 = require('web3');


const init = async(ResourcesContract, MarketplaceContract)=>{

  //fetch resources and deals
  let resources = await db.Evm.getPaginatedResources(ResourcesContract, 0, 2);

  let deals = await db.Evm.getPaginatedDeals(MarketplaceContract, 0, 2)

  //delete deals that are not active
  for (let i = 0; i < deals.length; i++) {
    if(await db.Evm.dealIsActive(deals[i]) === false){
      delete deals[i]
    }
  }

  //console.log("Deals: ", deals)
  //console.log("Resources: ", resources)

  let resourcesIds = resources.map(obj => obj.resource_id)
  let dealResourcesIds = deals.map(obj => obj.resourceId)

  console.log("Resources Ids: ", resourcesIds)
  console.log("Deal Resources Ids: ", dealResourcesIds)



  /*let dealResourcesIds = []
  console.log(resources)

  deals.forEach(deal => {
    dealResourcesIds.push(deal.resourceId)
  })

  console.log(dealResourcesIds)

  //upsert records in db
  for (const resource of resources) {
    let resourceFormatted = db.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data)
    await db.Evm.addRecord(resourceFormatted)
  }

  //delete records that are in db but not in blockchain
  let resourcesIds = resources.map(obj => obj.resource_id)
  let notCompatibleResources = await db.Evm.compareBlockchainAndDbData(resourcesIds)

  if(notCompatibleResources.length > 0){
    await db.Evm.deleteRecords(notCompatibleResources)
  }


  console.log(await db.Evm.compareDealsResourcesWithResources(dealResourcesIds, resourcesIds))*/
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

  const MarketplaceInstance = new web3.eth.Contract(
      Marketplace.abi,
      Marketplace.networks[CURRENT_NETWORK.network_id].address
  )

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

  init(ResourcesInstance, MarketplaceInstance)
});


