
const networks = require('./config/networks')
const env = require('./config/env')
const db = require('./models');
const Resources = require('./evm-contract/build/contracts/Resources.json');
const Marketplace = require('./evm-contract/build/contracts/Marketplace.json')
const Web3 = require('web3');


const init = async(ResourcesContract, MarketplaceContract)=>{

  //fetch resources and deals
  let resources = await db.Evm.getPaginatedResources(ResourcesContract, 0, 2);

  let formattedResources = []

  let deals = await db.Deals.getPaginatedDeals(MarketplaceContract, 0, 2)

  console.log("Deal :", db.Deals.formatDataToDb(deals[0]))

  let dealsToDelete = []

  //add to an array all the deal's id to delete
  for (let i = 0; i < deals.length; i++) {
    if(await db.Deals.dealIsActive(deals[i]) === false || deals[i].active === false){
      dealsToDelete.push(deals[i].id)
    }
  }

  //delete deal from the array of deals
  for (let i = 0; i < dealsToDelete.length; i++) {
    let indexToDelete = deals.map(deal => deal.id).indexOf(dealsToDelete[i])
    deals.splice(indexToDelete, 1)
  }

  //check which resources are not in an active deal
  let resourcesIds = resources.map(obj => obj.resource_id)
  let dealResourcesIds = deals.map(obj => obj.resourceId)

  console.log("Resources ids", resourcesIds)
  console.log("Resources deals ids", dealResourcesIds)
  let resourcesToDelete = await db.Evm.compareDealsResourcesWithResources(dealResourcesIds, resourcesIds)

  console.log("resource to delete: ", resourcesToDelete)

  //delete resource from the array of resources
  for (let i = 0; i < resourcesToDelete.length; i++) {
    let indexToDelete = resources.map(deal => deal.resource_id).indexOf(resourcesToDelete[i])
    resources.splice(indexToDelete, 1)
  }

  //upsert records in db
  for (const resource of resources) {
    let resourceFormatted = db.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data)
    formattedResources.push(resourceFormatted)
    console.log("Formatted data:", resourceFormatted)
    await db.Evm.addRecord(resourceFormatted)
  }

  for (const deal of deals) {
    let dealFormatted = db.Deals.formatDataToDb(deal)
    await db.Deals.addRecord(dealFormatted)
  }

  console.log("Resource: ", resources[0])

  //delete records that are in db but not in blockchain
  resourcesIds = resources.map(obj => obj.resource_id)
  let notCompatibleResources = await db.Evm.compareBlockchainAndDbData(resourcesIds)

  if(notCompatibleResources.length > 0){
    await db.Evm.deleteRecords(notCompatibleResources)
  }

  let dealsIds = deals.map(obj => obj.id)
  let notCompatibleDeals = await db.Deals.compareBlockchainAndDbData(dealsIds)

  if(notCompatibleDeals.length > 0){
    await db.Deals.deleteRecords(notCompatibleDeals)
  }

  //await db.Caddy.initApps()

  console.log("Resources: ", resources.length)

  let caddyRecords = await db.Caddy.getRecords()
  console.log("Caddy file:", caddyRecords)
  let result = await db.Caddy.addRecords(formattedResources, caddyRecords)



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


