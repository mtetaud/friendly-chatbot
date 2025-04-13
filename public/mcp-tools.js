// Function to request MCP tools
function requestMcpTools() {
  if (settings.provider === 'mcp') {
    socket.emit('get mcp tools');
  } else {
    // Hide tools badge if not using MCP
    mcpToolsBadge.classList.add('hidden');
  }
}

// Function to handle MCP tools response
function handleMcpTools(data) {
  if (data.error) {
    console.error('Error getting MCP tools:', data.error);
    mcpToolsBadge.classList.add('hidden');
    return;
  }
  
  const tools = data.tools || [];
  
  if (tools.length === 0) {
    mcpToolsBadge.classList.add('hidden');
    return;
  }
  
  // Update tools count
  mcpToolsCount.textContent = tools.length;
  
  // Clear existing tools list
  mcpToolsList.innerHTML = '';
  
  // Add each tool to the list
  tools.forEach(tool => {
    const toolItem = document.createElement('div');
    toolItem.classList.add('mcp-tool-item');
    
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
  
  // Show the tools badge
  mcpToolsBadge.classList.remove('hidden');
  
  // Add system message about tools if first time
  if (!sessionStorage.getItem('mcp-tools-shown')) {
    addSystemMessageToUI(`${tools.length} MCP tools available for use`);
    sessionStorage.setItem('mcp-tools-shown', 'true');
  }
}