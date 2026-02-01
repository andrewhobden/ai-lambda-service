# local-lambda

Run a local REST server from a declarative JSON config. Each endpoint can be backed by an OpenAI prompt or a JavaScript handler.

## Quick start
1) Install deps:
```
npm install
```
2) Add your OpenAI key to `.env`:
```
OPENAI_API_KEY=sk-...
```
3) Start with the sample config:
```
npx local-lambda start -c examples/basic.json
```
4) Try the sample endpoints:
- AI prompt: `POST http://localhost:4000/ai-greeting` with `{ "name": "Ada" }`
- JS handler: `POST http://localhost:4000/sum` with `{ "a": 1, "b": 2 }`

## Configuration
- See [CONFIG.md](CONFIG.md) for the JSON schema and field descriptions.
- Sample config: [examples/basic.json](examples/basic.json)
- Sample JS handler: [examples/handlers/sum.js](examples/handlers/sum.js)

### Environment
- `.env` is loaded automatically.
- `OPENAI_API_KEY` is required for any endpoint using `aiPrompt`.

## CLI
Implemented in [bin/local-lambda.js](bin/local-lambda.js).

```
local-lambda start -c <config.json> -p <port> -v <level>
local-lambda stop
```
- `-c, --config`: path to JSON config (default `./config.json`)
- `-p, --port`: port override (else uses config.port or 3000)
- `-v, --verbose`: `debug|info|warn|error` (default `info`)

## How it works
- Config is validated with AJV in [src/config.js](src/config.js).
- Routes are bound in [src/server.js](src/server.js) using Express.
- Each endpoint uses either an OpenAI chat completion or a JS handler via [src/engine.js](src/engine.js).
- Input/output validation uses JSON Schema per-endpoint.

## Testing
```
npm test
```
Mocha + Supertest cover config loading and JS handler endpoints. Test fixtures live in [test/fixtures](test/fixtures).

## License
ISC
