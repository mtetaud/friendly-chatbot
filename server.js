import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import fetch from 'node-fetch';

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

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');
  
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
      } else {
        throw new Error(`Unknown provider: ${settings.provider}`);
      }
      
      // Send response back to client
      socket.emit('chat response', response);
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('chat response', `Error: ${error.message}`);
    } finally {
      socket.emit('processing', false);
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