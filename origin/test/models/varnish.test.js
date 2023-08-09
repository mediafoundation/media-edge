const models = require('../../models');

afterEach(() => {
    jest.clearAllMocks();
});
  

describe('Varnish', () => {
  describe('addRecord', () => {
    it('should create a new record in the varnish table and append to file if record does not exist', async () => {
      const domain = 'example.com';
      const path = '/path';
      const bandwidhtLimited = true;

      const findOneMock = jest.spyOn(models.Varnish, 'findOne').mockResolvedValue(null);
      const createMock = mockCreate(jest.fn());

      await models.PurgeLog.addRecord(domain, path, bandwidhtLimited);

      expect(findOneMock).toHaveBeenCalledWith({ where: { path: domain + path }, order: [['createdAt', 'DESC']], raw: true });
      expect(createMock).toHaveBeenCalledWith({ path: domain + path, bandwidth_limited: bandwidhtLimited });
      // Verify appendToFile behavior
    });

    it('should not create a new record if record already exists with the same bandwidth_limited value', async () => {
      const domain = 'example.com';
      const path = '/path';
      const bandwidhtLimited = true;

      const varnishFromDb = { path: domain + path, bandwidth_limited: bandwidhtLimited };
      const findOneMock = jest.spyOn(Varnish, 'findOne').mockResolvedValue(varnishFromDb);
      const createMock = mockCreate(jest.fn());

      await models.PurgeLog.addRecord(domain, path, bandwidhtLimited);

      expect(findOneMock).toHaveBeenCalledWith({ where: { path: domain + path }, order: [['createdAt', 'DESC']], raw: true });
      expect(createMock).not.toHaveBeenCalled();
      // Verify appendToFile behavior
    });
  });

  describe('purgeRecord', () => {
    it('should send a PURGE request and log success when response status is 200', async () => {
      const url = 'http://example.com';

      const requestMock = jest.spyOn(axios, 'request').mockResolvedValue({ status: 200 });

      await models.PurgeLog.purgeRecord(url);

      expect(requestMock).toHaveBeenCalledWith({
        method: 'PURGE',
        url: url,
        headers: {
          'X-Purge-Method': 'regex'
        },
        proxy: {
          host: '127.0.0.1',
          port: 80,
        }
      });
      expect(console.log).toHaveBeenCalledWith(`Successfully purged Varnish record for ${url}`);
    });

    it('should send a PURGE request and log error when response status is not 200', async () => {
      const url = 'http://example.com';

      const requestMock = jest.spyOn(axios, 'request').mockResolvedValue({ status: 404 });

      await models.PurgeLog.purgeRecord(url);

      expect(requestMock).toHaveBeenCalledWith({
        method: 'PURGE',
        url: url,
        headers: {
          'X-Purge-Method': 'regex'
        },
        proxy: {
          host: '127.0.0.1',
          port: 80,
        }
      });
      expect(console.error).toHaveBeenCalledWith(`Failed to purge Varnish record for ${url}`);
    });

    it('should log error when an exception occurs during the request', async () => {
      const url = 'http://example.com';

      const requestMock = jest.spyOn(axios, 'request').mockRejectedValue(new Error('Network error'));

      await models.PurgeLog.purgeRecord(url);

      expect(requestMock).toHaveBeenCalledWith({
        method: 'PURGE',
        url: url,
        headers: {
          'X-Purge-Method': 'regex'
        },
        proxy: {
          host: '127.0.0.1',
          port: 80,
        }
      });
      expect(console.error).toHaveBeenCalledWith('Error purging Varnish record:', expect.any(Error));
    });
  });

  describe('deleteAllRecords', () => {
    it('should delete all records and the file successfully', async () => {
      const filePath = '/path/to/file.json';

      const destroyMock = mockDestroy(jest.fn());
      const unlinkMock = jest.spyOn(fs, 'unlink').mockImplementation((path, callback) => {
        callback(null);
      });

      await models.PurgeLog.deleteAllRecords(filePath);

      expect(destroyMock).toHaveBeenCalledWith({ where: {} });
      expect(console.log).toHaveBeenCalledWith('All records deleted successfully.');
      expect(unlinkMock).toHaveBeenCalledWith(filePath, expect.any(Function));
      expect(console.log).toHaveBeenCalledWith(`File '${filePath}' deleted successfully.`);
    });

    it('should log error when an exception occurs during record deletion', async () => {
      const filePath = '/path/to/file.json';

      const destroyMock = mockDestroy(jest.fn().mockRejectedValue(new Error('Database error')));
      const unlinkMock = jest.spyOn(fs, 'unlink').mockImplementation((path, callback) => {
        callback(null);
      });

      await models.PurgeLog.deleteAllRecords(filePath);

      expect(destroyMock).toHaveBeenCalledWith({ where: {} });
      expect(console.error).toHaveBeenCalledWith('Error deleting records:', expect.any(Error));
      expect(unlinkMock).toHaveBeenCalledWith(filePath, expect.any(Function));
      expect(console.log).toHaveBeenCalledWith(`File '${filePath}' deleted successfully.`);
    });

    it('should log error when an exception occurs during file deletion', async () => {
      const filePath = '/path/to/file.json';

      const destroyMock = mockDestroy(jest.fn());
      const unlinkMock = jest.spyOn(fs, 'unlink').mockImplementation((path, callback) => {
        callback(new Error('File not found'));
      });

      await models.PurgeLog.deleteAllRecords(filePath);

      expect(destroyMock).toHaveBeenCalledWith({ where: {} });
      expect(console.log).toHaveBeenCalledWith('All records deleted successfully.');
      expect(unlinkMock).toHaveBeenCalledWith(filePath, expect.any(Function));
      expect(console.error).toHaveBeenCalledWith(`Error deleting file: ${expect.any(Error)}`);
    });
  });
});
