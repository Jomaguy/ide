/**
 * Chat Manager Component
 * 
 * Manages the AI chat functionality, including:
 * - Chat UI creation and management
 * - Message handling
 * - Gemini API integration
 */

const GEMINI_API_KEY = "AIzaSyAaS8BakefjrV1T3H3obrkQPJwmFjRpWFs";

// State variables
let layout;
let conversationHistory = [
    {
        role: 'system',
        content: 'You are a programming tutor who uses the Socratic method. Keep your responses concise and focused. Instead of giving direct answers, guide users through problems with targeted questions. Limit explanations to 2-3 sentences when possible. When reviewing code, ask specific questions about potential issues or improvements. Your goal is to help users discover solutions through self-reflection and critical thinking.'
    }
];

/**
 * Creates the chat UI components
 * @param {HTMLElement} container - The container element for the chat
 */
function createChatUI(container) {
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'chat-messages';
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chat-input-container';
    
    const input = document.createElement('textarea');
    input.className = 'chat-input';
    input.placeholder = 'Type your message...';
    input.rows = 1;

    // Auto-resize function
    function autoResize() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    }

    // Add input event listener for auto-resize
    input.addEventListener('input', autoResize);
    
    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';
    
    const submitButton = document.createElement('button');
    submitButton.className = 'chat-submit';
    submitButton.textContent = 'Submit';
    
    // Set up event handlers
    submitButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Assemble the UI
    inputContainer.appendChild(input);
    inputContainer.appendChild(buttonRow);
    buttonRow.appendChild(submitButton);
    
    chatContainer.appendChild(messagesContainer);
    chatContainer.appendChild(inputContainer);
    
    container.appendChild(chatContainer);
}

/**
 * Sends a message to the Gemini API
 */
async function sendMessage() {
    const input = document.querySelector('.chat-input');
    const messagesContainer = document.querySelector('.chat-messages');
    const submitButton = document.querySelector('.chat-submit');
    
    const message = input.value.trim();
    if (!message) return;

    if (!GEMINI_API_KEY) {
        addMessageToChat('Error: Gemini API key not found', 'error');
        return;
    }

    // Add user message to chat
    addMessageToChat(`User: ${message}`, 'user-message');
    
    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: message });

    // Clear input and reset
    input.value = '';
    input.style.height = 'auto';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'Thinking...';
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: message }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Add AI response to conversation history
        conversationHistory.push({ role: 'assistant', content: aiResponse });
        
        // Add AI response to chat
        addMessageToChat(`Gemini: ${aiResponse}`, 'ai-message');

        // Limit conversation history
        if (conversationHistory.length > 11) {
            conversationHistory = [
                conversationHistory[0],
                ...conversationHistory.slice(-10)
            ];
        }
    } catch (error) {
        addMessageToChat(`Error: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

/**
 * Adds a message to the chat UI
 * @param {string} message - The message text
 * @param {string} className - The CSS class for the message
 */
function addMessageToChat(message, className) {
    const messagesContainer = document.querySelector('.chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
}

/**
 * Initializes the chat manager
 * @param {GoldenLayout} layoutInstance - The GoldenLayout instance
 */
export function initialize(layoutInstance) {
    layout = layoutInstance;
    
    // Register the chat component with the layout
    layout.registerComponent("middle", function(container, state) {
        createChatUI(container.getElement()[0]);
    });
}

/**
 * Gets the chat input element
 * @returns {HTMLElement} The chat input element
 */
export function getChatInput() {
    return document.querySelector('.chat-input');
}

/**
 * Focuses the chat input and switches to the chat panel
 */
export function focusChat() {
    const chatPanel = layout.root.getItemsById("middle")[0];
    if (chatPanel?.parent?.header?.parent) {
        chatPanel.parent.header.parent.setActiveContentItem(chatPanel);
    }
    
    const chatInput = getChatInput();
    if (chatInput) {
        chatInput.focus();
    }
}

/**
 * Adds code to the chat input
 * @param {string} code - The code to add to chat
 */
export function addCodeToChat(code) {
    const chatInput = getChatInput();
    if (chatInput) {
        const existingText = chatInput.value;
        const codeBlock = "\`\`\`\n" + code + "\n\`\`\`\n";
        chatInput.value = existingText + (existingText ? "\n" : "") + codeBlock;
        
        // Trigger the auto-resize
        chatInput.dispatchEvent(new Event('input'));
        
        // Focus the chat
        focusChat();
    }
}

/**
 * Adds an error message to the chat input
 * @param {string} errorMessage - The error message to add
 */
export function addErrorToChat(errorMessage) {
    const chatInput = getChatInput();
    if (chatInput) {
        // Format the error message for the chat
        const formattedMessage = `I got the following error in my code:\n\`\`\`\n${errorMessage}\n\`\`\`\nCan you help me fix this?`;
        
        // Set the chat input value
        chatInput.value = formattedMessage;
        chatInput.dispatchEvent(new Event('input'));
        
        // Focus the chat
        focusChat();
    }
} 