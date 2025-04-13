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