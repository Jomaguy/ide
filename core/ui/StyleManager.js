/**
 * Style Management System
 * 
 * This module manages the IDE's visual style system, providing different UI layouts
 * and visibility modes. It supports multiple style configurations including default,
 * minimal, standalone, and electron modes. Each mode can show/hide specific UI elements
 * to provide the most appropriate interface for different contexts.
 * 
 * The system supports four styles:
 * - default: Standard IDE interface with all elements visible
 * - minimal: Simplified interface with reduced UI elements
 * - standalone: Specialized mode for standalone deployments
 * - electron: Optimized for Electron desktop application
 */
"use strict";
import query from "../utils/QueryParams.js";
import { IS_ELECTRON } from "../environment/ElectronDetector.js";
import { IS_PUTER } from "../environment/PuterIntegration.js";

const style = {
    /** List of supported style modes */
    SUPPORTED_STYLES: ["default", "minimal", "standalone", "electron"],
    /** Default style when none is specified */
    DEFAULT_STYLE: "default",

    /**
     * Applies a specific style to the IDE interface
     * @param {string} name - The style name to apply
     * First applies default style as base, then modifies for specific style if not default
     */
    apply(name) {
        const resolvedName = style.SUPPORTED_STYLES.includes(name) ? name : style.DEFAULT_STYLE;
        if (resolvedName !== "default") {
            style.apply("default");
            document.querySelectorAll(`.judge0-${resolvedName}-hidden`).forEach(e => {
                e.classList.add("judge0-hidden");
            });
        } else {
            style.SUPPORTED_STYLES.forEach(s => style.reverse(s));
        }
    },

    /**
     * Reverses (removes) a specific style's hidden elements
     * @param {string} name - The style name to reverse
     * Used to reset elements before applying a new style
     */
    reverse(name) {
        document.querySelectorAll(`.judge0-${name}-hidden`).forEach(e => {
            e.classList.remove("judge0-hidden");
        });
    }
};

export default style;

/**
 * Initialize style system when DOM is ready:
 * - For Electron: applies electron-specific style
 * - For Puter: applies standalone style
 * - Otherwise: applies style from URL parameters
 * 
 * This ensures the appropriate UI is shown based on the runtime environment
 */
document.addEventListener("DOMContentLoaded", function () {
    if (IS_ELECTRON) {
        style.apply("electron");
    } else if (IS_PUTER) {
        style.apply("standalone");
    } else {
        style.apply(query.get("style"));
    }
});
