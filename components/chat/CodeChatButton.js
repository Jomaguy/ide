/**
 * Code Chat Button Component
 * 
 * Manages the "Add to Chat" button that appears when code is selected,
 * allowing users to easily add code snippets to the chat.
 */

import * as ChatManager from "./ChatManager.js";

let currentSelection = '';
let addToChatBox = null;

/**
 * Creates and sets up the "Add to Chat" button functionality
 * @param {monaco.editor.IStandaloneCodeEditor} editor - The Monaco editor instance
 * @param {HTMLElement} container - The container element
 */
export function initialize(editor, container) {
    // Create and add the "Add to Chat" button
    addToChatBox = document.createElement('div');
    addToChatBox.className = 'add-to-chat-box';
    addToChatBox.textContent = 'Add to Chat';
    addToChatBox.style.position = 'fixed';
    addToChatBox.style.zIndex = '9999';
    
    document.body.appendChild(addToChatBox);

    // Add selection change handler
    editor.onDidChangeCursorSelection((e) => {
        const selection = editor.getSelection();
        if (selection) {
            const selectedText = editor.getModel().getValueInRange(selection);
            if (selectedText && selectedText.trim()) {
                currentSelection = selectedText;
                
                // Get the selection coordinates
                const endPos = editor.getScrolledVisiblePosition(selection.getEndPosition());
                
                if (endPos) {
                    const editorPos = container.getElement()[0].getBoundingClientRect();
                    const left = endPos.left + editorPos.left;
                    const top = endPos.top + editorPos.top + 20; // Position below the selection
                    
                    // Update button position
                    addToChatBox.style.left = `${left}px`;
                    addToChatBox.style.top = `${top}px`;
                    addToChatBox.style.display = 'block';
                }
            } else {
                currentSelection = '';
                addToChatBox.style.display = 'none';
            }
        }
    });

    // Add click handler for Add to Chat button
    addToChatBox.addEventListener('click', function() {
        if (currentSelection) {
            ChatManager.addCodeToChat(currentSelection);
            addToChatBox.style.display = 'none';
        }
    });

    // Return cleanup function
    return () => {
        if (addToChatBox) {
            addToChatBox.remove();
            addToChatBox = null;
        }
    };
} 