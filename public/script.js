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

// Default settings
let settings = {
  provider: 'openai',
  openaiApiKey: '',
  openaiModel: 'gpt-3.5-turbo',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: '',
  temperature: 0.1
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
    
    toggleProviderSettings();
    updateModelBadge();
  }
}

// Function to update the model badge
function updateModelBadge() {
  if (!currentModelBadge) return;
  
  // Remove all classes first
  currentModelBadge.classList.remove('openai', 'ollama');
  
  if (settings.provider === 'openai' && settings.openaiModel) {
    currentModelBadge.textContent = settings.openaiModel;
    currentModelBadge.classList.add('openai');
  } else if (settings.provider === 'ollama' && settings.ollamaModel) {
    currentModelBadge.textContent = settings.ollamaModel;
    currentModelBadge.classList.add('ollama');
  } else {
    currentModelBadge.textContent = 'No model selected';
    currentModelBadge.classList.remove('openai', 'ollama');
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
  
  localStorage.setItem('chatbot-settings', JSON.stringify(settings));
  settingsModal.classList.add('hidden');
  
  // Update the model badge
  updateModelBadge();
  
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
  if (llmProviderSelect.value === 'openai') {
    openaiSettings.classList.remove('hidden');
    ollamaSettings.classList.add('hidden');
    
    // If we have an API key, fetch OpenAI models automatically
    const apiKey = openaiApiKeyInput.value.trim();
    if (apiKey) {
      fetchOpenAIModels();
    }
    
    // Update settings and badge
    settings.provider = 'openai';
    updateModelBadge();
  } else {
    openaiSettings.classList.add('hidden');
    ollamaSettings.classList.remove('hidden');
    
    // Fetch Ollama models when switching to Ollama
    fetchOllamaModels();
    
    // Update settings and badge
    settings.provider = 'ollama';
    updateModelBadge();
  }
}

// Initialize socket.io connection
const socket = io();

// Add event listeners
messageForm.addEventListener('submit', sendMessage);
socket.on('chat response', receiveMessage);
socket.on('processing', showTypingIndicator);

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