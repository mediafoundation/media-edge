const {filterDomainsMatchingDeals} = require("../../utils/resources");
const {resetDB} = require("../../utils/resetDB");

const mockResourceWithDomain = {
    id: "1",
    label: "Test",
    protocol: "https",
    origin: "time.akamai.com:443",
    path: "/",
    domains: [
        { "dealId": "62", "host": "chacho.guard.media" },
        { "dealId": "62", "host": "radac.guard.media" },
        { "dealId": "63", "host": "guard.media" }
    ]
}
describe("Resource's utils", () => {
    beforeAll(async () => {
        await resetDB()
    })
    describe('filter domains', () => {
        it('should filter domains to match existent deals', async () => {
            let filteredDomains = filterDomainsMatchingDeals(mockResourceWithDomain.domains, ["62"], mockResourceWithDomain.id)
            expect(filteredDomains).toStrictEqual([{ "dealId": "62", "host": "chacho.guard.media" }, { "dealId": "62", "host": "radac.guard.media" }])
        })
    })
})