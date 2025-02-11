/**
 * Application Entry Point Component
 * 
 * Bootstraps the IDE application by initializing the layout manager
 * and providing top-level error handling.
 */

import * as LayoutManager from "../layout/LayoutManager.js";
import { initializePassiveEvents, cleanupPassiveEvents } from '../../core/utils/EventHandlers.js';

let isInitialized = false;

/**
 * Initializes the IDE application
 * @returns {Promise<() => void>} Cleanup function
 */
export async function initialize() {
    if (isInitialized) {
        return;
    }

    try {
        // Initialize passive events first to ensure all subsequent event listeners are properly handled
        initializePassiveEvents(document);
        
        // Then initialize the layout
        await LayoutManager.initialize();
        
        isInitialized = true;

        // Return cleanup function
        return () => {
            cleanupPassiveEvents();
            isInitialized = false;
        };
    } catch (error) {
        console.error("Failed to initialize IDE:", error);
        // Clean up any partial initialization
        cleanupPassiveEvents();
        isInitialized = false;

        // Show error UI
        document.body.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2>Failed to Initialize IDE</h2>
                <p>Please try refreshing the page. If the problem persists, contact support.</p>
                <pre style="text-align: left; margin: 20px;">${error.message}</pre>
            </div>
        `;
        
        throw error;
    }
} 