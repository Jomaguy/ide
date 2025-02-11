/**
 * Code Completion Manager
 * 
 * Manages AI-powered code completion functionality for the Monaco editor.
 * Provides inline suggestions using Google's Gemini API.
 */

import { CodeCompletionConfig as CONFIG } from './config.js';

// Cache for completions
const completionCache = new Map();

// Track registered providers for cleanup
let registeredProviders = [];

/**
 * Rate limiter to prevent API abuse
 */
class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        // Initialize request tracking
        this.requests = {
            inline: []
        };
        this.lastRequestTime = {
            inline: 0
        };
        this.backoffTime = {
            inline: CONFIG.rateLimit.minBackoffMs
        };
        this.consecutiveFailures = 0;
        this.lastProcessedText = '';
        
        // Add request queue with context tracking
        this.pendingRequests = [];
        this.isProcessingQueue = false;
        this.currentContext = null;  // Track current editing context
    }

    setCurrentContext(cursorOffset, text) {
        this.currentContext = {
            cursorOffset,
            contextKey: text.slice(Math.max(0, cursorOffset - 100), cursorOffset)
        };
    }

    isContextStale(cursorOffset, text) {
        if (!this.currentContext) return false;
        
        const newContextKey = text.slice(Math.max(0, cursorOffset - 100), cursorOffset);
        return this.currentContext.contextKey !== newContextKey;
    }

    async addToQueue(requestFn, cursorOffset, text) {
        // Update current context
        this.setCurrentContext(cursorOffset, text);
        
        // Clear stale requests from queue
        this.pendingRequests = this.pendingRequests.filter(request => 
            !this.isContextStale(request.cursorOffset, request.text)
        );

        return new Promise((resolve) => {
            this.pendingRequests.push({ 
                requestFn, 
                resolve,
                cursorOffset,
                text,
                timestamp: Date.now()
            });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.pendingRequests.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        
        while (this.pendingRequests.length > 0) {
            const request = this.pendingRequests[0];
            
            // Check if this request is stale
            if (this.isContextStale(request.cursorOffset, request.text)) {
                console.debug('Skipping stale request from different context');
                this.pendingRequests.shift();
                request.resolve(null);
                continue;
            }

            // Check if request is too old (more than 2 seconds)
            if (Date.now() - request.timestamp > 2000) {
                console.debug('Skipping old request');
                this.pendingRequests.shift();
                request.resolve(null);
                continue;
            }

            if (!this.canMakeRequest()) {
                const waitTime = this.getTimeUntilNextRequest();
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            this.pendingRequests.shift();
            try {
                const result = await request.requestFn();
                request.resolve(result);
                this.handleSuccess();
            } catch (error) {
                console.error('Request failed:', error);
                this.handleFailure();
                request.resolve(null);
            }

            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimit.minBackoffMs));
        }

        this.isProcessingQueue = false;
    }

    filterOldRequests() {
        const now = Date.now();
        this.requests.inline = this.requests.inline.filter(time => now - time < this.timeWindow);
    }

    getTimeUntilNextRequest() {
        const now = Date.now();
        const requests = this.requests.inline;
        const lastTime = this.lastRequestTime.inline;
        
        this.filterOldRequests();
        
        if (this.requests.inline.length >= this.maxRequests.inline) {
            const oldestRequest = this.requests.inline[0];
            return Math.max(oldestRequest + this.timeWindow - now, CONFIG.rateLimit.minBackoffMs);
        }
        
        return Math.max(0, lastTime + CONFIG.rateLimit.minBackoffMs - now);
    }

    canMakeRequest() {
        const now = Date.now();
        
        if (this.consecutiveFailures >= CONFIG.rateLimit.consecutiveFailuresBeforeBackoff) {
            return false;
        }
        
        const timeSinceLastRequest = now - this.lastRequestTime.inline;
        if (timeSinceLastRequest < CONFIG.rateLimit.minBackoffMs) {
            return false;
        }
        
        this.filterOldRequests();
        if (this.requests.inline.length >= this.maxRequests.inline) {
            return false;
        }
        
        return true;
    }

    addRequest(text = '') {
        const now = Date.now();
        
        if (text && text === this.lastProcessedText) {
            return false;
        }
        
        this.requests.inline.push(now);
        this.lastRequestTime.inline = now;
        this.lastProcessedText = text;
        return true;
    }

    handleSuccess() {
        this.consecutiveFailures = 0;
        this.backoffTime.inline = Math.max(
            CONFIG.rateLimit.minBackoffMs,
            this.backoffTime.inline * 0.5
        );
    }

    handleFailure() {
        this.consecutiveFailures++;
        this.backoffTime.inline = Math.min(
            this.backoffTime.inline * 2,
            CONFIG.rateLimit.maxBackoffMs
        );
    }

    reset() {
        this.requests = { inline: [] };
        this.lastRequestTime = { inline: 0 };
        this.backoffTime = {
            inline: CONFIG.rateLimit.minBackoffMs
        };
        this.consecutiveFailures = 0;
        this.lastProcessedText = '';
        this.pendingRequests = [];
        this.isProcessingQueue = false;
    }
}

