/**
 * Puter Integration Module
 * 
 * This module handles integration with the Puter platform, a cloud-based development
 * environment. It detects when the IDE is running within Puter and loads necessary
 * Puter-specific functionality.
 * 
 * The module:
 * 1. Detects Puter environment through URL parameters
 * 2. Dynamically loads Puter's JavaScript SDK when running in Puter
 * 3. Exports environment detection flag for other modules
 * 
 * Used by other modules to adjust behavior when running in Puter environment
 * (e.g., style.js uses this to apply Puter-specific styling)
 */
"use strict";
import query from "../utils/QueryParams.js";

/**
 * Flag indicating whether the IDE is running within Puter environment
 * Determined by checking for Puter-specific URL parameter
 * @constant {boolean}
 */
export const IS_PUTER = !!query.get("puter.app_instance_id");

// Dynamically load Puter SDK when running in Puter environment
if (IS_PUTER) {
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    document.head.appendChild(script);
}
