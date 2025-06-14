import fs from "node:fs";
import path from "node:path";
import * as ollama from "ollama";

// --- Load Settings from JSON File ---
let agent1Name;
let agent2Name;
let agent1System;
let agent2System;
let initialMessages;
let ollamaHost;
let ollamaModel;
let ollamaKeepAlive;

const settingsFilePath = process.argv[2] || "settings.json"; // Default to 'settings.json'

try {
	const fullPath = path.resolve(process.cwd(), settingsFilePath);
	console.log(`Attempting to load settings from: ${fullPath}`);

	const settingsContent = fs.readFileSync(fullPath, "utf8");
	const settings = JSON.parse(settingsContent);

	agent1Name = settings.agent1Name;
	agent2Name = settings.agent2Name;
	agent1System = settings.agent1System || "";
	agent2System = settings.agent2System || "";
	initialMessages = settings.initialMessages; // Load as array
	ollamaHost = settings.ollamaHost || "http://localhost:11434";
	ollamaModel = settings.ollamaModel || "llama2";
	ollamaKeepAlive = settings.ollamaKeepAlive ?? undefined;
} catch (error) {
	console.error("\nError loading or parsing settings file:", settingsFilePath);
	console.error(
		`Please ensure '${settingsFilePath}' exists and is valid JSON with required properties.`,
	);
	console.error(
		`Required properties: 'agent1Name', 'agent2Name', 'initialMessages' (as an array).`,
	);
	console.error(
		`Optional properties: 'agent1System', 'agent2System', 'ollamaHost', 'ollamaModel'.`,
	);
	console.error(`Details: ${error.message}`);
	process.exit(1); // Exit with an error code
}

// --- Input Validation (after loading from file) ---
if (
	!agent1Name ||
	!agent2Name ||
	!Array.isArray(initialMessages) ||
	initialMessages.length === 0
) {
	console.error(`
Error: Settings are incomplete or incorrect.
The JSON file must contain 'agent1Name', 'agent2Name', and 'initialMessages' (as a non-empty array of objects).
Example 'settings.json':
{
  "agent1Name": "Optimist Prime",
  "agent2Name": "Negative Nancy",
  "agent1System": "You are an incredibly positive and enthusiastic AI.",
  "agent2System": "You are a skeptical and critical AI.",
  "initialMessages": [
    { "name": "Human Operator", "message": "Hello agents, are you ready to discuss?" },
    { "name": "Optimist Prime", "message": "Absolutely! I'm thrilled to begin this insightful conversation." }
  ],
  "ollamaHost": "http://localhost:11434",
  "ollamaModel": "llama2"
}
`);
	process.exit(1); // Exit with an error code
}

console.log("--- Starting AI Chat ---");
console.log(
	"Agent 1:",
	agent1Name + (agent1System ? ` (System: "${agent1System}")` : ""),
);
console.log(
	"Agent 2:",
	agent2Name + (agent2System ? ` (System: "${agent2System}")` : ""),
);
console.log("Using Ollama Host:", ollamaHost);
console.log("Using Ollama Model:", ollamaModel);
console.log("Using Ollama Keep-alive:", ollamaKeepAlive);
console.log("------------------------\n");

/**
 * グローバルな Ollama クライアントインスタンス
 * @type {ollama.Ollama}
 */
const ollamaClient = new ollama.Ollama({ host: ollamaHost });

// --- Global Chat State ---
/** チャット履歴 @type {{ sender: string, text: string }[]} */
const chatHistory = [];
let turnCount = 0;
const MAX_TURNS = 10; // Limit the number of turns to prevent infinite loops
/** チャット間隔時間（ミリ秒） */
const CHAT_INTERVAL = 1000;

// --- Helper Function: Simulate Typing Delay ---
const simulateTyping = (agentName) => {
	process.stdout.write(`\n[${agentName} is thinking...]`);
};

