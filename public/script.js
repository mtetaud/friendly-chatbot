// DOM elements
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsButton = document.getElementById('close-settings');
const saveSettingsButton = document.getElementById('save-settings');
const llmProviderSelect = document.getElementById('llm-provider');
const openaiSettings = document.getElementById('openai-settings');
const ollamaSettings = document.getElementById('ollama-settings');
const temperatureSlider = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');
const openaiApiKeyInput = document.getElementById('openai-api-key');
const openaiModelSelect = document.getElementById('openai-model');
const ollamaUrlInput = document.getElementById('ollama-url');
const ollamaModelSelect = document.getElementById('ollama-model');
const refreshModelsButton = document.getElementById('refresh-models');
const modelsLoadingIndicator = document.getElementById('models-loading');
const currentModelBadge = document.querySelector('.model-badge');

// MCP Server Configuration DOM elements
const mcpServerTypeSelect = document.getElementById('mcp-server-type');
const mcpCommandInput = document.getElementById('mcp-command');
const mcpCommandArgsInput = document.getElementById('mcp-command-args');
const pickCommandButton = document.getElementById('pick-command');
const pickArgsButton = document.getElementById('pick-args');
const mcpEnvVarsTable = document.getElementById('mcp-env-vars');
const addEnvVarButton = document.getElementById('add-env-var');
const mcpServersList = document.getElementById('mcp-servers-list');
const addMcpServerButton = document.getElementById('add-mcp-server');
const mcpServerForm = document.getElementById('mcp-server-form');
const mcpServerNameInput = document.getElementById('mcp-server-name');
const saveMcpServerButton = document.getElementById('save-mcp-server');
const cancelMcpServerButton = document.getElementById('cancel-mcp-server');
const mcpFormTitle = document.getElementById('mcp-form-title');

// MCP Tools DOM elements
const mcpToolsBadge = document.getElementById('mcp-tools-badge');
const mcpToolsCount = document.getElementById('mcp-tools-count');
const mcpToolsList = document.getElementById('mcp-tools-list');

// Variable to track current MCP server being edited (null for new server)
let currentEditingMcpServerIndex = null;

// Default settings
let settings = {
  provider: 'openai',
  openaiApiKey: '',
  openaiModel: 'gpt-3.5-turbo',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: '',
  temperature: 0.1,
  mcpServers: [] // Liste de serveurs MCP
};

// Load settings from localStorage if available
function loadSettings() {
  const savedSettings = localStorage.getItem('chatbot-settings');
  if (savedSettings) {
    settings = JSON.parse(savedSettings);
    
    // Update UI to match saved settings
    llmProviderSelect.value = settings.provider;
    document.getElementById('openai-api-key').value = settings.openaiApiKey || '';
    document.getElementById('openai-model').value = settings.openaiModel || 'gpt-3.5-turbo';
    document.getElementById('ollama-url').value = settings.ollamaUrl || 'http://localhost:11434';
    // Only set model value if it exists
    const ollamaModelElement = document.getElementById('ollama-model');
    if (settings.ollamaModel && ollamaModelElement.options.length > 0) {
      ollamaModelElement.value = settings.ollamaModel;
    }
    temperatureSlider.value = settings.temperature;
    temperatureValue.textContent = settings.temperature;
    
    // Load MCP servers if they exist
    if (!settings.mcpServers) {
      settings.mcpServers = [];
    }
    
    // Render the MCP servers list
    renderMcpServersList();
    
    toggleProviderSettings();
    updateModelBadge();
  }
}

