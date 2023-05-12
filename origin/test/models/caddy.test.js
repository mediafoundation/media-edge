const models = require('../../models');
const axios = require('axios');

// Mock axios post method
jest.mock('../../models');
models.CaddySource.findOne.mockImplementation(() => Promise.resolve(null));
models.CaddySource.findAll.mockImplementation(() => Promise.resolve([]));

// Mock axios post method
jest.mock('axios');
axios.post.mockImplementation(() => Promise.resolve({ data: {} }));

describe('Caddy.addRecords', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should add new records to caddy', async () => {
        const dealsResources = [
            {
                resource: { domain: 'example.com' },
                deal: { id: '1' },
            },
        ];

        const Caddyfile = [];

        // Mock the required methods
        models.Caddy.newObject = jest.fn(() => 'newObjectData');
        models.Caddy.addToQueue = jest.fn();
        models.Caddy.upsertRecord = jest.fn();

        await models.Caddy.addRecords(dealsResources, Caddyfile);

        expect(models.Caddy.newObject).toHaveBeenCalledWith(
            dealsResources[0].resource,
            dealsResources[0].deal
        );
        expect(models.Caddy.addToQueue).toHaveBeenCalledWith(
            models.Caddy.queues.Minutely,
            dealsResources[0].deal.id,
            dealsResources[0]
        );
        expect(axios.post).toHaveBeenCalled();
    });

    test('should upsert record if already in Caddyfile', async () => {
        const dealsResources = [
            {
                resource: { domain: 'example.com' },
                deal: { id: '1' },
            },
        ];

        const Caddyfile = [{ '@id': '1' }];

        // Mock the required methods
        models.Caddy.newObject = jest.fn(() => 'newObjectData');
        models.Caddy.addToQueue = jest.fn();
        models.Caddy.upsertRecord = jest.fn();

        await models.Caddy.addRecords(dealsResources, Caddyfile);

        expect(models.Caddy.newObject).toHaveBeenCalledWith(
            dealsResources[0].resource,
            dealsResources[0].deal
        );
        expect(models.Caddy.upsertRecord).toHaveBeenCalledWith(
            dealsResources[0],
            Caddyfile[0]
        );
        expect(axios.post).toHaveBeenCalled();
    });

    test('should handle axios error', async () => {
        const dealsResources = [
            {
                resource: { domain: 'example.com' },
                deal: { id: '1' },
            },
        ];

        const Caddyfile = [];

        // Mock the required methods
        models.Caddy.newObject = jest.fn(() => 'newObjectData');
        models.Caddy.addToQueue = jest.fn();
        models.Caddy.upsertRecord = jest.fn();
        axios.post.mockImplementation(() => Promise.reject(new Error('Axios error')));

        const result = await models.Caddy.addRecords(dealsResources, Caddyfile);

        expect(result).toBe(false);
    });
});

describe('Caddy.checkDomain', () => {
    test('should return true if domain exists in Caddy Database', async () => {
        models.CaddySource.findOne.mockResolvedValue({ host: 'example.com' });
        const result = await Caddy.checkDomain('example.com');
        expect(result).toBe(true);
    });

    test('should return false if domain does not exist in Caddy Database', async () => {
        models.CaddySource.findOne.mockResolvedValue(null);
        const result = await models.Caddy.checkDomain('example.com');
        expect(result).toBe(false);
    });
});
