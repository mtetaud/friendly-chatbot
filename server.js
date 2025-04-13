import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

// Convert ESM URL to directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// API endpoint to fetch OpenAI models
app.get('/api/openai-models', async (req, res) => {
  try {
    const apiKey = req.query.api_key;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter to only include chat models
    const chatModels = data.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        name: model.id
      }));
    
    res.json(chatModels);
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch OpenAI models',
      details: error.message 
    });
  }
});

// API endpoint to fetch Ollama models
app.get('/api/ollama-models', async (req, res) => {
  try {
    // Get base URL from request or use default
    let ollamaUrl = req.query.url || 'http://localhost:11434';
    
    // Force IPv4 address to avoid IPv6 issues
    ollamaUrl = ollamaUrl.replace('localhost', '127.0.0.1');
    
    // Normalize URL: remove trailing slashes, ensure it's just the base URL
    ollamaUrl = ollamaUrl.replace(/\/+$/, '').replace(/\/api.*$/, '').replace(/\/v1.*$/, '');
    
    // Construct the correct API endpoint for tags
    const apiUrl = `${ollamaUrl}/api/tags`;
    console.log(`Fetching models from: ${apiUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Models retrieved:', data.models ? data.models.length : 0);
    res.json(data.models || []);
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    // Return a more user-friendly error
    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'Connection to Ollama timed out. Please verify the URL and that Ollama is running.' });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Cannot connect to Ollama server. Please make sure Ollama is running and the URL is correct.',
        details: error.message
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch Ollama models',
        details: error.message
      });
    }
  }
});

// Function to create an MCP server process
function createMcpServerProcess(serverConfig) {
  if (!serverConfig || !serverConfig.command) {
    throw new Error('Invalid MCP server configuration');
  }
  
  const { type, command, args, envVars } = serverConfig;
  
  // Prepare environment variables
  const env = { ...process.env };
  if (Array.isArray(envVars)) {
    envVars.forEach(({ key, value }) => {
      if (key) env[key] = value;
    });
  }
  
  // Split args into array
  const argsArray = args ? args.split(' ').filter(arg => arg.trim()) : [];
  
  console.log(`Starting MCP server: ${command} ${argsArray.join(' ')}`);
  
  // Spawn the process
  const mcpProcess = spawn(command, argsArray, {
    env,
    shell: true,
    stdio: 'pipe'
  });
  
  // Log process events
  mcpProcess.on('error', (err) => {
    console.error('Failed to start MCP server process:', err);
  });
  
  // Keep track of server output for later analysis
  mcpProcess.serverOutput = {
    stdout: [],
    stderr: []
  };
  
  mcpProcess.stdout.on('data', (data) => {
    const dataStr = data.toString();
    console.log(`MCP server stdout: ${dataStr}`);
    // Store output for later analysis
    mcpProcess.serverOutput.stdout.push(dataStr);
  });
  
  mcpProcess.stderr.on('data', (data) => {
    const dataStr = data.toString();
    console.error(`MCP server stderr: ${dataStr}`);
    // Store stderr output for later analysis
    mcpProcess.serverOutput.stderr.push(dataStr);
  });
  
  mcpProcess.on('close', (code) => {
    console.log(`MCP server process exited with code ${code}`);
  });
  
  // Add additional property to store available tools
  mcpProcess.availableTools = [];
  mcpProcess.serverConfig = serverConfig;
  
  // Attempt to analyze server output after initialization
  setTimeout(async () => {
    console.log('MCP process initialized');
    
    // If we have stderr output, try to analyze it for tools
    if (mcpProcess.serverOutput && mcpProcess.serverOutput.stderr.length > 0) {
      console.log('Analyzing server startup messages for tools...');
      
      // Join all stderr lines for analysis
      const stderrContent = mcpProcess.serverOutput.stderr.join('\n');
      
      // Various regex patterns that might extract tools from startup logs
      const patterns = [
        // Look for "Available tools:" or similar phrases followed by a list
        /(?:available|supported)\s+(?:tools|commands|functions)(?:\s*:\s*|\s+are\s+)([^]*?)(?:\n\n|\n[^\s]|$)/i,
        
        // Look for numbered/bulleted lists that might contain tools
        /(?:^|\n)(?:\d+\.\s+|\*\s+|\-\s+)([a-zA-Z0-9_]+)(?:\s+-\s+|:\s+)(.*?)(?:\n|$)/gim,
        
        // Look for tool names in quotes
        /"([a-zA-Z0-9_-]+)"(?:\s*:\s*|\s+-\s+)(.*?)(?:,|\n|$)/gim
      ];
      
      let extractedTools = [];
      
      // Try each pattern
      for (const pattern of patterns) {
        if (pattern.global) {
          // For global patterns that extract multiple matches
          let match;
          while ((match = pattern.exec(stderrContent)) !== null) {
            if (match.length >= 3) {
              extractedTools.push({
                name: match[1].trim(),
                description: match[2].trim()
              });
            }
          }
        } else {
          // For patterns that extract a whole block
          const match = stderrContent.match(pattern);
          if (match && match.length > 1) {
            // Split the block into lines and extract tools
            const toolsBlock = match[1];
            const toolLines = toolsBlock.split('\n');
            
            for (const line of toolLines) {
              // Try to extract tool name and optional description
              const toolMatch = line.match(/^\s*([a-zA-Z0-9_-]+)(?:\s*:\s*|\s+-\s+|\s+)?(.*)?$/);
              if (toolMatch && toolMatch.length > 1) {
                extractedTools.push({
                  name: toolMatch[1].trim(),
                  description: (toolMatch[2] || '').trim()
                });
              }
            }
          }
        }
      }
      
      // If we found tools, store them
      if (extractedTools.length > 0) {
        console.log(`Found ${extractedTools.length} tools in server startup messages`);
        mcpProcess.availableTools = extractedTools;
      } else {
        console.log('No tools found in server startup messages');
        
        // If no tools found via regex, create dummy tools based on MCP name
        // This at least gives some UI feedback to the user
        mcpProcess.availableTools = [
          {
            name: `${serverConfig.name || 'MCP'} Tool Agent`,
            description: 'This MCP agent provides tools but could not automatically detect them.'
          }
        ];
      }
    }
  }, 1500);
  
  return mcpProcess;
}

// Function to get available MCP tools
async function getMcpTools(mcpProcess) {
  if (!mcpProcess || mcpProcess.exitCode !== null) {
    throw new Error('MCP server process is not running');
  }
  
  // Extract tools from server output
  function extractToolsFromOutput() {
    // First check if we already have extracted tools
    if (mcpProcess.availableTools && mcpProcess.availableTools.length > 0) {
      console.log(`Using ${mcpProcess.availableTools.length} pre-extracted tools`);
      return mcpProcess.availableTools;
    }
    
    const tools = [];
    const serverName = mcpProcess.serverConfig?.name || 'MCP Server';
    
    // Combine stdout and stderr for analysis
    const allOutput = [
      ...(mcpProcess.serverOutput?.stdout || []),
      ...(mcpProcess.serverOutput?.stderr || [])
    ].join('\n');
    
    if (!allOutput) {
      console.log('No server output available to extract tools');
      return [{ 
        name: `${serverName} Agent`,
        description: 'This MCP agent provides assistant tools'
      }];
    }
    
    console.log(`Analyzing ${allOutput.length} characters of server output`);
    
    // Look for common patterns in output
    const patterns = [
      // Look for "Available tools:" or similar phrases followed by a list
      /(?:available|supported)\s+(?:tools|commands|functions)(?:\s*:\s*|\s+are\s+)([^]*?)(?:\n\n|\n[^\s]|$)/i,
      
      // Look for numbered/bulleted lists that might contain tools
      /(?:^|\n)(?:\d+\.\s+|\*\s+|\-\s+)([a-zA-Z0-9_]+)(?:\s+-\s+|:\s+)(.*?)(?:\n|$)/g,
      
      // Look for tool names in quotes
      /"([a-zA-Z0-9_-]+)"(?:\s*:\s*|\s+-\s+)(.*?)(?:,|\n|$)/g
    ];
    
    // Try each pattern
    for (const pattern of patterns) {
      if (pattern.global) {
        // For global patterns that extract multiple matches
        let match;
        while ((match = pattern.exec(allOutput)) !== null) {
          if (match.length >= 3) {
            tools.push({
              name: match[1].trim(),
              description: match[2].trim(),
              serverName
            });
          }
        }
      } else {
        // For patterns that extract a whole block
        const match = allOutput.match(pattern);
        if (match && match.length > 1) {
          // Split the block into lines and extract tools
          const toolsBlock = match[1];
          const toolLines = toolsBlock.split('\n');
          
          for (const line of toolLines) {
            // Try to extract tool name and optional description
            const toolMatch = line.match(/^\s*([a-zA-Z0-9_-]+)(?:\s*:\s*|\s+-\s+|\s+)?(.*)?$/);
            if (toolMatch && toolMatch.length > 1) {
              tools.push({
                name: toolMatch[1].trim(),
                description: (toolMatch[2] || '').trim(),
                serverName
              });
            }
          }
        }
      }
    }
    
    // Special case for specific tools common in MCP servers
    const commonToolKeywords = [
      'search', 'browser', 'web', 'google', 'bing', 'wikipedia', 
      'calculator', 'math', 'wolfram', 'python', 'code', 'exec',
      'weather', 'news', 'translate', 'summarize', 'analyze', 'fetch',
      'url', 'api', 'data', 'image', 'scrape', 'extract', 'query',
      'find', 'lookup', 'airbnb', 'hotel', 'booking', 'travel',
      'recommendation', 'review', 'price', 'location', 'filter',
      'sort', 'compare', 'request', 'get', 'post', 'read', 'write'
    ];
    
    // For Airbnb MCP specifically, add these known tools
    if (serverName.toLowerCase().includes('airbnb')) {
      console.log('Adding Airbnb-specific tools');
      [
        { name: 'SearchListings', description: 'Search for Airbnb listings by location, dates, and filters' },
        { name: 'GetListingDetails', description: 'Get detailed information about a specific Airbnb listing' },
        { name: 'CheckAvailability', description: 'Check availability for a listing on specific dates' },
        { name: 'GetReviews', description: 'Get reviews for a specific listing' },
        { name: 'GetPricing', description: 'Get pricing information including fees and taxes' },
        { name: 'SearchExperiences', description: 'Search for Airbnb experiences' },
        { name: 'GetHostInfo', description: 'Get information about a listing host' },
        { name: 'GetRecommendations', description: 'Get personalized recommendations based on preferences' },
        { name: 'FilterListings', description: 'Filter listings by various criteria' },
        { name: 'WebBrowsing', description: 'Browse the Airbnb website for information' }
      ].forEach(tool => {
        if (!tools.some(t => t.name === tool.name)) {
          tools.push({
            ...tool,
            serverName,
            inferred: true
          });
        }
      });
    }
    
    // Look for these common keywords in the output
    for (const keyword of commonToolKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(allOutput) && !tools.some(t => t.name.toLowerCase() === keyword.toLowerCase())) {
        tools.push({
          name: keyword.charAt(0).toUpperCase() + keyword.slice(1),
          description: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} tool`,
          serverName,
          inferred: true
        });
      }
    }
    
    // If we found tools, store them
    if (tools.length > 0) {
      console.log(`Extracted ${tools.length} tools from server output`);
      mcpProcess.availableTools = tools;
      return tools;
    }
    
    // If no tools found, create default tools
    console.log('No tools extracted, using default tools');
    const defaultTools = [
      {
        name: `${serverName}`,
        description: 'General purpose MCP agent',
        serverName
      }
    ];
    
    mcpProcess.availableTools = defaultTools;
    return defaultTools;
  }
  
  // Try to send commands to the MCP process, but don't wait for responses
  try {
    // Send various commands, hoping one will work
    console.log('Sending commands to MCP server to discover tools...');
    const commands = [
      { command: 'list_tools' },
      { command: 'get_tools' },
      { command: 'get_capabilities' },
      { action: 'list_tools' },
      { command: 'help' },
      {}  // Empty command as last resort
    ];
    
    // Send the commands with delays
    for (let i = 0; i < commands.length; i++) {
      setTimeout(() => {
        try {
          mcpProcess.stdin.write(JSON.stringify(commands[i]) + '\n');
        } catch (e) {
          console.error('Error sending command to MCP:', e);
        }
      }, i * 500);  // 500ms between commands
    }
  } catch (error) {
    console.error('Error sending commands to MCP process:', error);
  }
  
  // Don't wait for responses, just extract tools from output and return
  return extractToolsFromOutput();
}

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Keep track of MCP process for this socket
  let mcpProcess = null;
  
  // Keep track of conversation history for each socket connection
  const conversationHistory = [
    {
      role: "system",
      content: "You are a helpful, friendly assistant. Respond concisely and clearly to the user's questions."
    }
  ];
  
  // Handle chat messages
  socket.on('chat message', async (data) => {
    try {
      // Let the client know we're processing
      socket.emit('processing', true);
      
      // Extract message and settings
      const { message, settings } = data;
      let response;
      
      // Check if we have MCP servers configured
      const hasMcpServers = settings.mcpServers && settings.mcpServers.length > 0;
      
      // Create a dictionary to store MCP processes
      const mcpProcesses = {};
      
      // Initialize MCP processes if needed
      if (hasMcpServers) {
        for (const serverConfig of settings.mcpServers) {
          try {
            const serverId = serverConfig.name || `server-${Math.random().toString(36).substring(2, 9)}`;
            mcpProcesses[serverId] = createMcpServerProcess(serverConfig);
          } catch (error) {
            console.error(`Error initializing MCP server "${serverConfig.name}":`, error);
          }
        }
      }
      
      // Process with LLM provider
      if (settings.provider === 'openai') {
        // Call OpenAI API directly
        console.log(`Using OpenAI (${settings.openaiModel}) with temperature ${settings.temperature}`);
        
        // Get the API key from settings or environment variable
        const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
          throw new Error('OpenAI API key is required. Please provide it in the settings.');
        }
        
        // Add the user message to conversation history
        conversationHistory.push({
          role: "user",
          content: message
        });
        
        // Create the request for OpenAI's chat completion API
        const requestBody = {
          model: settings.openaiModel || 'gpt-3.5-turbo',
          messages: [...conversationHistory],
          temperature: parseFloat(settings.temperature) || 0.1,
          max_tokens: 2000,
          n: 1
        };
        
        console.log('Sending request to OpenAI API');
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!openaiResponse.ok) {
          let errorMessage = `OpenAI API error (${openaiResponse.status})`;
          try {
            const errorData = await openaiResponse.json();
            errorMessage += `: ${errorData.error?.message || JSON.stringify(errorData)}`;
          } catch (e) {
            const errorText = await openaiResponse.text();
            errorMessage += `: ${errorText}`;
          }
          throw new Error(errorMessage);
        }
        
        const result = await openaiResponse.json();
        response = result.choices[0].message.content;
        
        // Add the assistant's response to conversation history
        conversationHistory.push({
          role: "assistant",
          content: response
        });
        
        // Limit conversation history to avoid context length issues
        if (conversationHistory.length > 21) {
          // Keep system message and remove oldest user+assistant exchange
          conversationHistory.splice(1, 2);
        }
      } else if (settings.provider === 'ollama') {
        // Call Ollama API directly based on documentation
        console.log(`Using Ollama (${settings.ollamaModel}) with temperature ${settings.temperature}`);
        
        // Normalize Ollama URL
        let ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
        ollamaUrl = ollamaUrl.replace('localhost', '127.0.0.1');
        ollamaUrl = ollamaUrl.replace(/\/+$/, '').replace(/\/api.*$/, '').replace(/\/v1.*$/, '');
        
        // Use the chat endpoint which supports conversation format
        const apiUrl = `${ollamaUrl}/api/chat`;
        
        // Add the user message to conversation history
        conversationHistory.push({
          role: "user",
          content: message
        });
        
        // Check if a model is selected
        if (!settings.ollamaModel) {
          throw new Error('Please select an Ollama model from the settings menu');
        }

        // Create the request body according to Ollama API docs
        const requestBody = {
          model: settings.ollamaModel,
          messages: [...conversationHistory], // Send the full conversation history
          stream: false,
          options: {
            temperature: parseFloat(settings.temperature) || 0
          }
        };
        
        console.log(`Sending request to Ollama API: ${apiUrl}`);
        
        const ollamaResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!ollamaResponse.ok) {
          const errorText = await ollamaResponse.text();
          throw new Error(`Ollama API error (${ollamaResponse.status}): ${errorText}`);
        }
        
        const result = await ollamaResponse.json();
        // The chat API returns a message object with a content property
        response = result.message?.content || "No response content received";
        
        // Add the assistant's response to conversation history
        conversationHistory.push({
          role: "assistant",
          content: response
        });
        
        // Limit conversation history to last 10 messages to avoid context length issues
        if (conversationHistory.length > 21) { // system message + 10 user messages + 10 assistant messages
          // Keep system message and remove oldest user+assistant exchange
          conversationHistory.splice(1, 2);
        }
      } else if (settings.provider === 'mcp') {
        // Handle MCP server communication
        console.log(`Using MCP server with command: ${settings.mcpServer.command}`);
        
        try {
          // If no MCP process exists or it has exited, create a new one
          if (!mcpProcess || mcpProcess.exitCode !== null) {
            mcpProcess = createMcpServerProcess(settings);
            
            // Try to get available tools after process starts
            setTimeout(async () => {
              try {
                await getMcpTools(mcpProcess);
                // Notify client that tools are available
                socket.emit('mcp tools', { tools: mcpProcess.availableTools });
              } catch (error) {
                console.error('Error getting initial MCP tools:', error);
              }
            }, 1000); // Wait 1 second for the process to initialize
          }
          
          // Prepare input for MCP
          const mcpInput = {
            message: message,
            history: conversationHistory.slice(1)  // Skip system message for MCP
          };
          
          // Write to MCP process stdin
          mcpProcess.stdin.write(JSON.stringify(mcpInput) + '\n');
          
          // Set up a Promise to handle MCP response with timeout
          const mcpResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('MCP server response timed out after 60 seconds'));
            }, 60000);
            
            // Buffer to collect stdout data
            let dataBuffer = '';
            
            // Handler for stdout data
            const dataHandler = (data) => {
              dataBuffer += data.toString();
              
              try {
                // Try to parse the buffer as JSON to see if we have a complete response
                const parsed = JSON.parse(dataBuffer);
                
                // If successful, we have a complete response
                clearTimeout(timeout);
                mcpProcess.stdout.removeListener('data', dataHandler);
                resolve(parsed);
              } catch (e) {
                // Not complete JSON yet, continue listening
              }
            };
            
            // Listen for response data
            mcpProcess.stdout.on('data', dataHandler);
            
            // Handle process errors
            mcpProcess.on('error', (err) => {
              clearTimeout(timeout);
              mcpProcess.stdout.removeListener('data', dataHandler);
              reject(new Error(`MCP server error: ${err.message}`));
            });
            
            // Handle process exit
            mcpProcess.on('exit', (code) => {
              if (code !== 0) {
                clearTimeout(timeout);
                mcpProcess.stdout.removeListener('data', dataHandler);
                reject(new Error(`MCP server exited with code ${code}`));
              }
            });
          });
          
          // Extract the response content from MCP response
          response = mcpResponse.response || mcpResponse.message || 'No response from MCP server';
          
          // Add the assistant's response to conversation history
          conversationHistory.push({
            role: "assistant",
            content: response
          });
          
          // Limit conversation history to avoid context length issues
          if (conversationHistory.length > 21) {
            // Keep system message and remove oldest user+assistant exchange
            conversationHistory.splice(1, 2);
          }
        } catch (error) {
          console.error('MCP Server Error:', error);
          throw error;
        }
      } else {
        throw new Error(`Unknown provider: ${settings.provider}`);
      }
      
      // If we have MCP servers and tools, we might augment the response
      // This could be implemented later to include MCP tools in the context
      // regardless of the provider being used
      
      // Send response back to client
      socket.emit('chat response', response);
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('chat response', `Error: ${error.message}`);
    } finally {
      socket.emit('processing', false);
    }
  });
  