// Function to render the list of MCP servers
function renderMcpServersList() {
  // Clear the list
  mcpServersList.innerHTML = '';
  
  if (settings.mcpServers.length === 0) {
    // Show empty message
    mcpServersList.innerHTML = '<div class="empty-list-message">No MCP servers configured.</div>';
    return;
  }
  
  // Add each server to the list
  settings.mcpServers.forEach((server, index) => {
    const serverItem = document.createElement('div');
    serverItem.classList.add('mcp-server-item');
    
    const serverInfo = document.createElement('div');
    serverInfo.classList.add('mcp-server-info');
    
    const serverName = document.createElement('div');
    serverName.classList.add('mcp-server-name');
    serverName.innerHTML = `<span class="mcp-server-inactive"></span>${server.name || 'Unnamed Server'}`;
    
    const serverDetails = document.createElement('div');
    serverDetails.classList.add('mcp-server-details');
    serverDetails.textContent = `${server.command} ${server.args || ''}`;
    
    const serverActions = document.createElement('div');
    serverActions.classList.add('mcp-server-actions');
    
    const editButton = document.createElement('button');
    editButton.classList.add('mcp-server-action', 'edit');
    editButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';
    editButton.title = 'Edit Server';
    editButton.addEventListener('click', () => editMcpServer(index));
    
    const deleteButton = document.createElement('button');
    deleteButton.classList.add('mcp-server-action', 'delete');
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteButton.title = 'Delete Server';
    deleteButton.addEventListener('click', () => deleteMcpServer(index));
    
    serverInfo.appendChild(serverName);
    serverInfo.appendChild(serverDetails);
    serverActions.appendChild(editButton);
    serverActions.appendChild(deleteButton);
    
    serverItem.appendChild(serverInfo);
    serverItem.appendChild(serverActions);
    
    mcpServersList.appendChild(serverItem);
  });
}

// Function to show the MCP server form for adding a new server
function showAddMcpServerForm() {
  // Reset the form
  mcpFormTitle.textContent = 'Add MCP Server';
  mcpServerNameInput.value = '';
  mcpServerTypeSelect.value = 'stdio';
  mcpCommandInput.value = '';
  mcpCommandArgsInput.value = '';
  
  // Clear environment variables except the first row
  while (mcpEnvVarsTable.rows.length > 2) {
    mcpEnvVarsTable.deleteRow(2);
  }
  
  // Clear the first row inputs
  const firstRow = mcpEnvVarsTable.rows[1];
  firstRow.cells[0].querySelector('input').value = '';
  firstRow.cells[1].querySelector('input').value = '';
  
  // Show the form
  mcpServerForm.classList.remove('hidden');
  currentEditingMcpServerIndex = null;
}

// Function to edit an existing MCP server
function editMcpServer(index) {
  const server = settings.mcpServers[index];
  if (!server) return;
  
  // Set form values
  mcpFormTitle.textContent = 'Edit MCP Server';
  mcpServerNameInput.value = server.name || '';
  mcpServerTypeSelect.value = server.type || 'stdio';
  mcpCommandInput.value = server.command || '';
  mcpCommandArgsInput.value = server.args || '';
  
  // Clear environment variables except the first row
  while (mcpEnvVarsTable.rows.length > 2) {
    mcpEnvVarsTable.deleteRow(2);
  }
  
  // Set environment variables
  if (server.envVars && server.envVars.length > 0) {
    // Set the first row to the first environment variable
    const firstRow = mcpEnvVarsTable.rows[1];
    firstRow.cells[0].querySelector('input').value = server.envVars[0].key || '';
    firstRow.cells[1].querySelector('input').value = server.envVars[0].value || '';
    
    // Add the rest of the environment variables
    for (let i = 1; i < server.envVars.length; i++) {
      addEnvVarRow(server.envVars[i]);
    }
  } else {
    // Clear the first row
    const firstRow = mcpEnvVarsTable.rows[1];
    firstRow.cells[0].querySelector('input').value = '';
    firstRow.cells[1].querySelector('input').value = '';
  }
  
  // Show the form
  mcpServerForm.classList.remove('hidden');
  currentEditingMcpServerIndex = index;
}

// Function to delete an MCP server
function deleteMcpServer(index) {
  if (confirm('Are you sure you want to delete this MCP server?')) {
    settings.mcpServers.splice(index, 1);
    renderMcpServersList();
  }
}

