# Friendly Chatbot

A simple web-based chatbot that uses the MCP Tool Agent to access and execute tools via LLMs.

## Features

- Clean, modern UI
- Real-time communication with Socket.IO
- Integration with MCP Tool Agent
- Support for code highlighting
- Typing indicators
- Responsive design
- User configurable LLM settings:
  - API keys input directly in the UI
  - Support for OpenAI and Ollama
  - Adjustable temperature
  - Settings saved in browser localStorage

## Prerequisites

- Node.js v18+
- MCP CLI installed globally
  ```bash
  npm install -g @modelcontextprotocol/cli
  ```
- OpenAI API key (or Anthropic/Ollama configuration)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Create a .env file from the example:
   ```bash
   cp .env.example .env
   # Then edit the .env file with your API keys
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

5. Click the settings icon (gear) in the top-right corner to configure your:
   - LLM provider (OpenAI or Ollama)
   - API keys
   - Model settings

## Customizing LLM Provider

You can modify the `server.js` file to use different LLM providers:

```javascript
// For Anthropic Claude
const llmConfig = {
  provider: 'anthropic',
  modelName: 'claude-3-sonnet-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.1
};

// For Ollama (local)
const llmConfig = {
  provider: 'ollama',
  modelName: 'llama3',
  baseUrl: 'http://localhost:11434/v1',
  temperature: 0
};
```

## License

MIT