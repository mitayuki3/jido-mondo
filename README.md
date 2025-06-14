Node.js CLI Application for Automatic AI Agent Chat

This script creates a command-line interface application where two AI agents
can chat automatically based on an initial sequence of messages. It uses the
Ollama API to generate responses for each agent.

Settings (agent names, system prompts, initial messages list, Ollama host, and model)
are loaded from a JSON file. By default, it looks for 'settings.json' in the same directory.

Usage: node main.mjs [path/to/your/settings.json]

Example:
node main.mjs // Will try to load from 'settings.json'
node main.mjs ./my-config/chat-settings.json // Loads from a specified path

IMPORTANT: You need to have Ollama installed and running, and a model downloaded.
For example, to run the llama2 model:

1. Install Ollama from https://ollama.com/download
2. Run 'ollama run llama2' in your terminal to download and start the model.