// Function to save the current MCP server form
function saveMcpServerForm() {
  const name = mcpServerNameInput.value.trim() || 'Unnamed Server';
  const type = mcpServerTypeSelect.value;
  const command = mcpCommandInput.value.trim();
  const args = mcpCommandArgsInput.value.trim();
  
  if (!command) {
    alert('Command is required');
    return;
  }
  
  // Get environment variables
  const envVars = [];
  const rows = mcpEnvVarsTable.rows;
  for (let i = 1; i < rows.length; i++) {
    const keyInput = rows[i].cells[0].querySelector('input');
    const valueInput = rows[i].cells[1].querySelector('input');
    
    // Only add non-empty key-value pairs
    if (keyInput.value.trim()) {
      envVars.push({
        key: keyInput.value.trim(),
        value: valueInput.value
      });
    }
  }
  
  const server = {
    name,
    type,
    command,
    args,
    envVars
  };
  
  if (currentEditingMcpServerIndex !== null) {
    // Edit existing server
    settings.mcpServers[currentEditingMcpServerIndex] = server;
  } else {
    // Add new server
    settings.mcpServers.push(server);
  }
  
  // Hide the form
  mcpServerForm.classList.add('hidden');
  currentEditingMcpServerIndex = null;
  
  // Update the list
  renderMcpServersList();
}

// Function to add an environment variable row
function addEnvVarRow(envVar = { key: '', value: '' }) {
  const rowCount = mcpEnvVarsTable.rows.length;
  const row = mcpEnvVarsTable.insertRow(rowCount);
  
  const keyCell = row.insertCell(0);
  const valueCell = row.insertCell(1);
  const actionCell = row.insertCell(2);
  
  keyCell.innerHTML = `<input type="text" class="env-key settings-input" placeholder="Key" value="${envVar.key}">`;
  valueCell.innerHTML = `<input type="text" class="env-value settings-input" placeholder="Value" value="${envVar.value}">`;
  actionCell.innerHTML = `<button type="button" class="remove-env-var">✕</button>`;
  
  // Add event listener to the remove button
  actionCell.querySelector('.remove-env-var').addEventListener('click', function() {
    mcpEnvVarsTable.deleteRow(row.rowIndex);
  });
}

// Function to update the model badge
function updateModelBadge() {
  if (!currentModelBadge) return;
  
  // Remove all classes first
  currentModelBadge.classList.remove('openai', 'ollama', 'mcp');
  
  if (settings.provider === 'openai' && settings.openaiModel) {
    currentModelBadge.textContent = settings.openaiModel;
    currentModelBadge.classList.add('openai');
  } else if (settings.provider === 'ollama' && settings.ollamaModel) {
    currentModelBadge.textContent = settings.ollamaModel;
    currentModelBadge.classList.add('ollama');
  } else if (settings.provider === 'mcp') {
    currentModelBadge.textContent = 'MCP Server';
    currentModelBadge.classList.add('mcp');
  } else {
    currentModelBadge.textContent = 'No model selected';
  }
}

// Save settings to localStorage
function saveSettings() {
  settings.provider = llmProviderSelect.value;
  settings.openaiApiKey = document.getElementById('openai-api-key').value;
  settings.openaiModel = document.getElementById('openai-model').value;
  settings.ollamaUrl = document.getElementById('ollama-url').value;
  settings.ollamaModel = document.getElementById('ollama-model').value;
  settings.temperature = parseFloat(temperatureSlider.value);
  
  // No need to save MCP servers here as they are saved when added/edited/deleted
  
  localStorage.setItem('chatbot-settings', JSON.stringify(settings));
  settingsModal.classList.add('hidden');
  
  // Update the model badge
  updateModelBadge();
  
  // Request MCP tools if using MCP servers
  if (settings.mcpServers && settings.mcpServers.length > 0) {
    requestMcpTools();
  }
  
  // Show confirmation
  addSystemMessageToUI('Settings saved successfully!');
}

