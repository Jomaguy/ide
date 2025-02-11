/**
 * Error Chat Button Component
 * 
 * Manages the "Ask Chat?" button that appears when there's a compilation error,
 * allowing users to easily ask for help with errors.
 */

import * as ChatManager from "./ChatManager.js";

/**
 * Creates an "Ask Chat" button when there's a compilation error
 * @param {string} errorMessage - The error message to add to chat
 * @param {HTMLElement} editorElement - The editor element to append the button to
 */
export function create(errorMessage, editorElement) {
    // Validate parameters
    if (!editorElement) {
        console.error('Editor element is required to create error chat button');
        return;
    }

    // Remove any existing ask chat button
    const existingButton = document.querySelector('.ask-chat-button');
    if (existingButton) {
        existingButton.remove();
    }

    const button = document.createElement('button');
    button.className = 'ask-chat-button';
    button.textContent = 'Ask Chat?';
    button.onclick = () => {
        ChatManager.addErrorToChat(errorMessage);
    };

    // Add the button to the editor container
    editorElement.style.position = 'relative';
    editorElement.appendChild(button);
    
    // Show the button with a fade-in effect
    setTimeout(() => {
        button.style.display = 'block';
        button.style.opacity = '1';
    }, 100);
}

/**
 * Removes the error chat button if it exists
 */
export function remove() {
    const button = document.querySelector('.ask-chat-button');
    if (button) {
        button.remove();
    }
} 