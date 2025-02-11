/**
 * Layout Manager Component
 * 
 * Manages the IDE's layout configuration and initialization.
 * Orchestrates the initialization of other components and handles window resizing.
 */

import { IS_PUTER } from "../../core/environment/PuterIntegration.js";
import * as EditorManager from "../editor/EditorManager.js";
import * as LanguageManager from "../language/LanguageManager.js";
import * as CompilerManager from "../compiler/CompilerManager.js";
import * as ChatManager from "../chat/ChatManager.js";

// State variables
let layout;
let $selectLanguage;
let $runBtn;
let $statusLine;

// Layout Configuration
const layoutConfig = {
    settings: {
        showPopoutIcon: false,
        reorderEnabled: true
    },
    content: [{
        type: "row",
        content: [{
            type: "column",
            width: 70,
            content: [{
                type: "component",
                height: 30,
                componentName: "description",
                id: "description",
                title: "Problem Description",
                isClosable: false,
                componentState: {
                    readOnly: true
                }
            }, {
                type: "component",
                height: 40,
                componentName: "source",
                id: "source",
                title: "Source Code",
                isClosable: false,
                componentState: {
                    readOnly: false
                }
            }, {
                type: "component",
                height: 30,
                componentName: "stdout",
                id: "stdout",
                title: "Output",
                isClosable: false,
                componentState: {
                    readOnly: true
                }
            }]
        }, {
            type: "component",
            width: 30,
            componentName: "middle",
            id: "middle",
            title: "Chat",
            isClosable: false,
            componentState: {
                readOnly: false
            }
        }]
    }]
};

// Default content
export const DEFAULT_SOURCE = `# Project Euler - Problem 1
# Find the sum of all multiples of 3 or 5 below 1000

def solve():
    # Your code here
    pass

result = solve()
print(result)`;

export const DEFAULT_DESCRIPTION = `# Multiples of 3 or 5

## Problem 1

If we list all the natural numbers below 10 that are multiples of 3 or 5, we get 3, 5, 6 and 9. The sum of these multiples is 23.

Find the sum of all the multiples of 3 or 5 below 1000.`;

export const DEFAULT_LANGUAGE_ID = 25; // Python for ML (3.11.2)

/**
 * Sets default values for editors and status
 */
function setDefaults() {
    EditorManager.setFontSizeForAllEditors(EditorManager.getFontSize());
    EditorManager.setSourceValue(DEFAULT_SOURCE);
    EditorManager.setStdoutValue("");
    EditorManager.setDescriptionValue(DEFAULT_DESCRIPTION);
    $statusLine.html("");
    LanguageManager.loadSelectedLanguage();
}

/**
 * Clears editor contents
 */
function clear() {
    EditorManager.clearEditors();
    $statusLine.html("");
}

/**
 * Updates the site content height based on navigation height
 */
function refreshSiteContentHeight() {
    const navigationHeight = document.getElementById("judge0-site-navigation").offsetHeight;
    const siteContent = document.getElementById("judge0-site-content");
    siteContent.style.height = `${window.innerHeight}px`;
    siteContent.style.paddingTop = `${navigationHeight}px`;
}

/**
 * Updates the layout size
 */
function refreshLayoutSize() {
    refreshSiteContentHeight();
    layout.updateSize();
}

/**
 * Initializes the layout and all components
 */
export async function initialize() {
    // Set up window resize handler
    window.addEventListener("resize", refreshLayoutSize);

    // Initialize UI components
    $("#select-language").dropdown();
    $("[data-content]").popup({
        lastResort: "left center"
    });

    refreshSiteContentHeight();

    // Initialize language selection
    $selectLanguage = $("#select-language");
    LanguageManager.initialize();
    try {
        await LanguageManager.loadLanguages();
    } catch (error) {
        console.error("Failed to load languages:", error);
    }

    // Initialize run button and status line
    $runBtn = $("#run-btn");
    $statusLine = $("#judge0-status-line");

    // Set up keyboard shortcuts
    $(document).on("keydown", "body", function (e) {
        if (e.metaKey || e.ctrlKey) {
            switch (e.key) {
                case "Enter": // Ctrl+Enter, Cmd+Enter
                    e.preventDefault();
                    CompilerManager.run();
                    break;
                case "+": // Ctrl+Plus
                case "=": // Some layouts use '=' for '+'
                    e.preventDefault();
                    EditorManager.increaseFontSize();
                    break;
                case "-": // Ctrl+Minus
                    e.preventDefault();
                    EditorManager.decreaseFontSize();
                    break;
                case "0": // Ctrl+0
                    e.preventDefault();
                    EditorManager.resetFontSize();
                    break;
            }
        }
    });

    // Set up platform-specific key hints
    let superKey = "⌘";
    if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        superKey = "Ctrl";
    }

    [$runBtn].forEach(btn => {
        btn.attr("data-content", `${superKey}${btn.attr("data-content")}`);
    });

    // Initialize Monaco editor and layout
    require(["vs/editor/editor.main"], function () {
        layout = new GoldenLayout(layoutConfig, $("#judge0-site-content"));
        
        // Initialize all managers
        EditorManager.initializeEditors(layout);
        ChatManager.initialize(layout);

        layout.on("initialised", function () {
            setDefaults();
            refreshLayoutSize();
            window.top.postMessage({ event: "initialised" }, "*");

            CompilerManager.initialize($runBtn, $statusLine, layout);
            $runBtn.click(CompilerManager.run);

            // Add compiler event listeners
            window.addEventListener('compiler-error', (e) => {
                CompilerManager.handleError(e.detail);
            });

            window.addEventListener('compiler-success', (e) => {
                CompilerManager.handleSuccess(e.detail);
            });
        });

        layout.init();
    });

    // Handle Puter integration
    if (IS_PUTER) {
        puter.ui.onLaunchedWithItems(async function (items) {
            // Disabled
        });
    }
} 