// Function to fetch available OpenAI models
async function fetchOpenAIModels() {
  const apiKey = openaiApiKeyInput.value.trim();
  if (!apiKey) {
    // Show a message that API key is required
    const modelsLoadingIndicator = document.getElementById('openai-models-loading');
    modelsLoadingIndicator.style.visibility = 'visible';
    modelsLoadingIndicator.textContent = 'API key required to fetch models';
    modelsLoadingIndicator.style.color = '#e53e3e';
    
    setTimeout(() => {
      modelsLoadingIndicator.style.visibility = 'hidden';
      modelsLoadingIndicator.style.color = '#666'; // Reset color
    }, 3000);
    return;
  }
  
  // Show loading indicator
  const modelsLoadingIndicator = document.getElementById('openai-models-loading');
  modelsLoadingIndicator.style.visibility = 'visible'; // Use visibility instead of hidden class
  modelsLoadingIndicator.textContent = 'Loading models...';
  const refreshButton = document.getElementById('refresh-openai-models');
  refreshButton.classList.add('refreshing');
  
  try {
    const response = await fetch(`/api/openai-models?api_key=${encodeURIComponent(apiKey)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `Failed to fetch models: ${response.statusText}`);
    }
    
    // Define standard models that should always be available
    const standardModels = [
      'gpt-3.5-turbo',
      'gpt-4o',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-vision-preview',
      'gpt-3.5-turbo-16k'
    ];
    
    // Clear existing options
    while (openaiModelSelect.options.length > 0) {
      openaiModelSelect.remove(0);
    }
    
    // Always add the standard models first
    standardModels.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      openaiModelSelect.appendChild(option);
    });
    
    if (Array.isArray(data) && data.length > 0) {
      // Then add any additional models that aren't in the standard models
      data.forEach(model => {
        if (!standardModels.includes(model.id)) {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = model.id;
          openaiModelSelect.appendChild(option);
        }
      });
      
      // Set selected value if it exists in the list
      const currentModel = settings.openaiModel;
      for (let i = 0; i < openaiModelSelect.options.length; i++) {
        if (openaiModelSelect.options[i].value === currentModel) {
          openaiModelSelect.selectedIndex = i;
          break;
        }
      }
      
      modelsLoadingIndicator.textContent = `Found models`;
      // Instead of hiding completely, we just make text invisible after timeout
      setTimeout(() => {
        modelsLoadingIndicator.style.visibility = 'hidden';
      }, 2000);
    } else {
      modelsLoadingIndicator.textContent = 'No models found';
      // Instead of hiding completely, we just make text invisible after timeout
      setTimeout(() => {
        modelsLoadingIndicator.style.visibility = 'hidden';
      }, 3000);
    }
    
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    modelsLoadingIndicator.textContent = `Error: ${error.message}`;
    modelsLoadingIndicator.style.color = '#e53e3e';
    
    // Keep the error visible longer
    setTimeout(() => {
      modelsLoadingIndicator.style.visibility = 'hidden';
      modelsLoadingIndicator.style.color = '#666'; // Reset color
    }, 5000);
  } finally {
    refreshButton.classList.remove('refreshing');
  }
}

// Function to fetch available Ollama models
async function fetchOllamaModels() {
  const url = ollamaUrlInput.value.trim();
  if (!url) return;
  
  // Show loading indicator
  modelsLoadingIndicator.style.visibility = 'visible'; // Use visibility instead of hidden class
  modelsLoadingIndicator.textContent = 'Loading models...';
  refreshModelsButton.classList.add('refreshing');
  
  try {
    // Make sure URL is fixed to include correct format (http:// prefix)
    let formattedUrl = url;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'http://' + formattedUrl;
    }
    
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
    formattedUrl = formattedUrl.replace('localhost', '127.0.0.1');
    
    const response = await fetch(`/api/ollama-models?url=${encodeURIComponent(formattedUrl)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `Failed to fetch models: ${response.statusText}`);
    }
    
    // Clear existing options except the first default one
    while (ollamaModelSelect.options.length > 1) {
      ollamaModelSelect.remove(1);
    }
    
    if (Array.isArray(data) && data.length > 0) {
      // Filter out duplicates by creating a Set of model names
      const uniqueModels = new Set();
      
      // Add new options without duplicates
      data.forEach(model => {
        // Skip if we've already added this model
        if (uniqueModels.has(model.name)) {
          return;
        }
        
        uniqueModels.add(model.name);
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        ollamaModelSelect.appendChild(option);
      });
      
      // Set selected value if it exists in the list
      let modelSelected = false;
      const currentModel = settings.ollamaModel;
      
      if (currentModel) {
        for (let i = 0; i < ollamaModelSelect.options.length; i++) {
          if (ollamaModelSelect.options[i].value === currentModel) {
            ollamaModelSelect.selectedIndex = i;
            modelSelected = true;
            break;
          }
        }
      }
      
      // If no model was selected (or the saved model doesn't exist anymore)
      // automatically select the first one
      if (!modelSelected && ollamaModelSelect.options.length > 0) {
        ollamaModelSelect.selectedIndex = 0;
        settings.ollamaModel = ollamaModelSelect.options[0].value;
      }
      
      modelsLoadingIndicator.textContent = `Found ${data.length} models`;
      // Instead of hiding completely, we just make text invisible after timeout
      setTimeout(() => {
        modelsLoadingIndicator.style.visibility = 'hidden';
      }, 2000);
    } else {
      modelsLoadingIndicator.textContent = 'No models found';
      // Instead of hiding completely, we just make text invisible after timeout
      setTimeout(() => {
        modelsLoadingIndicator.style.visibility = 'hidden';
      }, 3000);
    }
    
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    modelsLoadingIndicator.textContent = `Error: ${error.message}`;
    modelsLoadingIndicator.style.color = '#e53e3e';
    
    // Keep the error visible longer
    setTimeout(() => {
      modelsLoadingIndicator.style.visibility = 'hidden';
      modelsLoadingIndicator.style.color = '#666'; // Reset color
    }, 5000);
  } finally {
    refreshModelsButton.classList.remove('refreshing');
  }
}

