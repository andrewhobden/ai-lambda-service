const express = require('express');
const Ajv = require('ajv');
const { createHandler, registerHandler, clearHandlerRegistry } = require('./engine');

let currentServer = null;
let currentConfigPath = null;
let currentPort = null;
let currentLogger = null;

function generateIndexPage(config, port) {
  const endpoints = config.endpoints.map(ep => ({
    name: ep.name,
    description: ep.description,
    path: ep.path,
    method: ep.method,
    inputSchema: ep.inputSchema || null,
    handlerType: ep.aiPrompt ? 'AI Prompt' : ep.workiqQuery ? 'Workiq Query' : ep.chainHandler ? 'Chain' : 'JS Handler',
    chainSteps: ep.chainHandler?.steps
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Lambda Service</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #f8fafc; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; }
    .endpoints { display: grid; gap: 1.5rem; }
    .endpoint {
      background: #1e293b; border-radius: 12px; padding: 1.5rem;
      border: 1px solid #334155;
    }
    .endpoint-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .method {
      padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600;
      font-size: 0.75rem; text-transform: uppercase;
    }
    .method-get { background: #065f46; color: #6ee7b7; }
    .method-post { background: #1e40af; color: #93c5fd; }
    .endpoint-path { font-family: monospace; font-size: 1.1rem; color: #f8fafc; }
    .endpoint-name { color: #94a3b8; font-size: 0.875rem; }
    .endpoint-desc { color: #cbd5e1; margin-bottom: 1rem; }
    .handler-type {
      display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px;
      font-size: 0.75rem; background: #374151; color: #9ca3af; margin-bottom: 1rem;
    }
    .params { margin-bottom: 1rem; }
    .param-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; }
    .param-label { 
      min-width: 120px; font-family: monospace; font-size: 0.875rem; color: #94a3b8;
    }
    .param-input {
      flex: 1; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #475569;
      background: #0f172a; color: #f8fafc; font-size: 0.875rem;
    }
    .param-input:focus { outline: none; border-color: #3b82f6; }
    .param-type { font-size: 0.75rem; color: #64748b; min-width: 60px; }
    .btn {
      padding: 0.5rem 1.5rem; border-radius: 6px; border: none; cursor: pointer;
      font-weight: 600; font-size: 0.875rem; transition: all 0.2s;
    }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #475569; cursor: not-allowed; }
    .response-area {
      margin-top: 1rem; padding: 1rem; border-radius: 8px; background: #0f172a;
      border: 1px solid #334155; display: none;
    }
    .response-area.visible { display: block; }
    .response-header { 
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 0.5rem; font-size: 0.875rem;
    }
    .response-status { font-weight: 600; }
    .response-status.success { color: #4ade80; }
    .response-status.error { color: #f87171; }
    .response-time { color: #64748b; }
    .response-body {
      font-family: monospace; font-size: 0.875rem; white-space: pre-wrap;
      word-break: break-word; color: #e2e8f0; max-height: 300px; overflow-y: auto;
    }
    .loading { display: inline-block; width: 16px; height: 16px;
      border: 2px solid #475569; border-top-color: #3b82f6;
      border-radius: 50%; animation: spin 1s linear infinite; margin-right: 0.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .modal {
      display: none; position: fixed; z-index: 1000; left: 0; top: 0;
      width: 100%; height: 100%; overflow: auto;
      background-color: rgba(0,0,0,0.7);
    }
    .modal-content {
      background-color: #1e293b; margin: 5% auto; padding: 2rem;
      border: 1px solid #334155; border-radius: 12px;
      width: 90%; max-width: 800px; max-height: 85vh; overflow-y: auto;
    }
    .close {
      color: #94a3b8; float: right; font-size: 28px;
      font-weight: bold; cursor: pointer;
    }
    .close:hover { color: #f8fafc; }
    .form-group {
      margin-bottom: 1.5rem;
    }
    .form-group label {
      display: block; margin-bottom: 0.5rem;
      color: #cbd5e1; font-weight: 600;
    }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; padding: 0.75rem; border-radius: 6px;
      border: 1px solid #475569; background: #0f172a;
      color: #f8fafc; font-family: inherit; font-size: 0.875rem;
    }
    .form-group textarea {
      min-height: 100px; font-family: 'Monaco', 'Courier New', monospace;
      resize: vertical;
    }
    .form-actions {
      display: flex; gap: 1rem; justify-content: flex-end;
      margin-top: 2rem;
    }
    .admin-toolbar {
      position: sticky; top: 0; background: #0f172a;
      padding: 1rem 0; z-index: 100; margin-bottom: 2rem;
      display: flex; gap: 1rem; border-bottom: 1px solid #334155;
    }
    .endpoint-actions {
      margin-top: 1rem; display: none; gap: 0.5rem;
    }
    .edit-mode .endpoint-actions {
      display: flex;
    }
    .endpoint-actions button {
      padding: 0.4rem 0.8rem; border-radius: 6px; border: none;
      cursor: pointer; font-size: 0.75rem; font-weight: 600;
      background: #475569; color: #f8fafc; transition: background 0.2s;
    }
    .endpoint-actions button:hover { background: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 AI Lambda Service</h1>
    <p class="subtitle">Running on port ${port} • ${endpoints.length} endpoint${endpoints.length !== 1 ? 's' : ''} available</p>

    <!-- Admin Toolbar -->
    <div class="admin-toolbar">
      <button onclick="openCreateModal()" class="btn btn-primary">
        + Add Endpoint
      </button>
      <button onclick="toggleEditMode()" class="btn" id="edit-mode-btn">
        ✏️ Edit Mode
      </button>
    </div>

    <div class="endpoints">
      ${endpoints.map((ep, idx) => `
        <div class="endpoint" data-index="${idx}">
          <div class="endpoint-header">
            <span class="method method-${ep.method.toLowerCase()}">${ep.method}</span>
            <span class="endpoint-path">${ep.path}</span>
            <span class="endpoint-name">(${ep.name})</span>
          </div>
          <p class="endpoint-desc">${ep.description}</p>
          <span class="handler-type">${ep.handlerType}</span>
          
          <div class="params">
            ${ep.inputSchema?.properties ? Object.entries(ep.inputSchema.properties).map(([key, val]) => `
              <div class="param-row">
                <label class="param-label">${key}${ep.inputSchema.required?.includes(key) ? ' *' : ''}</label>
                <input type="text" class="param-input" data-param="${key}" 
                  placeholder="Enter ${val.type || 'value'}">
                <span class="param-type">${val.type || 'any'}</span>
              </div>
            `).join('') : '<p style="color: #64748b; font-size: 0.875rem;">No input parameters</p>'}
          </div>
          
          <button class="btn btn-primary" onclick="callEndpoint(${idx})">
            Send Request
          </button>

          <div class="endpoint-actions">
            <button onclick="openEditModal('${ep.name.replace(/'/g, "\\'")}')">Edit</button>
            <button onclick="deleteEndpoint('${ep.name.replace(/'/g, "\\'")}')">Delete</button>
          </div>

          <div class="response-area" id="response-${idx}">
            <div class="response-header">
              <span class="response-status" id="status-${idx}"></span>
              <span class="response-time" id="time-${idx}"></span>
            </div>
            <pre class="response-body" id="body-${idx}"></pre>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Create/Edit Modal -->
  <div id="endpoint-modal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()">&times;</span>
      <h2 id="modal-title">Create Endpoint</h2>

      <form id="endpoint-form" onsubmit="saveEndpoint(event)">
        <div class="form-group">
          <label>Name *:</label>
          <input type="text" id="ep-name" required />
        </div>

        <div class="form-group">
          <label>Description *:</label>
          <textarea id="ep-description" required></textarea>
        </div>

        <div class="form-group">
          <label>Path *:</label>
          <input type="text" id="ep-path" placeholder="/my-endpoint" required />
        </div>

        <div class="form-group">
          <label>Method *:</label>
          <select id="ep-method" required>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>

        <div class="form-group">
          <label>Handler Type *:</label>
          <select id="ep-handler-type" onchange="updateHandlerFields()" required>
            <option value="">-- Select Handler Type --</option>
            <option value="aiPrompt">AI Prompt</option>
            <option value="jsHandler">JavaScript Handler</option>
            <option value="workiqQuery">WorkIQ Query</option>
            <option value="chainHandler">Chain Handler</option>
          </select>
        </div>

        <div id="handler-fields"></div>

        <div class="form-group">
          <label>Input Schema (JSON, optional):</label>
          <textarea id="ep-input-schema" placeholder='{"type": "object", ...}'></textarea>
        </div>

        <div class="form-group">
          <label>Output Schema (JSON, optional):</label>
          <textarea id="ep-output-schema" placeholder='{"type": "object", ...}'></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" onclick="closeModal()" class="btn">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const endpoints = ${JSON.stringify(config.endpoints)};

    async function callEndpoint(idx) {
      const ep = endpoints[idx];
      const container = document.querySelector(\`.endpoint[data-index="\${idx}"]\`);
      const btn = container.querySelector('.btn');
      const responseArea = document.getElementById(\`response-\${idx}\`);
      const statusEl = document.getElementById(\`status-\${idx}\`);
      const timeEl = document.getElementById(\`time-\${idx}\`);
      const bodyEl = document.getElementById(\`body-\${idx}\`);

      // Gather params
      const params = {};
      container.querySelectorAll('.param-input').forEach(input => {
        const key = input.dataset.param;
        let value = input.value.trim();
        if (value) {
          // Try to parse numbers
          const schema = ep.inputSchema?.properties?.[key];
          if (schema?.type === 'number') {
            value = parseFloat(value);
          } else if (schema?.type === 'integer') {
            value = parseInt(value, 10);
          }
          params[key] = value;
        }
      });

      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span>Loading...';
      responseArea.classList.add('visible');
      statusEl.textContent = 'Sending...';
      statusEl.className = 'response-status';
      bodyEl.textContent = '';

      const startTime = performance.now();

      try {
        let response;
        if (ep.method === 'GET') {
          const qs = new URLSearchParams(params).toString();
          response = await fetch(ep.path + (qs ? '?' + qs : ''));
        } else {
          response = await fetch(ep.path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
        }

        const elapsed = Math.round(performance.now() - startTime);
        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await response.json();
          bodyEl.textContent = JSON.stringify(data, null, 2);
        } else {
          data = await response.text();
          bodyEl.textContent = data;
        }

        statusEl.textContent = response.ok ? \`✓ \${response.status} OK\` : \`✗ \${response.status} Error\`;
        statusEl.className = 'response-status ' + (response.ok ? 'success' : 'error');
        timeEl.textContent = \`\${elapsed}ms\`;
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        statusEl.textContent = '✗ Network Error';
        statusEl.className = 'response-status error';
        timeEl.textContent = \`\${elapsed}ms\`;
        bodyEl.textContent = err.message;
      }

      btn.disabled = false;
      btn.textContent = 'Send Request';
    }

    let editMode = false;
    let editingEndpoint = null;

    function toggleEditMode() {
      editMode = !editMode;
      document.body.classList.toggle('edit-mode', editMode);
      const btn = document.getElementById('edit-mode-btn');
      btn.textContent = editMode ? '✓ Edit Mode' : '✏️ Edit Mode';
      btn.style.background = editMode ? '#3b82f6' : '#475569';
    }

    function openCreateModal() {
      editingEndpoint = null;
      document.getElementById('modal-title').textContent = 'Create Endpoint';
      document.getElementById('endpoint-form').reset();
      document.getElementById('handler-fields').innerHTML = '';
      document.getElementById('endpoint-modal').style.display = 'block';
    }

    function openEditModal(name) {
      editingEndpoint = name;
      const endpoint = endpoints.find(ep => ep.name === name);

      document.getElementById('modal-title').textContent = 'Edit Endpoint';
      document.getElementById('ep-name').value = endpoint.name;
      document.getElementById('ep-description').value = endpoint.description;
      document.getElementById('ep-path').value = endpoint.path;
      document.getElementById('ep-method').value = endpoint.method;

      // Set handler type and populate fields
      if (endpoint.aiPrompt) {
        document.getElementById('ep-handler-type').value = 'aiPrompt';
        updateHandlerFields();
        document.getElementById('ai-prompt').value = endpoint.aiPrompt.prompt;
        if (endpoint.aiPrompt.model) document.getElementById('ai-model').value = endpoint.aiPrompt.model;
        if (endpoint.aiPrompt.temperature !== undefined) document.getElementById('ai-temperature').value = endpoint.aiPrompt.temperature;
      } else if (endpoint.jsHandler) {
        document.getElementById('ep-handler-type').value = 'jsHandler';
        updateHandlerFields();
        document.getElementById('js-file').value = endpoint.jsHandler.file;
        if (endpoint.jsHandler.export) document.getElementById('js-export').value = endpoint.jsHandler.export;
      } else if (endpoint.workiqQuery) {
        document.getElementById('ep-handler-type').value = 'workiqQuery';
        updateHandlerFields();
        document.getElementById('workiq-query').value = endpoint.workiqQuery.query;
      } else if (endpoint.chainHandler) {
        document.getElementById('ep-handler-type').value = 'chainHandler';
        updateHandlerFields();
        document.getElementById('chain-steps').value = JSON.stringify(endpoint.chainHandler.steps, null, 2);
        if (endpoint.chainHandler.output) {
          document.getElementById('chain-output').value = JSON.stringify(endpoint.chainHandler.output, null, 2);
        }
      }

      if (endpoint.inputSchema) {
        document.getElementById('ep-input-schema').value = JSON.stringify(endpoint.inputSchema, null, 2);
      }
      if (endpoint.outputSchema) {
        document.getElementById('ep-output-schema').value = JSON.stringify(endpoint.outputSchema, null, 2);
      }

      document.getElementById('endpoint-modal').style.display = 'block';
    }

    function closeModal() {
      document.getElementById('endpoint-modal').style.display = 'none';
      editingEndpoint = null;
    }

    function updateHandlerFields() {
      const handlerType = document.getElementById('ep-handler-type').value;
      const container = document.getElementById('handler-fields');

      if (handlerType === 'aiPrompt') {
        container.innerHTML = \`
          <div class="form-group">
            <label>Prompt *:</label>
            <textarea id="ai-prompt" required></textarea>
          </div>
          <div class="form-group">
            <label>Model:</label>
            <input type="text" id="ai-model" placeholder="gpt-4o-mini" />
          </div>
          <div class="form-group">
            <label>Temperature:</label>
            <input type="number" id="ai-temperature" min="0" max="2" step="0.1" placeholder="1" />
          </div>
        \`;
      } else if (handlerType === 'jsHandler') {
        container.innerHTML = \`
          <div class="form-group">
            <label>File Path *:</label>
            <input type="text" id="js-file" placeholder="handlers/myhandler.js" required />
          </div>
          <div class="form-group">
            <label>Export Name:</label>
            <input type="text" id="js-export" placeholder="default if empty" />
          </div>
        \`;
      } else if (handlerType === 'workiqQuery') {
        container.innerHTML = \`
          <div class="form-group">
            <label>Query *:</label>
            <textarea id="workiq-query" placeholder="What meetings do I have on {{day}}?" required></textarea>
          </div>
        \`;
      } else if (handlerType === 'chainHandler') {
        container.innerHTML = \`
          <div class="form-group">
            <label>Steps (JSON array) *:</label>
            <textarea id="chain-steps" placeholder='[{"endpoint": "...", "input": {...}}]' required></textarea>
          </div>
          <div class="form-group">
            <label>Output Mapping (JSON):</label>
            <textarea id="chain-output" placeholder='{"field": "{{stepName.field}}"}'></textarea>
          </div>
        \`;
      } else {
        container.innerHTML = '';
      }
    }

    async function saveEndpoint(event) {
      event.preventDefault();

      try {
        const endpoint = {
          name: document.getElementById('ep-name').value,
          description: document.getElementById('ep-description').value,
          path: document.getElementById('ep-path').value,
          method: document.getElementById('ep-method').value
        };

        // Parse schemas if provided
        const inputSchema = document.getElementById('ep-input-schema').value.trim();
        if (inputSchema) endpoint.inputSchema = JSON.parse(inputSchema);

        const outputSchema = document.getElementById('ep-output-schema').value.trim();
        if (outputSchema) endpoint.outputSchema = JSON.parse(outputSchema);

        // Add handler config
        const handlerType = document.getElementById('ep-handler-type').value;
        if (handlerType === 'aiPrompt') {
          endpoint.aiPrompt = { prompt: document.getElementById('ai-prompt').value };
          const model = document.getElementById('ai-model').value.trim();
          if (model) endpoint.aiPrompt.model = model;
          const temp = document.getElementById('ai-temperature').value;
          if (temp) endpoint.aiPrompt.temperature = parseFloat(temp);
        } else if (handlerType === 'jsHandler') {
          endpoint.jsHandler = { file: document.getElementById('js-file').value };
          const exp = document.getElementById('js-export').value.trim();
          if (exp) endpoint.jsHandler.export = exp;
        } else if (handlerType === 'workiqQuery') {
          endpoint.workiqQuery = { query: document.getElementById('workiq-query').value };
        } else if (handlerType === 'chainHandler') {
          endpoint.chainHandler = { steps: JSON.parse(document.getElementById('chain-steps').value) };
          const output = document.getElementById('chain-output').value.trim();
          if (output) endpoint.chainHandler.output = JSON.parse(output);
        }

        // Send to server
        const url = editingEndpoint
          ? \`/__admin/endpoints/\${encodeURIComponent(editingEndpoint)}\`
          : '/__admin/endpoints';
        const method = editingEndpoint ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(endpoint)
        });

        const result = await response.json();

        if (response.ok) {
          alert(result.message);
          closeModal();
          setTimeout(() => window.location.reload(), 2500);
        } else {
          alert('Error: ' + (result.error || 'Unknown error') + '\\n' + JSON.stringify(result.details || ''));
        }
      } catch (err) {
        alert('Failed to save endpoint: ' + err.message);
      }
    }

    async function deleteEndpoint(name) {
      if (!confirm(\`Delete endpoint "\${name}"?\`)) return;

      try {
        const response = await fetch(\`/__admin/endpoints/\${encodeURIComponent(name)}\`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
          alert(result.message);
          setTimeout(() => window.location.reload(), 2500);
        } else {
          alert('Error: ' + (result.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Failed to delete endpoint: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

async function startServer({ config, port, logger = console, configPath }) {
  if (currentServer) {
    logger.warn('A server is already running. Stopping the existing server before starting a new one.');
    await stopServer();
  }

  // Store current values for restart mechanism
  currentConfigPath = configPath;
  currentPort = port;
  currentLogger = logger;

  const app = express();
  const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/__health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Index page with interactive endpoint explorer
  app.get('/', (_req, res) => {
    res.send(generateIndexPage(config, port));
  });

  // API endpoint to get config for the UI
  app.get('/__endpoints', (_req, res) => {
    res.json(config.endpoints.map(ep => ({
      name: ep.name,
      description: ep.description,
      path: ep.path,
      method: ep.method,
      inputSchema: ep.inputSchema || null,
      outputSchema: ep.outputSchema || null,
      handlerType: ep.aiPrompt ? 'AI Prompt' : ep.workiqQuery ? 'Workiq Query' : ep.chainHandler ? 'Chain' : 'JS Handler',
      chainSteps: ep.chainHandler?.steps
    })));
  });

  // Get full config (including port, defaults, etc.)
  app.get('/__config', (_req, res) => {
    // Return config without baseDir
    const { baseDir, ...clientConfig } = config;
    res.json(clientConfig);
  });

  // Create new endpoint
  app.post('/__admin/endpoints', async (req, res) => {
    try {
      const newEndpoint = req.body;

      // Validate required fields
      const { endpointSchema } = require('./config');
      const validateEndpoint = ajv.compile(endpointSchema);
      if (!validateEndpoint(newEndpoint)) {
        return res.status(400).json({
          error: 'Invalid endpoint',
          details: validateEndpoint.errors
        });
      }

      // Check for duplicate name or path conflicts
      if (config.endpoints.some(ep => ep.name === newEndpoint.name)) {
        return res.status(409).json({ error: 'Endpoint name already exists' });
      }
      if (config.endpoints.some(ep => ep.path === newEndpoint.path && ep.method === newEndpoint.method)) {
        return res.status(409).json({ error: 'Endpoint path+method combination already exists' });
      }

      // Add to config
      config.endpoints.push(newEndpoint);

      // Save config file
      const { saveConfig } = require('./config');
      await saveConfig(config, currentConfigPath, logger);

      // Schedule server restart
      scheduleRestart(logger);

      res.json({ success: true, message: 'Endpoint created. Server restarting...' });
    } catch (err) {
      logger.error(`Failed to create endpoint: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Update existing endpoint
  app.put('/__admin/endpoints/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const updatedEndpoint = req.body;

      const index = config.endpoints.findIndex(ep => ep.name === name);
      if (index === -1) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }

      // Validate
      const { endpointSchema } = require('./config');
      const validateEndpoint = ajv.compile(endpointSchema);
      if (!validateEndpoint(updatedEndpoint)) {
        return res.status(400).json({
          error: 'Invalid endpoint',
          details: validateEndpoint.errors
        });
      }

      // Check for path conflicts (excluding current endpoint)
      if (config.endpoints.some((ep, i) =>
        i !== index &&
        ep.path === updatedEndpoint.path &&
        ep.method === updatedEndpoint.method
      )) {
        return res.status(409).json({ error: 'Path+method combination conflicts with another endpoint' });
      }

      // Update endpoint
      config.endpoints[index] = updatedEndpoint;

      // Save config
      const { saveConfig } = require('./config');
      await saveConfig(config, currentConfigPath, logger);

      // Schedule restart
      scheduleRestart(logger);

      res.json({ success: true, message: 'Endpoint updated. Server restarting...' });
    } catch (err) {
      logger.error(`Failed to update endpoint: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete endpoint
  app.delete('/__admin/endpoints/:name', async (req, res) => {
    try {
      const { name } = req.params;

      const index = config.endpoints.findIndex(ep => ep.name === name);
      if (index === -1) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }

      // Remove endpoint
      config.endpoints.splice(index, 1);

      // Save config
      const { saveConfig } = require('./config');
      await saveConfig(config, currentConfigPath, logger);

      // Schedule restart
      scheduleRestart(logger);

      res.json({ success: true, message: 'Endpoint deleted. Server restarting...' });
    } catch (err) {
      logger.error(`Failed to delete endpoint: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Clear the handler registry to ensure clean state
  clearHandlerRegistry();

  // Two-pass handler creation:
  // Pass 1: Create all non-chain handlers first and register them
  const chainEndpoints = [];
  const handlers = new Map();

  for (const endpoint of config.endpoints) {
    if (endpoint.chainHandler) {
      chainEndpoints.push(endpoint);
      continue;
    }

    const validateInput = endpoint.inputSchema ? ajv.compile(endpoint.inputSchema) : null;
    const validateOutput = endpoint.outputSchema ? ajv.compile(endpoint.outputSchema) : null;
    const handler = await createHandler(endpoint, config.baseDir, logger, config);

    // Register handler for potential use by chain handlers
    registerHandler(endpoint.name, handler, validateInput, validateOutput);

    // Store for route binding later
    handlers.set(endpoint.name, {
      endpoint,
      handler,
      validateInput,
      validateOutput
    });
  }

  // Pass 2: Create chain handlers (they can now reference handlers from Pass 1)
  for (const endpoint of chainEndpoints) {
    const validateInput = endpoint.inputSchema ? ajv.compile(endpoint.inputSchema) : null;
    const validateOutput = endpoint.outputSchema ? ajv.compile(endpoint.outputSchema) : null;
    const handler = await createHandler(endpoint, config.baseDir, logger, config);

    // Register chain handler
    registerHandler(endpoint.name, handler, validateInput, validateOutput);

    // Store for route binding
    handlers.set(endpoint.name, {
      endpoint,
      handler,
      validateInput,
      validateOutput
    });
  }

  // Pass 3: Bind all routes to Express
  for (const { endpoint, handler, validateInput, validateOutput } of handlers.values()) {
    const method = endpoint.method.toLowerCase();

    if (typeof app[method] !== 'function') {
      throw new Error(`Unsupported method ${endpoint.method} for ${endpoint.path}`);
    }

    logger.info(`Binding ${endpoint.method} ${endpoint.path} -> ${endpoint.name}`);

    app[method](endpoint.path, async (req, res) => {
      const input = endpoint.method === 'GET' ? req.query : req.body;

      if (validateInput && !validateInput(input)) {
        return res.status(400).json({ error: 'Invalid request', details: validateInput.errors });
      }

      try {
        const output = await handler(input, req);

        if (validateOutput && !validateOutput(output)) {
          return res.status(500).json({
            error: 'Handler output failed validation',
            details: validateOutput.errors
          });
        }

        // If output is a string (no outputSchema), send as plain text
        if (typeof output === 'string') {
          return res.type('text/plain').send(output);
        }

        return res.json(output);
      } catch (err) {
        logger.error(`Error in handler ${endpoint.name}: ${err.message}`);
        return res.status(500).json({ error: 'Handler error', detail: err.message });
      }
    });
  }

  const server = app.listen(port, () => {
    logger.info(`ai-lambda-service listening on http://localhost:${port}`);
  });

  currentServer = server;

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    await stopServer();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

async function stopServer() {
  if (!currentServer) return false;

  await new Promise((resolve) => {
    currentServer.close(() => resolve());
  });
  currentServer = null;
  return true;
}

let restartTimeout = null;

function scheduleRestart(logger) {
  // Debounce restarts (allow multiple changes before restart)
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  restartTimeout = setTimeout(async () => {
    logger.info('Restarting server to apply config changes...');

    try {
      // Store current values
      const configPath = currentConfigPath;
      const port = currentPort;
      const loggerToUse = currentLogger;

      // Stop current server
      await stopServer();

      // Reload config from disk
      const { loadConfig } = require('./config');
      const newConfig = await loadConfig(configPath, loggerToUse);

      // Start new server
      await startServer({
        config: newConfig,
        port,
        logger: loggerToUse,
        configPath
      });

      logger.info('Server restarted successfully');
    } catch (err) {
      logger.error(`Failed to restart server: ${err.message}`);
      process.exit(1);
    }
  }, 2000); // Wait 2 seconds to allow multiple changes
}

module.exports = { startServer, stopServer };
