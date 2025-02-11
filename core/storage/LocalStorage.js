/**
 * Local Storage Wrapper Module
 * 
 * This module provides a simplified and safe interface for browser's localStorage,
 * with additional features like automatic JSON serialization/deserialization and
 * error handling. It ensures that storage operations don't throw errors even
 * when localStorage is unavailable or quota is exceeded.
 * 
 * Features:
 * - Automatic JSON handling for objects
 * - Silent error handling for all operations
 * - Null value handling (auto-deletion)
 * - Simplified get/set/delete interface
 * 
 * Usage:
 * ls.set("key", "value")        // Store string
 * ls.set("obj", {foo: "bar"})   // Store object (auto-JSON)
 * ls.get("key")                 // Retrieve value
 * ls.del("key")                 // Delete value
 */
"use strict";

const ls = {
    /**
     * Stores a value in localStorage
     * @param {string} key - The key to store the value under
     * @param {*} value - The value to store. Objects are automatically stringified.
     *                    If null/undefined, the key is deleted.
     * 
     * Examples:
     * ls.set("theme", "dark")
     * ls.set("settings", {theme: "dark", fontSize: 14})
     * ls.set("key", null) // Deletes the key
     */
    set(key, value) {
        try {
            if (value == null) {
                ls.del(key);
                return;
            }

            if (typeof value === "object") {
                value = JSON.stringify(value);
            }

            localStorage.setItem(key, value);
        } catch (ignorable) {
            // Silently handle localStorage errors (e.g., quota exceeded, private mode)
        }
    },

    /**
     * Retrieves a value from localStorage
     * @param {string} key - The key to retrieve
     * @returns {*} The stored value. Objects are automatically parsed from JSON.
     *              Returns null if key doesn't exist or on any error.
     * 
     * Examples:
     * ls.get("theme")     // Returns "dark"
     * ls.get("settings")  // Returns {theme: "dark", fontSize: 14}
     * ls.get("nonexistent") // Returns null
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
            try {
                return JSON.parse(value);  // Attempt to parse as JSON
            } catch (ignorable) {
                return value;  // Return as-is if not valid JSON
            }
        } catch (ignorable) {
            return null;  // Return null on any localStorage error
        }
    },

    /**
     * Removes a value from localStorage
     * @param {string} key - The key to remove
     * 
     * Example:
     * ls.del("theme") // Removes the "theme" entry
     */
    del(key) {
        try {
            localStorage.removeItem(key);
        } catch (ignorable) {
            // Silently handle localStorage errors
        }
    }
};

export default ls;
