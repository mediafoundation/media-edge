const models = require('../../models');
const { Client } = require('@elastic/elasticsearch');

jest.mock('@elastic/elasticsearch');
//jest.mock('../../models/bandwidth');

describe('Bandwidth functions', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('getBandwidthUsageFromElasticsearch', async () => {
        const mockDeal = { id: 1 };
        const mockBandwidth = { last_read: 12345678 };
        const mockResponse = {
            aggregations: {
                total_bytes: {
                    value: '1000',
                },
            },
        };

        const mockSearch = jest.fn().mockResolvedValue(mockResponse);
        Client.mockImplementation(() => {
            return {
                search: mockSearch,
            };
        });

        const result = await models.Bandwidth.getBandwidthUsageFromElasticsearch(mockDeal, mockBandwidth);

        expect(mockSearch).toHaveBeenCalled();
        expect(result.totalBytes).toEqual(1000);
        // Add more assertions as needed
    });

    test('convertToBytes', () => {
        const mockBandwidthLimit = { amount: 1, unit: 'gb' };
        const result = models.Bandwidth.convertToBytes(mockBandwidthLimit);

        expect(result).toEqual(Math.pow(1024, 3));
        // Add more assertions as needed
    });

    test('updateBandwidthUsage', async () => {
        const mockDeal = { id: 1, metadata: JSON.stringify({ bandwidthLimit: { amount: 1, unit: 'gb' } }) };
        const mockBandwidth = {
            dataValues: { bytes_sent: 500 },
            update: jest.fn(),
        };

        models.Bandwidth.findByPk = jest.fn().mockResolvedValue(mockBandwidth);
        models.Bandwidth.getBandwidthUsageFromElasticsearch = jest.fn().mockResolvedValue({ totalBytes: 500, range: {} });
        models.Bandwidth.convertToBytes = jest.fn().mockReturnValue(Math.pow(1024, 3));

        await models.Bandwidth.updateBandwidthUsage([mockDeal]);

        expect(models.Bandwidth.findByPk).toHaveBeenCalledWith(mockDeal.id);
        expect(models.Bandwidth.getBandwidthUsageFromElasticsearch).toHaveBeenCalledWith(mockDeal, mockBandwidth);
        expect(mockBandwidth.update).toHaveBeenCalled();
        // Add more assertions as needed
    });

    test('isBillingPeriodElapsed', () => {
        const mockDeal = { minDuration: 1 };
        const mockBandwidth = { last_read: Date.now() / 1000 - 2 }; // 2 seconds ago

        const result = models.Bandwidth.isBillingPeriodElapsed(mockDeal, mockBandwidth);

        expect(result).toBe(true);
        // Add more assertions as needed
    });
});
