// Editor Manager for handling Monaco editor instances and configurations
import { getEditorLanguageMode } from "../../core/editor/EditorLanguages.js";
import * as CodeChatButton from "../chat/CodeChatButton.js";
import * as CodeCompletionManager from "../codeCompletion/CodeCompletionManager.js";

let sourceEditor;
let stdoutEditor;
let descriptionEditor;
let fontSize = 13;
let cleanupCodeChat = null;

export function initializeEditors(layout) {
    // Register editor components with the layout
    layout.registerComponent("description", function (container, state) {
        descriptionEditor = monaco.editor.create(container.getElement()[0], {
            automaticLayout: true,
            scrollBeyondLastLine: false,
            readOnly: state.readOnly,
            language: "markdown",
            fontFamily: "JetBrains Mono",
            minimap: {
                enabled: false
            },
            wordWrap: "on"
        });
    });

    layout.registerComponent("source", function (container, state) {
        sourceEditor = monaco.editor.create(container.getElement()[0], {
            automaticLayout: true,
            scrollBeyondLastLine: true,
            readOnly: state.readOnly,
            language: "cpp",
            fontFamily: "JetBrains Mono",
            minimap: {
                enabled: true
            }
        });

        // Initialize code chat button
        cleanupCodeChat = CodeChatButton.initialize(sourceEditor, container);

        // Initialize AI code completion
        CodeCompletionManager.initialize(sourceEditor);

        // Clean up when editor is disposed
        sourceEditor.onDidDispose(() => {
            if (cleanupCodeChat) {
                cleanupCodeChat();
                cleanupCodeChat = null;
            }
        });
    });

    layout.registerComponent("stdout", function (container, state) {
        stdoutEditor = monaco.editor.create(container.getElement()[0], {
            automaticLayout: true,
            scrollBeyondLastLine: false,
            readOnly: state.readOnly,
            language: "plaintext",
            fontFamily: "JetBrains Mono",
            minimap: {
                enabled: false
            }
        });
    });
}

export function setFontSizeForAllEditors(newFontSize) {
    fontSize = newFontSize;
    sourceEditor.updateOptions({ fontSize });
    stdoutEditor.updateOptions({ fontSize });
    descriptionEditor.updateOptions({ fontSize });
}

export function setEditorLanguage(languageMode) {
    monaco.editor.setModelLanguage(sourceEditor.getModel(), languageMode);
}

export function getSourceValue() {
    return sourceEditor.getValue();
}

export function setSourceValue(value) {
    sourceEditor.setValue(value);
}

export function setStdoutValue(value) {
    stdoutEditor.setValue(value);
}

export function setDescriptionValue(value) {
    descriptionEditor.setValue(value);
}

export function getDescriptionValue() {
    return descriptionEditor.getValue();
}

export function clearEditors() {
    sourceEditor.setValue("");
    stdoutEditor.setValue("");
}

export function getFontSize() {
    return fontSize;
}

export function increaseFontSize() {
    setFontSizeForAllEditors(fontSize + 1);
}

export function decreaseFontSize() {
    setFontSizeForAllEditors(fontSize - 1);
}

export function resetFontSize() {
    setFontSizeForAllEditors(13);
} 