// Toggle provider-specific settings
function toggleProviderSettings() {
  // Hide all provider-specific settings first
  openaiSettings.classList.add('hidden');
  ollamaSettings.classList.add('hidden');
  
  if (llmProviderSelect.value === 'openai') {
    openaiSettings.classList.remove('hidden');
    
    // If we have an API key, fetch OpenAI models automatically
    const apiKey = openaiApiKeyInput.value.trim();
    if (apiKey) {
      fetchOpenAIModels();
    }
    
    // Update settings and badge
    settings.provider = 'openai';
    updateModelBadge();
  } else if (llmProviderSelect.value === 'ollama') {
    ollamaSettings.classList.remove('hidden');
    
    // Fetch Ollama models when switching to Ollama
    fetchOllamaModels();
    
    // Update settings and badge
    settings.provider = 'ollama';
    updateModelBadge();
  }
  
  // Always check for MCP servers regardless of provider
  if (settings.mcpServers && settings.mcpServers.length > 0) {
    requestMcpTools();
  }
}

// Initialize socket.io connection
const socket = io();

// Add event listeners
messageForm.addEventListener('submit', sendMessage);
socket.on('chat response', receiveMessage);
socket.on('processing', showTypingIndicator);

// MCP Tools event listeners
socket.on('mcp tools', handleMcpTools);

// Settings event listeners
settingsButton.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsButton.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsButton.addEventListener('click', saveSettings);
llmProviderSelect.addEventListener('change', toggleProviderSettings);
temperatureSlider.addEventListener('input', () => {
  temperatureValue.textContent = temperatureSlider.value;
});

// Ollama settings events
refreshModelsButton.addEventListener('click', fetchOllamaModels);
ollamaUrlInput.addEventListener('blur', fetchOllamaModels);
ollamaModelSelect.addEventListener('change', () => {
  settings.ollamaModel = ollamaModelSelect.value;
  if (settings.provider === 'ollama') {
    updateModelBadge();
  }
});

// OpenAI settings events
document.getElementById('refresh-openai-models').addEventListener('click', fetchOpenAIModels);
openaiApiKeyInput.addEventListener('blur', fetchOpenAIModels);
openaiModelSelect.addEventListener('change', () => {
  settings.openaiModel = openaiModelSelect.value;
  if (settings.provider === 'openai') {
    updateModelBadge();
  }
});