// Handle MCP tools request
  socket.on('get mcp tools', async (data) => {
    try {
      // Get MCP servers list from the client
      const mcpServers = data?.mcpServers || [];
      
      if (mcpServers.length === 0) {
        socket.emit('mcp tools', { error: 'No MCP servers configured' });
        return;
      }
      
      // Combine all tools from all servers
      let allTools = [];
      let errorMessages = [];
      
      // Process each server
      console.log(`Processing ${mcpServers.length} MCP servers...`);
      
      for (const serverConfig of mcpServers) {
        try {
          console.log(`Starting MCP server: ${serverConfig.name || 'Unnamed'}`);
          // Create a process for the server
          const mcpProcess = createMcpServerProcess(serverConfig);
          
          // Wait briefly for the process to start
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try to get tools - this now returns immediately without waiting for a response
          const tools = await getMcpTools(mcpProcess);
          
          console.log(`Got ${tools.length} tools from server ${serverConfig.name || 'Unnamed'}`);
          
          // Add each tool to our list with server name attached
          const serverTools = tools.map(tool => ({
            ...tool,
            serverName: serverConfig.name || 'Unnamed Server'
          }));
          
          allTools = [...allTools, ...serverTools];
        } catch (error) {
          console.error(`Error with MCP server "${serverConfig.name}":`, error);
          errorMessages.push(`${serverConfig.name}: ${error.message}`);
          
          // Even if there's an error, add a placeholder tool
          allTools.push({
            name: serverConfig.name || 'MCP Server',
            description: `Error: ${error.message}`,
            serverName: serverConfig.name || 'Unnamed Server',
            error: true
          });
        }
      }
      
      // Return tools, even if partial
      socket.emit('mcp tools', { tools: allTools });
      
      // Log any errors for debugging
      if (errorMessages.length > 0) {
        console.warn(`MCP server errors: ${errorMessages.join('; ')}`);
      }
    } catch (error) {
      console.error('Error getting MCP tools:', error);
      socket.emit('mcp tools', { error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});