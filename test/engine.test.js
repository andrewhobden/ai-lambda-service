const path = require('node:path');
const { strict: assert } = require('node:assert');
const { createHandler, closeWorkiqClient, registerHandler, clearHandlerRegistry, detectCircularDependencies, ChainExecutionError } = require('../src/engine');
const { evaluateTemplate, compileTemplate } = require('../src/template');

const noopLogger = { info() {}, warn() {}, error() {}, debug() {}, isDebugEnabled: () => false };

describe('engine', () => {
  // Clean up MCP client after all tests to prevent hanging
  after(() => {
    closeWorkiqClient();
  });

  describe('createHandler', () => {
    it('creates a jsHandler correctly', async () => {
      const endpoint = {
        name: 'test-sum',
        jsHandler: { file: 'handlers/sum.js' }
      };
      const baseDir = path.join(__dirname, 'fixtures');
      
      const handler = await createHandler(endpoint, baseDir, noopLogger);
      
      assert.equal(typeof handler, 'function');
      
      const result = await handler({ a: 5, b: 3 });
      assert.deepEqual(result, { sum: 8 });
    });

    it('throws when jsHandler file does not exist', async () => {
      const endpoint = {
        name: 'test-missing',
        jsHandler: { file: 'handlers/nonexistent.js' }
      };
      const baseDir = path.join(__dirname, 'fixtures');
      
      await assert.rejects(
        () => createHandler(endpoint, baseDir, noopLogger),
        /Failed to load JS handler/
      );
    });

    it('throws for aiPrompt without OPENAI_API_KEY', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const endpoint = {
        name: 'test-ai',
        aiPrompt: { prompt: 'test' }
      };
      
      try {
        await assert.rejects(
          () => createHandler(endpoint, __dirname, noopLogger),
          /OPENAI_API_KEY is required|baseUrl/
        );
      } finally {
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('allows aiPrompt without API key when baseUrl is provided', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const endpoint = {
        name: 'test-local',
        aiPrompt: { 
          prompt: 'test',
          baseUrl: 'http://localhost:1234/v1',
          model: 'local-model'
        }
      };
      
      try {
        // Should not throw - baseUrl allows no API key
        const handler = await createHandler(endpoint, __dirname, noopLogger);
        assert.equal(typeof handler, 'function');
      } finally {
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('allows aiPrompt with config-level defaultBaseUrl', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const endpoint = {
        name: 'test-local-default',
        aiPrompt: { 
          prompt: 'test'
        }
      };
      
      const config = {
        defaultBaseUrl: 'http://localhost:1234/v1',
        defaultModel: 'local-model'
      };
      
      try {
        // Should not throw - config defaultBaseUrl allows no API key
        const handler = await createHandler(endpoint, __dirname, noopLogger, config);
        assert.equal(typeof handler, 'function');
      } finally {
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('uses config defaultApiKey when OPENAI_API_KEY not set', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const endpoint = {
        name: 'test-config-key',
        aiPrompt: { 
          prompt: 'test',
          model: 'gpt-4o'
        }
      };
      
      const config = {
        defaultApiKey: 'sk-test-key'
      };
      
      try {
        // Should not throw - config provides API key
        const handler = await createHandler(endpoint, __dirname, noopLogger, config);
        assert.equal(typeof handler, 'function');
      } finally {
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  describe('template engine', () => {
    describe('evaluateTemplate', () => {
      it('resolves simple input paths', () => {
        const context = { input: { name: 'Alice' } };
        assert.equal(evaluateTemplate('{{input.name}}', context), 'Alice');
      });

      it('resolves step by name', () => {
        const context = {
          input: {},
          stepsByName: { greet: { greeting: 'Hello!' } }
        };
        assert.equal(evaluateTemplate('{{greet.greeting}}', context), 'Hello!');
      });

      it('resolves step by index', () => {
        const context = {
          input: {},
          steps: [{ greeting: 'Hi!' }]
        };
        assert.equal(evaluateTemplate('{{steps[0].greeting}}', context), 'Hi!');
      });

      it('resolves previousStep', () => {
        const context = {
          input: {},
          previousStep: { result: 'done' }
        };
        assert.equal(evaluateTemplate('{{previousStep.result}}', context), 'done');
      });

      it('resolves nested paths', () => {
        const context = {
          input: { user: { profile: { name: 'Bob' } } }
        };
        assert.equal(evaluateTemplate('{{input.user.profile.name}}', context), 'Bob');
      });

      it('throws on missing property', () => {
        const context = { input: { name: 'Alice' } };
        assert.throws(
          () => evaluateTemplate('{{input.missing}}', context),
          /property "missing" does not exist/
        );
      });

      it('throws on null traversal', () => {
        const context = { input: { value: null } };
        assert.throws(
          () => evaluateTemplate('{{input.value.nested}}', context),
          /is null/
        );
      });
    });

    describe('compileTemplate', () => {
      it('compiles object with templates', () => {
        const context = {
          input: { name: 'Alice' },
          previousStep: { count: 5 }
        };
        const template = {
          name: '{{input.name}}',
          value: '{{previousStep.count}}'
        };
        const result = compileTemplate(template, context);
        assert.deepEqual(result, { name: 'Alice', value: 5 });
      });

      it('compiles arrays', () => {
        const context = { input: { x: 1, y: 2 } };
        const template = ['{{input.x}}', '{{input.y}}'];
        const result = compileTemplate(template, context);
        assert.deepEqual(result, [1, 2]);
      });

      it('preserves non-template strings', () => {
        const context = { input: { name: 'Alice' } };
        const template = { regular: 'hello', template: '{{input.name}}' };
        const result = compileTemplate(template, context);
        assert.deepEqual(result, { regular: 'hello', template: 'Alice' });
      });

      it('throws on embedded templates', () => {
        const context = { input: { name: 'Alice' } };
        const template = { text: 'Hello {{input.name}}!' };
        assert.throws(
          () => compileTemplate(template, context),
          /Embedded templates are not supported/
        );
      });
    });
  });

  describe('detectCircularDependencies', () => {
    it('detects simple circular dependency', () => {
      const config = {
        endpoints: [
          {
            name: 'a',
            chainHandler: {
              steps: [{ endpoint: 'b', input: {} }]
            }
          },
          {
            name: 'b',
            chainHandler: {
              steps: [{ endpoint: 'a', input: {} }]
            }
          }
        ]
      };
      assert.throws(
        () => detectCircularDependencies(config),
        /Circular dependency detected: a -> b -> a/
      );
    });

    it('detects three-way circular dependency', () => {
      const config = {
        endpoints: [
          {
            name: 'a',
            chainHandler: {
              steps: [{ endpoint: 'b', input: {} }]
            }
          },
          {
            name: 'b',
            chainHandler: {
              steps: [{ endpoint: 'c', input: {} }]
            }
          },
          {
            name: 'c',
            chainHandler: {
              steps: [{ endpoint: 'a', input: {} }]
            }
          }
        ]
      };
      assert.throws(
        () => detectCircularDependencies(config),
        /Circular dependency detected/
      );
    });

    it('allows valid chain references', () => {
      const config = {
        endpoints: [
          { name: 'base1', jsHandler: { file: 'test.js' } },
          { name: 'base2', jsHandler: { file: 'test.js' } },
          {
            name: 'chain',
            chainHandler: {
              steps: [
                { endpoint: 'base1', input: {} },
                { endpoint: 'base2', input: {} }
              ]
            }
          }
        ]
      };
      assert.doesNotThrow(() => detectCircularDependencies(config));
    });

    it('throws on missing endpoint reference', () => {
      const config = {
        endpoints: [
          {
            name: 'chain',
            chainHandler: {
              steps: [{ endpoint: 'nonexistent', input: {} }]
            }
          }
        ]
      };
      assert.throws(
        () => detectCircularDependencies(config),
        /references unknown endpoint "nonexistent"/
      );
    });
  });

  describe('chainHandler', () => {
    beforeEach(() => {
      clearHandlerRegistry();
    });

    it('creates a chain handler', async () => {
      // Register base handlers
      const greetHandler = async (input) => ({ greeting: `Hello ${input.name}!` });
      registerHandler('greeting', greetHandler, null, null);

      const endpoint = {
        name: 'test-chain',
        chainHandler: {
          steps: [
            {
              name: 'greet',
              endpoint: 'greeting',
              input: { name: '{{input.name}}' }
            }
          ]
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      assert.equal(typeof handler, 'function');

      const result = await handler({ name: 'Alice' });
      assert.deepEqual(result, { greeting: 'Hello Alice!' });
    });

    it('chains multiple steps', async () => {
      // Register base handlers
      const greetHandler = async (input) => ({ greeting: `Hello ${input.name}!` });
      const uppercaseHandler = async (input) => ({ result: input.text.toUpperCase() });

      registerHandler('greeting', greetHandler, null, null);
      registerHandler('uppercase', uppercaseHandler, null, null);

      const endpoint = {
        name: 'test-chain-multi',
        chainHandler: {
          steps: [
            {
              name: 'greet',
              endpoint: 'greeting',
              input: { name: '{{input.name}}' }
            },
            {
              name: 'transform',
              endpoint: 'uppercase',
              input: { text: '{{greet.greeting}}' }
            }
          ],
          output: {
            result: '{{transform.result}}'
          }
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      const result = await handler({ name: 'Alice' });
      assert.deepEqual(result, { result: 'HELLO ALICE!' });
    });

    it('uses previousStep reference', async () => {
      const greetHandler = async (input) => ({ greeting: `Hello ${input.name}!` });
      const echoHandler = async (input) => ({ echo: input.text });

      registerHandler('greeting', greetHandler, null, null);
      registerHandler('echo', echoHandler, null, null);

      const endpoint = {
        name: 'test-previous',
        chainHandler: {
          steps: [
            {
              endpoint: 'greeting',
              input: { name: '{{input.name}}' }
            },
            {
              endpoint: 'echo',
              input: { text: '{{previousStep.greeting}}' }
            }
          ]
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      const result = await handler({ name: 'Bob' });
      assert.deepEqual(result, { echo: 'Hello Bob!' });
    });

    it('throws ChainExecutionError on missing endpoint', async () => {
      const endpoint = {
        name: 'test-missing',
        chainHandler: {
          steps: [
            {
              endpoint: 'nonexistent',
              input: {}
            }
          ]
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      await assert.rejects(
        () => handler({}),
        ChainExecutionError
      );
    });

    it('throws ChainExecutionError on step execution failure', async () => {
      const failingHandler = async () => {
        throw new Error('Handler failed');
      };
      registerHandler('failing', failingHandler, null, null);

      const endpoint = {
        name: 'test-failure',
        chainHandler: {
          steps: [
            {
              endpoint: 'failing',
              input: {}
            }
          ]
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      await assert.rejects(
        () => handler({}),
        (err) => {
          assert(err instanceof ChainExecutionError);
          assert(err.message.includes('Handler failed'));
          return true;
        }
      );
    });

    it('validates step input against target endpoint schema', async () => {
      const strictHandler = async (input) => ({ result: input.required });
      const validateInput = (input) => {
        if (!input.required) {
          validateInput.errors = [{ message: 'missing required field' }];
          return false;
        }
        return true;
      };
      registerHandler('strict', strictHandler, validateInput, null);

      const endpoint = {
        name: 'test-validation',
        chainHandler: {
          steps: [
            {
              endpoint: 'strict',
              input: { wrong: '{{input.value}}' }
            }
          ]
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      await assert.rejects(
        () => handler({ value: 'test' }),
        (err) => {
          assert(err instanceof ChainExecutionError);
          assert(err.message.includes('input validation failed'));
          return true;
        }
      );
    });

    it('returns last step output when no output mapping specified', async () => {
      const step1 = async () => ({ a: 1 });
      const step2 = async () => ({ b: 2 });

      registerHandler('step1', step1, null, null);
      registerHandler('step2', step2, null, null);

      const endpoint = {
        name: 'test-default-output',
        chainHandler: {
          steps: [
            { endpoint: 'step1', input: {} },
            { endpoint: 'step2', input: {} }
          ]
          // No output mapping
        }
      };

      const handler = await createHandler(endpoint, __dirname, noopLogger);
      const result = await handler({});
      assert.deepEqual(result, { b: 2 });
    });
  });

  describe('workiqQuery handler', () => {
    it('creates a workiqQuery handler', async function() {
      // Skip this test if workiq is not installed
      this.timeout(10000);
      
      const endpoint = {
        name: 'test-workiq',
        workiqQuery: { query: 'Test query {{param}}' },
        outputSchema: { type: 'object' }
      };
      
      try {
        const handler = await createHandler(endpoint, __dirname, noopLogger);
        assert.equal(typeof handler, 'function');
      } catch (err) {
        // Skip if workiq is not available
        if (err.message.includes('ENOENT') || err.message.includes('workiq')) {
          this.skip();
        }
        throw err;
      }
    });

    it('replaces placeholders in query template', async function() {
      this.timeout(10000);
      
      const endpoint = {
        name: 'test-workiq',
        workiqQuery: { query: 'Meetings on {{day}} in the {{timeOfDay}}' },
        outputSchema: { type: 'object' }
      };
      
      try {
        const handler = await createHandler(endpoint, __dirname, noopLogger);
        // We can't fully test execution without workiq auth, but we can verify handler creation
        assert.equal(typeof handler, 'function');
      } catch (err) {
        if (err.message.includes('ENOENT') || err.message.includes('workiq')) {
          this.skip();
        }
        throw err;
      }
    });
  });
});