// --- Function to Call Ollama API ---
/**
 * Sends a message to the Ollama API and returns the generated text.
 * @param {Array<Object>} history The array of previous chat messages for context.
 * @param {string} currentAgent The name of the current agent.
 * @param {string} systemPrompt The system prompt specific to the current agent.
 * @returns {Promise<string>} The generated response text.
 */
const sendMessageToAgent = async (history, currentAgent, systemPrompt) => {
	try {
		const client = ollamaClient;
		const messagesForOllama = [];

		if (systemPrompt) {
			messagesForOllama.push({ role: "system", content: systemPrompt });
		}

		// Add previous chat history messages, dynamically determining role
		for (const msg of history) {
			// If the sender of a historical message is the current agent, treat it as 'assistant'
			// Otherwise, treat it as 'user'
			const role = msg.sender === currentAgent ? "assistant" : "user";
			messagesForOllama.push({ role: role, content: msg.text });
		}

		const response = await client.chat({
			model: ollamaModel,
			keep_alive: ollamaKeepAlive,
			messages: messagesForOllama,
		});

		return (
			response?.message?.content ??
			"No valid content received from the Ollama model."
		);
	} catch (error) {
		console.error(`\nError fetching from Ollama API: ${error.message}`);
		if (error.code === "ECONNREFUSED") {
			return `(Error: Could not connect to Ollama server at ${ollamaHost}. Is Ollama running?)`;
		}
		if (error.message?.includes(`pull ${ollamaModel}: file does not exist`)) {
			return `(Error: Ollama model '${ollamaModel}' not found. Did you run 'ollama run ${ollamaModel}'?)`;
		}
		return `(Error: Could not generate response - ${error.message})`;
	}
};

// --- Main Automatic Chat Logic ---
/**
 * Manages the automatic chat flow between two agents.
 * @param {number} currentAgentIndex Indicates which agent's turn it is (1 or 2).
 */
const autoChat = async (currentAgentIndex) => {
	if (turnCount >= MAX_TURNS) {
		console.log(`\n\n--- Chat Finished (Reached ${MAX_TURNS} turns) ---`);
		return;
	}

	turnCount++;

	const currentAgent = currentAgentIndex === 1 ? agent1Name : agent2Name;
	const currentAgentSystemPrompt =
		currentAgentIndex === 1 ? agent1System : agent2System;

	simulateTyping(currentAgent);

	const responseText = await sendMessageToAgent(
		chatHistory,
		currentAgent,
		currentAgentSystemPrompt,
	);

	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);

	chatHistory.push({ sender: currentAgent, text: responseText });

	console.log(`\n\x1b[1m${currentAgent}:\x1b[0m ${responseText}`);

	setTimeout(() => {
		autoChat(currentAgentIndex === 1 ? 2 : 1);
	}, CHAT_INTERVAL);
};

// --- Start the Chat ---
// Populate chatHistory with initialMessages
for (const msg of initialMessages) {
	chatHistory.push({ sender: msg.name, text: msg.message });
	console.log(`\x1b[1m${msg.name}:\x1b[0m ${msg.message}`); // Print initial messages
}

// Determine who speaks next based on the last message in initialMessages
const lastInitialMessageSender =
	initialMessages[initialMessages.length - 1].name;
let nextAgentIndex;

if (lastInitialMessageSender === agent1Name) {
	nextAgentIndex = 2; // If agent 1 spoke last, agent 2 speaks next
} else if (lastInitialMessageSender === agent2Name) {
	nextAgentIndex = 1; // If agent 2 spoke last, agent 1 speaks next
} else {
	// If the last initial message was from someone other than agent1 or agent2,
	// we can default to agent1 starting the conversation.
	console.log(
		`\n(Last initial message was from '${lastInitialMessageSender}'. ${agent1Name} will start.)`,
	);
	nextAgentIndex = 1;
}

autoChat(nextAgentIndex);
