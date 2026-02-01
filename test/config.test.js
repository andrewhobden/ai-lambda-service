const path = require('node:path');
const { strict: assert } = require('node:assert');
const { loadConfig } = require('../src/config');

const noopLogger = { info() {}, warn() {}, error() {} };

describe('config loader', () => {
  it('loads a valid config and normalizes methods', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'js-only-config.json');
    const config = await loadConfig(configPath, noopLogger);

    assert.equal(config.endpoints.length, 1);
    assert.equal(config.endpoints[0].method, 'POST');
    assert.ok(config.baseDir.endsWith(path.join('test', 'fixtures')));
  });

  it('fails when neither aiPrompt nor jsHandler is provided', async () => {
    const badConfigPath = path.join(__dirname, 'fixtures', 'invalid-missing-handler.json');
    await assert.rejects(() => loadConfig(badConfigPath, noopLogger), /must specify exactly one/);
  });
});
