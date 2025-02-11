/**
 * Electron Environment Detection Module
 * 
 * This module provides a simple way to detect if the application is running
 * within an Electron environment. Electron is a framework for building
 * cross-platform desktop applications using web technologies.
 * 
 * The detection is performed by checking the user agent string for 'electron',
 * which is automatically included by Electron's renderer process.
 * 
 * Used by other modules to:
 * - Adjust UI elements for desktop usage
 * - Enable desktop-specific features
 * - Modify behavior for desktop environment
 * 
 * Example usage in other modules:
 * if (IS_ELECTRON) {
 *     // Apply desktop-specific behavior
 * }
 */
"use strict";

/**
 * Flag indicating whether the application is running in Electron
 * Determined by checking the user agent string for 'electron'
 * @constant {boolean}
 */
export const IS_ELECTRON = navigator.userAgent.toLowerCase().includes("electron");
