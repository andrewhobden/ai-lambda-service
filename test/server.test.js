const path = require('node:path');
const request = require('supertest');
const { loadConfig } = require('../src/config');
const { startServer, stopServer } = require('../src/server');

const noopLogger = { info() {}, warn() {}, error() {}, debug() {}, isDebugEnabled: () => false };

describe('server', () => {
  afterEach(async () => {
    await stopServer();
  });

  it('handles a valid JS endpoint', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'js-only-config.json');
    const config = await loadConfig(configPath, noopLogger);
    const server = await startServer({ config, port: 0, logger: noopLogger });

    await request(server)
      .post('/sum')
      .send({ a: 2, b: 3 })
      .expect(200)
      .expect(({ body }) => {
        if (body.sum !== 5) throw new Error('Expected sum of 5');
      });
  });

  it('rejects invalid input against schema', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'js-only-config.json');
    const config = await loadConfig(configPath, noopLogger);
    const server = await startServer({ config, port: 0, logger: noopLogger });

    await request(server)
      .post('/sum')
      .send({ a: 'not-a-number', b: 3 })
      .expect(400)
      .expect(({ body }) => {
        if (!body.error) throw new Error('Expected validation error response');
      });
  });
});