// MCP event listeners
addEnvVarButton.addEventListener('click', function() {
  addEnvVarRow();
});

// MCP Server Form event listeners
addMcpServerButton.addEventListener('click', showAddMcpServerForm);
saveMcpServerButton.addEventListener('click', saveMcpServerForm);
cancelMcpServerButton.addEventListener('click', function() {
  mcpServerForm.classList.add('hidden');
});

// Event handlers for existing remove buttons
document.querySelectorAll('.remove-env-var').forEach(button => {
  button.addEventListener('click', function() {
    const row = this.closest('tr');
    if (row && mcpEnvVarsTable.rows.length > 2) {
      mcpEnvVarsTable.deleteRow(row.rowIndex);
    }
  });
});

// Pick command button
pickCommandButton.addEventListener('click', function() {
  // Future implementation: open file picker dialog
  // For now, simply show a message
  alert('Command picker dialog would open here');
});

// Pick args button
pickArgsButton.addEventListener('click', function() {
  // Future implementation: open file picker dialog
  // For now, simply show a message
  alert('Arguments picker dialog would open here');
});

// Load settings on startup
loadSettings();

// Fetch models for the selected provider with slight delay for better UX
setTimeout(() => {
  if (settings.provider === 'ollama') {
    fetchOllamaModels();
  } else if (settings.provider === 'openai' && settings.openaiApiKey) {
    fetchOpenAIModels();
  }
}, 500);

// Function to request MCP tools
function requestMcpTools() {
  if (settings.mcpServers && settings.mcpServers.length > 0) {
    console.log(`Requesting tools from ${settings.mcpServers.length} MCP servers`);
    
    // Log information about the MCP servers for debugging
    settings.mcpServers.forEach((server, index) => {
      console.log(`MCP Server ${index+1}: ${server.name || 'Unnamed'}, Command: ${server.command} ${server.args || ''}`);
    });
    
    socket.emit('get mcp tools', { mcpServers: settings.mcpServers });
    
    // Show loading indicator for tools
    mcpToolsBadge.classList.remove('hidden');
    mcpToolsCount.textContent = '...';
    
    // Update the tooltip to show loading status
    mcpToolsList.innerHTML = `<div class="mcp-tool-item">
      <div class="tool-name">Loading tools...</div>
      <div class="tool-description">Contacting ${settings.mcpServers.length} MCP server${settings.mcpServers.length > 1 ? 's' : ''}</div>
    </div>`;
  } else {
    // Hide tools badge if no MCP servers configured
    mcpToolsBadge.classList.add('hidden');
  }
}

