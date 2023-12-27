const {ResourcesController} = require('../../controllers/resourcesController');
const {resetDB} = require("../../utils/resetDB");
const {DealsController} = require("../../controllers/dealsController");

const mockResource = {
    id: 1,
    owner: 'owner1',
    label: 'label1',
    protocol: 'http',
    origin: 'origin1',
    path: '/path1',
    network: 'network1'
};

const mockDeal = {
  id: 1n,
  offerId: 0n,
  client: '0xe2D5992C16b12D2682De9074592973065aA9221F',
  provider: '0x81974B05Dc9C1E744CD509b2E11F84897373af7d',
  resourceId: 1n,
  totalPayment: 0n,
  blockedBalance: 413728568261783730n,
  terms: {
    pricePerSecond: 1n,
    minDealDuration: 15n,
    billFullPeriods: false,
    singlePeriodOnly: false,
    metadata: '{ "label": "Sample Label", "bandwidthLimit": {         "amount": 500,         "period": "monthly",         "unit": "GB"     },     "autoSsl": true,     "burstSpeed": 1000,     "nodeLocations": ["Location1", "Location2", "Location3"],     "apiEndpoint": "https://api.example.com",     "customCnames": false }'
  },
  status: {
    active: true,
    createdAt: 1703595348n,
    acceptedAt: 1703595348n,
    billingStart: 1703595348n,
    cancelled: false,
    cancelledAt: 0n
  }
}


const mockDomain = {
    domain: 'example.com',
    resourceId: 1,
    dealId: 1
};
describe('ResourcesController', () => {
    beforeAll(async () => {
        await resetDB()
    })

    describe('upsertResource', () => {
        it('should create a new resource if it does not exist', async () => {
            let result = await ResourcesController.upsertResource(mockResource)
            await expect(result.originalResource).toBe(null)

            let dataFromDb = await ResourcesController.getResourceById(1)

            await expect(dataFromDb.owner).toBe(mockResource.owner)
        });

        it('should update an existing resource if it exists', async () => {
            const newResource = {
                id: 1,
                owner: 'owner2',
                label: 'label1',
                protocol: 'https',
                origin: 'origin1',
                path: '/path1',
                network: 'network1'
            }

            let result = await ResourcesController.upsertResource(newResource)

            expect(result.instance.owner).toBe(newResource.owner)
            expect(result.originalResource).toStrictEqual(mockResource)
        });
    });

    describe('upsertResourceDomain', () => {
        it('should create a new domain if it does not exist', async () => {
            await DealsController.parseDealMetadata(mockDeal.terms.metadata)
            await DealsController.upsertDeal(DealsController.formatDeal(mockDeal))


            let result = await ResourcesController.upsertResourceDomain(mockDomain)

            expect(result.created).toBe(true)
            expect(result.domain.domain).toBe(mockDomain.domain)
            expect(result.originalDomain).toBe(null)
        });

        it('should update an existing domain if it exists', async () => {
            const newDomain = {resourceId: 1, domain: 'example2.com', dealId: 1};

            let result = await ResourcesController.upsertResourceDomain(newDomain)

            expect(result.created).toBe(false)
            expect(result.domain.domain).toBe(newDomain.domain)
            expect(result.originalDomain.domain).toBe(mockDomain.domain)

        });
    });
});