const rateLimiter = new RateLimiter(CONFIG.rateLimit.maxRequests, CONFIG.rateLimit.timeWindowMs);

/**
 * Analyzes code indentation based on language
 * @param {string} beforeCursor - Text before cursor
 * @param {string} language - Programming language ('python', 'cpp', or 'java')
 * @returns {Object} Indentation info with properties:
 *   - currentIndent: The current line's indentation
 *   - syntaxIndentLevel: The calculated indentation level
 *   - indentString: The proper indentation string to use
 */
function analyzeIndentation(beforeCursor, language = 'cpp') {
    // Normalize language to match config keys
    const normalizedLang = language.toLowerCase();
    
    // Get language settings with fallback to cpp
    const langSettings = CONFIG.languageSettings[normalizedLang] || CONFIG.languageSettings.cpp;
    
    // Safety check - if no valid settings found, return default values
    if (!langSettings) {
        console.warn('No language settings found for', normalizedLang);
        return {
            currentIndent: '',
            syntaxIndentLevel: 0,
            indentString: '    ' // Default 4 spaces
        };
    }
    
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    const currentIndent = currentLine.match(/^\s*/)[0];
    
    let syntaxIndentLevel = 0;
    let shouldIndentNext = false;

    if (normalizedLang === 'python') {
        // Python-specific indentation rules
        const endsWithColon = currentLine.trim().endsWith(':');
        let controlLineIndex = lines.length - 1;
        
        while (controlLineIndex >= 0) {
            const line = lines[controlLineIndex];
            if (line.trim().endsWith(':')) {
                syntaxIndentLevel = Math.floor(line.match(/^\s*/)[0].length / langSettings.indentSize) + 1;
                break;
            } else if (line.trim().length > 0) {
                syntaxIndentLevel = Math.floor(line.match(/^\s*/)[0].length / langSettings.indentSize);
                break;
            }
            controlLineIndex--;
        }
        shouldIndentNext = endsWithColon;
    } else {
        // C++ and Java indentation rules (curly brace based)
        const blockStart = langSettings.blockStart || '{';
        const blockEnd = langSettings.blockEnd || '}';
        
        const blockStarts = (beforeCursor.match(new RegExp('\\' + blockStart, 'g')) || []).length;
        const blockEnds = (beforeCursor.match(new RegExp('\\' + blockEnd, 'g')) || []).length;
        syntaxIndentLevel = Math.max(0, blockStarts - blockEnds);
        shouldIndentNext = currentLine.trim().endsWith(blockStart);
    }

    const result = {
        currentIndent,
        syntaxIndentLevel: shouldIndentNext ? syntaxIndentLevel + 1 : syntaxIndentLevel,
        indentString: ' '.repeat(langSettings.indentSize || 4).repeat(syntaxIndentLevel)
    };
    
    return result;
}

/**
 * Cleans completion result to prevent duplication
 * @param {string} existingCode - Code before cursor
 * @param {string} completion - The completion suggestion
 * @returns {string} Cleaned completion
 */
