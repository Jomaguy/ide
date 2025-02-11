/**
 * URL Query Parameter Handler
 * 
 * This module provides functionality for accessing URL query parameters in the IDE.
 * It offers a simple interface to retrieve specific parameter values from the URL,
 * with automatic URL decoding for proper handling of special characters.
 * 
 * Example URL with query parameters:
 * https://example.com?theme=dark&style=minimal
 * 
 * Usage:
 * query.get("theme") // returns "dark"
 * query.get("style") // returns "minimal"
 */
"use strict";

const query = {
    /**
     * Retrieves the value of a specific URL query parameter
     * @param {string} variable - The name of the query parameter to retrieve
     * @returns {string|undefined} The decoded value of the query parameter if found,
     *                            undefined if the parameter doesn't exist
     * 
     * Example:
     * For URL "?theme=dark&style=minimal":
     * get("theme") returns "dark"
     * get("nonexistent") returns undefined
     */
    get(variable) {
        const query = window.location.search.substring(1);  // Remove leading '?'
        const vars = query.split("&");  // Split into individual key-value pairs
        for (let i = 0; i < vars.length; i++) {
            const pair = vars[i].split("=");  // Split each pair into key and value
            if (decodeURIComponent(pair[0]) == variable) {
                return decodeURIComponent(pair[1]);  // Return decoded value if key matches
            }
        }
    }
};

export default query;
