/**
 * Theme Management System
 * 
 * This module manages the IDE's theme system, providing support for light, dark,
 * system-matched, and reverse-system themes. It handles theme switching, persistence,
 * and updates all UI elements accordingly including Monaco editor, menus, and buttons.
 * 
 * The system supports four themes:
 * - light: Forces light theme
 * - dark: Forces dark theme
 * - system: Matches system theme preference
 * - reverse-system: Uses opposite of system theme
 */
"use strict";
import query from "../utils/QueryParams.js";
import ls from "../storage/LocalStorage.js";

const theme = {
    /** List of supported theme names */
    SUPPORTED_THEMES: ["light", "dark", "system", "reverse-system"],
    /** Default theme when none is set */
    DEFAULT_THEME: "system",

    /**
     * Sets and applies a theme to the IDE
     * @param {string} name - The theme name to apply
     * @param {boolean} save - Whether to persist the theme to local storage
     */
    set(name, save = true) {
        const resolvedName = theme.SUPPORTED_THEMES.includes(name) ? name : theme.get();
        const resolvedTheme = resolvedName === "system" ? theme.getSystemTheme() : (resolvedName === "reverse-system" ? theme.getReverseSystemTheme() : resolvedName);
        const isLight = resolvedTheme === "light";

        document.body.style.background = `url("./images/logo_${isLight ? "white" : "black"}.svg") center center / 33% no-repeat ${isLight ? "#e0e1e2" : "#1b1c1d"} `;

        document.getElementById("judge0-golden-layout-dark-theme-stylesheet").disabled = isLight;
        document.getElementById("judge0-golden-layout-light-theme-stylesheet").disabled = !isLight;

        monaco.editor.setTheme(isLight ? "vs-light" : "vs-dark");

        [".ui.menu", ".ui.input"].forEach(s => document.querySelectorAll(s).forEach(e => {
            if (isLight) {
                e.classList.remove("inverted");
            } else {
                e.classList.add("inverted");
            }
        }));

        document.querySelectorAll(".label").forEach(e => {
            if (isLight) {
                e.classList.remove("black");
            } else {
                e.classList.add("black");
            }
        });

        document.getElementById("judge0-theme-toggle-btn").setAttribute("data-content", `Switch between dark, light, and system theme (currently ${resolvedName} theme)`);
        const themeToggleBtnIcon = document.getElementById("judge0-theme-toggle-btn-icon");
        if (resolvedName === "dark") {
            themeToggleBtnIcon.classList = "moon icon";
        } else if (resolvedName === "light") {
            themeToggleBtnIcon.classList = "sun icon";
        } else {
            themeToggleBtnIcon.classList = "adjust icon";
        }

        document.querySelectorAll("[data-content]").forEach(e => {
            if (isLight) {
                e.setAttribute("data-variation", "very wide");
            } else {
                e.setAttribute("data-variation", "inverted very wide");
            }
        });

        document.head.querySelectorAll("meta[name='theme-color'], meta[name='msapplication-TileColor']").forEach(e => {
            e.setAttribute("content", isLight ? "#ffffff" : "#1b1c1d");
        });

        if (save) {
            ls.set("JUDGE0_THEME", resolvedName);
        }
    },

    /**
     * Retrieves the current theme from local storage
     * @returns {string} The current theme name or default theme if none is set
     */
    get() {
        return ls.get("JUDGE0_THEME") || theme.DEFAULT_THEME;
    },

    /**
     * Toggles between themes in a logical sequence:
     * - From system theme: switches to opposite of current system theme
     * - From light/dark: switches to system if it matches, otherwise opposite theme
     */
    toggle() {
        const current = theme.get();
        if (current === "system") {
            if (theme.getSystemTheme() === "dark") {
                theme.set("light");
            } else {
                theme.set("dark");
            }
        } else if (current === "reverse-system") {
            if (theme.getReverseSystemTheme() === "dark") {
                theme.set("light");
            } else {
                theme.set("dark");
            }
        } else if (current === "dark") {
            if (theme.getSystemTheme() === "dark") {
                theme.set("system");
            } else {
                theme.set("light");
            }
        } else if (current === "light") {
            if (theme.getSystemTheme() === "light") {
                theme.set("system");
            } else {
                theme.set("dark");
            }
        }
    },

    /**
     * Detects the system's theme preference
     * @returns {"light"|"dark"} The system's current theme preference
     */
    getSystemTheme() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    },

    /**
     * Returns the opposite of the system theme
     * @returns {"light"|"dark"} The opposite of the system's current theme
     */
    getReverseSystemTheme() {
        return theme.getSystemTheme() === "dark" ? "light" : "dark";
    }
};

export default theme;

/**
 * Initialize theme system when DOM is ready:
 * 1. Wait for Monaco editor to load
 * 2. Apply theme from URL parameters if specified
 * 3. Set up theme toggle button click handler
 */
document.addEventListener("DOMContentLoaded", function () {
    require(["vs/editor/editor.main"], function () {
        theme.set(query.get("theme"));
    });
    document.getElementById("judge0-theme-toggle-btn").addEventListener("click", theme.toggle);
});

/**
 * Listen for system theme changes and update if using system/reverse-system theme
 */
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    ["system", "reverse-system"].forEach(t => {
        if (theme.get() === t) {
            theme.set(t, false);
        }
    });
});