// Function to handle MCP tools response
function handleMcpTools(data) {
  if (data.error) {
    console.error('Error getting MCP tools:', data.error);
    // Even if there's an error, we'll show a placeholder for tools
    // so users know MCP servers are configured
    if (settings.mcpServers && settings.mcpServers.length > 0) {
      mcpToolsBadge.classList.remove('hidden');
      mcpToolsCount.textContent = '?';
      mcpToolsList.innerHTML = `<div class="mcp-tool-item error">
        <div class="tool-name">Error retrieving tools</div>
        <div class="tool-description">${data.error}</div>
      </div>`;
      return;
    } else {
      mcpToolsBadge.classList.add('hidden');
      return;
    }
  }
  
  const tools = data.tools || [];
  
  if (tools.length === 0) {
    if (settings.mcpServers && settings.mcpServers.length > 0) {
      // Show placeholder for empty tools list
      mcpToolsBadge.classList.remove('hidden');
      mcpToolsCount.textContent = '0';
      mcpToolsList.innerHTML = `<div class="mcp-tool-item">
        <div class="tool-name">No tools found</div>
        <div class="tool-description">Your MCP servers are configured but no tools were detected.</div>
      </div>`;
    } else {
      mcpToolsBadge.classList.add('hidden');
    }
    return;
  }
  
  // Update the tools badge UI with information from the server
  if (tools.length > 0) {
    mcpToolsCount.textContent = tools.length;
    mcpToolsList.innerHTML = '';
    
    // Group tools by server
    const toolsByServer = {};
    tools.forEach(tool => {
      const serverName = tool.serverName || 'Unknown Server';
      if (!toolsByServer[serverName]) {
        toolsByServer[serverName] = [];
      }
      toolsByServer[serverName].push(tool);
    });
    
    // Add each tool to the list, grouped by server
    Object.entries(toolsByServer).forEach(([serverName, serverTools]) => {
      // Add server header
      const serverHeader = document.createElement('div');
      serverHeader.classList.add('mcp-server-header');
      serverHeader.textContent = serverName;
      mcpToolsList.appendChild(serverHeader);
      
      // Add tools for this server
      serverTools.forEach(tool => {
        const toolItem = document.createElement('div');
        toolItem.classList.add('mcp-tool-item');
        
        // Add inferred class if this is an inferred tool
        if (tool.inferred) {
          toolItem.classList.add('inferred');
        }
        
        // Add error class if this is an error
        if (tool.error) {
          toolItem.classList.add('error');
        }
        
        const toolName = document.createElement('div');
        toolName.classList.add('tool-name');
        toolName.textContent = tool.name || 'Unnamed Tool';
        
        const toolDescription = document.createElement('div');
        toolDescription.classList.add('tool-description');
        toolDescription.textContent = tool.description || 'No description available';
        
        toolItem.appendChild(toolName);
        toolItem.appendChild(toolDescription);
        mcpToolsList.appendChild(toolItem);
      });
    });
    
    // Show the tools badge
    mcpToolsBadge.classList.remove('hidden');
    
    // Add system message about tools if first time
    if (!sessionStorage.getItem('mcp-tools-shown')) {
      // Check if we have any inferred tools
      const hasInferredTools = tools.some(tool => tool.inferred);
      
      let message = `${tools.length} MCP tools available for use`;
      if (hasInferredTools) {
        message += ` (some tools are inferred and may not be actually available)`;
      }
      
      addSystemMessageToUI(message);
      sessionStorage.setItem('mcp-tools-shown', 'true');
    }
  }
}

// Function to send messages
function sendMessage(e) {
  e.preventDefault();
  const message = messageInput.value.trim();
  
  if (message) {
    // Add user message to UI
    addMessageToUI('user', message);
    
    // Send to server with settings
    socket.emit('chat message', {
      message: message,
      settings: settings
    });
    
    // Clear input
    messageInput.value = '';
  }
}

// Function to receive messages
function receiveMessage(message) {
  addMessageToUI('bot', message);
  
  // Scroll to the latest message
  scrollToBottom();
}

// Function to show/hide typing indicator
function showTypingIndicator(isTyping) {
  typingIndicator.classList.toggle('hidden', !isTyping);
  if (isTyping) {
    scrollToBottom();
  }
}

// Function to add a message to the UI
function addMessageToUI(sender, content) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);
  
  // Format the content (handle code blocks with ```...)
  const formattedContent = formatMessageContent(content);
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.innerHTML = formattedContent;
  
  messageDiv.appendChild(messageContent);
  messagesContainer.appendChild(messageDiv);
  
  scrollToBottom();
}

// Function to add a system message (notifications, errors, etc.)
function addSystemMessageToUI(content) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', 'system');
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.textContent = content;
  
  messageDiv.appendChild(messageContent);
  messagesContainer.appendChild(messageDiv);
  
  scrollToBottom();
  
  // Auto-hide system messages after 5 seconds
  setTimeout(() => {
    messageDiv.style.opacity = '0';
    setTimeout(() => {
      messagesContainer.removeChild(messageDiv);
    }, 500);
  }, 5000);
}

// Function to format message content (handle code blocks, etc.)
function formatMessageContent(content) {
  // Replace code blocks
  let formatted = content.replace(/```([a-z]*)\n([\s\S]*?)```/g, function(match, language, code) {
    return `<pre><code class="${language}">${escapeHtml(code)}</code></pre>`;
  });
  
  // Replace newlines with <br>
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

// Helper to escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Function to scroll to the bottom of the messages container
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Initial scroll to bottom
scrollToBottom();