function cleanCompletion(existingCode, completion) {
    if (!completion) return '';
    
    // Remove any duplicate of the last line
    const lastLine = existingCode.split('\n').pop() || '';
    const completionLines = completion.split('\n');
    
    if (completionLines[0].trim() === lastLine.trim()) {
        completionLines.shift();
    }
    
    // Remove any leading whitespace if it matches the last line's indentation
    const lastLineIndent = lastLine.match(/^\s*/)[0];
    if (completionLines[0] && completionLines[0].startsWith(lastLineIndent)) {
        completionLines[0] = completionLines[0].substring(lastLineIndent.length);
    }
    
    return completionLines.join('\n');
}

/**
 * Gets completion suggestions from Gemini
 * @param {string} text - The full text content
 * @param {number} cursorOffset - The cursor position
 * @param {string} language - Programming language (python, cpp, or java)
 * @returns {Promise<string|null>} The completion suggestion
 */
async function getAutoComplete(text, cursorOffset, language = 'cpp') {
    const makeRequest = async () => {
        try {
            console.log('Attempting completion request:', {
                language,
                textLength: text.length,
                cursorOffset
            });

            // Check cache first
            const contextKey = text.slice(Math.max(0, cursorOffset - 100), cursorOffset);
            if (completionCache.has(contextKey)) {
                console.log('Using cached completion');
                return completionCache.get(contextKey);
            }

            if (!rateLimiter.addRequest(text)) {
                console.log('Request not added due to duplicate or rate limiting');
                return null;
            }

            const beforeCursor = text.substring(0, cursorOffset);
            const indentation = analyzeIndentation(beforeCursor, language);
            const langSettings = CONFIG.languageSettings[language] || CONFIG.languageSettings.cpp;
            
            const requestBody = {
                contents: [{
                    role: 'user',
                    parts: [{
                        text: `You are a code completion AI. You will be shown existing code followed by a ▼ cursor marker.
Your task is to ONLY provide what should come AFTER the cursor marker.
DO NOT repeat any code that comes before the ▼ marker.

Rules:
1. Only provide the completion part that should be inserted at the cursor
2. Maintain indentation and formatting
3. Use the correct syntax for ${language}
4. Use ${langSettings.indentSize} spaces for indentation
5. Follow language-specific conventions for ${language}

EXISTING CODE:
${beforeCursor}

COMPLETE FROM HERE (▼):
▼`
                    }]
                }]
            };

            let response;
            try {
                response = await fetch(`${CONFIG.apiEndpoint}?key=${CONFIG.apiKey}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody)
                });
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                rateLimiter.handleFailure();
                return null;
            }

            if (!response.ok) {
                const errorData = await response.text().catch(() => 'No error details available');
                console.error('API Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData: errorData
                });
                
                rateLimiter.handleFailure();
                
                if (response.status === 429) {
                    const waitTime = rateLimiter.getTimeUntilNextRequest();
                    console.debug(`Rate limit reached. Waiting ${Math.ceil(waitTime/1000)}s before next request.`);
                    return null;
                }
                
                if (response.status === 500) {
                    console.warn('Gemini API internal error. Simplifying request...');
                    return null;
                }
                
                return null;
            }

            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('JSON parsing error:', jsonError);
                rateLimiter.handleFailure();
                return null;
            }
            
            // Validate response structure
            if (!data || !Array.isArray(data.candidates) || data.candidates.length === 0) {
                console.warn('Invalid API response structure:', data);
                rateLimiter.handleFailure();
                return null;
            }

            const candidate = data.candidates[0];
            if (!candidate?.content?.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
                console.warn('Invalid candidate structure:', candidate);
                rateLimiter.handleFailure();
                return null;
            }

            let completion = candidate.content.parts[0]?.text || "";

            // Clean and format AI response
            completion = completion
                .replace(/^```.*?```/gs, '')  // Remove Markdown code blocks
                .replace(/^\s+|\s+$/g, '');   // Trim whitespace

            // Clean up any duplicated code
            completion = cleanCompletion(beforeCursor, completion);

            // Ensure proper indentation
            if (completion && !completion.startsWith(indentation.indentString)) {
                completion = indentation.indentString + completion;
            }

            // Handle successful completion
            if (completion) {
                console.log('Received completion:', { completion });
                rateLimiter.handleSuccess();
                completionCache.set(contextKey, completion);
            } else {
                console.log('No completion received');
                rateLimiter.handleFailure();
            }

            return completion;
        } catch (error) {
            console.error("Autocomplete error:", error);
            console.debug("Error context:", {
                cursorOffset,
                textLength: text.length,
                language
            });
            rateLimiter.handleFailure();
            return null;
        }
    };

    // Add request to queue with context information
    return rateLimiter.addToQueue(makeRequest, cursorOffset, text);
}

/**
 * Cleans up registered providers
 */
function cleanup() {
    // Dispose of all registered providers
    while (registeredProviders.length) {
        const provider = registeredProviders.pop();
        try {
            if (provider && typeof provider.dispose === 'function') {
                provider.dispose();
            }
        } catch (error) {
            console.warn('Error disposing provider:', error);
        }
    }
    
    // Clear completion cache
    completionCache.clear();
    
    // Reset rate limiter
    rateLimiter.reset();
}

/**
 * Safely adds an event listener with passive option when possible
 * @param {EventTarget} element - The element to attach the listener to
 * @param {string} eventName - The event name
 * @param {Function} handler - The event handler
 * @param {boolean} [useCapture=false] - Whether to use capture phase
 */
function addPassiveEventListener(element, eventName, handler, useCapture = false) {
    let options = useCapture;
    
    try {
        options = {
            passive: true,
            capture: useCapture
        };
    } catch (err) {
        console.debug('Passive events not supported');
    }
    
    element.addEventListener(eventName, handler, options);
}

/**
 * Initializes code completion for a Monaco editor instance
 */
export function initialize(editor) {
    if (!CONFIG.enabled) {
        console.log('Code completion disabled');
        return;
    }
    
    console.log('Initializing inline code completion');

    // Clean up any existing providers
    cleanup();

    // Register inline completion provider
    const inlineProvider = monaco.languages.registerInlineCompletionsProvider('*', {
        async provideInlineCompletions(model, position, context) {
            try {
                const text = model.getValue();
                const cursorOffset = model.getOffsetAt(position);
                const language = model.getLanguageId();
                
                const completion = await getAutoComplete(text, cursorOffset, language);
                if (!completion || completion.trim() === '') {
                    return { items: [] };
                }

                console.log('Providing inline completion:', { completion });

                const range = new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column + completion.length
                );

                return {
                    items: [{
                        insertText: completion,
                        range: range,
                        command: { id: 'editor.action.inlineSuggest.trigger', title: 'Show Inline Suggestion' }
                    }],
                    suppressSuggestions: true,  // Suppress Monaco's suggestions
                    enableForwardStability: true
                };
            } catch (error) {
                console.error("Error in inline completion:", error);
                return { items: [] };
            }
        },

        freeInlineCompletions(completions) {
            // No resources to free
        },

        handleItemDidShow(completions, item) {
            // Optional: Track when items are shown
        },

        dispose() {
            cleanup();
        }
    });

    // Store provider for cleanup
    registeredProviders.push(inlineProvider);

    // Disable Monaco's built-in suggestions
    editor.updateOptions({
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        snippetSuggestions: 'none',
        wordBasedSuggestions: false,
        parameterHints: { enabled: false },
        suggest: {
            showMethods: false,
            showFunctions: false,
            showConstructors: false,
            showDeprecated: false,
            showFields: false,
            showVariables: false,
            showClasses: false,
            showStructs: false,
            showInterfaces: false,
            showModules: false,
            showProperties: false,
            showEvents: false,
            showOperators: false,
            showUnits: false,
            showValues: false,
            showConstants: false,
            showEnums: false,
            showEnumMembers: false,
            showKeywords: false,
            showWords: false,
            showColors: false,
            showFiles: false,
            showReferences: false,
            showFolders: false,
            showTypeParameters: false,
            showSnippets: false
        }
    });

    // Override default Ctrl+Space behavior
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, (e) => {
        e?.preventDefault?.();
        console.log('Ctrl+Space pressed, triggering inline suggestion');
        
        // Get editor state
        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) {
            console.debug('Cannot trigger - no model or position');
            return;
        }

        // Force trigger the suggestion regardless of other conditions
        console.log('Forcing inline suggestion due to Ctrl+Space');
        editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
        
        // Also trigger our completion
        const text = model.getValue();
        const cursorOffset = model.getOffsetAt(position);
        const language = model.getLanguageId();
        
        // Bypass rate limiting for explicit user triggers
        getAutoComplete(text, cursorOffset, language).then(completion => {
            if (completion) {
                console.log('Received completion from Ctrl+Space:', { completion });
            }
        });
    }, 'editorTextFocus');

    // Additional command to ensure suggestion widget stays hidden
    editor.onDidChangeCursorPosition(() => {
        const suggestWidget = editor._contentWidgets?.["editor.widget.suggestWidget"];
        // Check if the widget exists and has the isVisible method
        if (suggestWidget && typeof suggestWidget.isVisible === 'function') {
            if (suggestWidget.isVisible()) {
                suggestWidget.hide();
            }
        }
    });

    // Disable the suggest command
    editor.addCommand(monaco.KeyCode.Tab, () => {
        const suggestWidget = editor._contentWidgets?.["editor.widget.suggestWidget"];
        // Check if the widget exists and has the hide method
        if (suggestWidget && typeof suggestWidget.hide === 'function') {
            suggestWidget.hide();
        }
        return false;
    }, 'suggestWidgetVisible');

    // Update the debouncedTriggerSuggestions function for automatic triggers
    const debouncedTriggerSuggestions = debounce(() => {
        const now = Date.now();
        
        console.log('Checking trigger conditions:', {
            timeSinceLastRequest: now - rateLimiter.lastRequestTime.inline,
            minTimeBetweenRequests: CONFIG.minTimeBetweenRequests
        });

        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) {
            console.debug('Skipping trigger - no model or position');
            return;
        }

        const lineContent = model.getLineContent(position.lineNumber);
        
        if (lineContent.trim().length < CONFIG.minTriggerLength) {
            console.debug('Skipping trigger - line too short');
            return;
        }

        const wordUntilPosition = model.getWordUntilPosition(position);
        const currentText = model.getValue();
        const cursorOffset = model.getOffsetAt(position);
        const contextKey = currentText.slice(Math.max(0, cursorOffset - 100), cursorOffset);
        
        if (contextKey === rateLimiter.lastProcessedText) {
            console.debug('Skipping trigger - context unchanged');
            return;
        }
        
        if (!rateLimiter.canMakeRequest()) {
            console.debug('Skipping trigger - rate limited');
            return;
        }

        const shouldTrigger = (
            lineContent.trim().length >= CONFIG.minTriggerLength ||
            CONFIG.triggerCharacters.includes(lineContent.trim().slice(-1)) ||
            (wordUntilPosition.word.length === 0 || 
             position.column > wordUntilPosition.endColumn)
        );

        if (shouldTrigger) {
            console.log('Triggering inline completion');
            editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
        }
    }, CONFIG.debounceMs);

    // Add change listener
    const changeListener = editor.onDidChangeModelContent((e) => {
        if (e.isFlush) return;
        
        const significantChange = e.changes.some(change => {
            const text = change.text;
            
            console.log('Change detected:', {
                text,
                length: text.length,
                isTriggerChar: CONFIG.triggerCharacters.includes(text),
                minLength: CONFIG.minTriggerLength
            });
            
            if (!text) return false;
            
            if (CONFIG.triggerCharacters.includes(text)) {
                return true;
            }
            
            if (text.length >= CONFIG.minTriggerLength) {
                return true;
            }
            
            return false;
        });

        if (significantChange) {
            console.log('Triggering suggestion due to significant change');
            debouncedTriggerSuggestions();
        }
    });

    // Clean up when editor is disposed
    editor.onDidDispose(() => {
        cleanup();
        changeListener.dispose();
    });
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 