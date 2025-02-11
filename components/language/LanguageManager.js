/**
 * Language Manager Component
 * 
 * Manages programming language selection and configuration for the IDE.
 * Handles language dropdown UI, language mode selection, and language-specific settings.
 */

import { getEditorLanguageMode } from "../../core/editor/EditorLanguages.js";
import * as EditorManager from "../editor/EditorManager.js";

// Constants
const CE = "CE";
const EXTRA_CE = "EXTRA_CE";

const AUTHENTICATED_CE_BASE_URL = "https://judge0-ce.p.sulu.sh";
const AUTHENTICATED_EXTRA_CE_BASE_URL = "https://judge0-extra-ce.p.sulu.sh";

const UNAUTHENTICATED_CE_BASE_URL = "https://ce.judge0.com";
const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "https://extra-ce.judge0.com";

// URLs for different flavors
const AUTHENTICATED_BASE_URL = {
    [CE]: AUTHENTICATED_CE_BASE_URL,
    [EXTRA_CE]: AUTHENTICATED_EXTRA_CE_BASE_URL
};

const UNAUTHENTICATED_BASE_URL = {
    [CE]: UNAUTHENTICATED_CE_BASE_URL,
    [EXTRA_CE]: UNAUTHENTICATED_EXTRA_CE_BASE_URL
};

// Language cache
let languages = {};
let $selectLanguage;

// Extension to language mapping
const EXTENSIONS_TABLE = {
    "cpp": { "flavor": CE, "language_id": 105 }, // C++ (GCC 14.1.0)
    "java": { "flavor": CE, "language_id": 91 }, // Java (JDK 17.0.6)
    "py": { "flavor": EXTRA_CE, "language_id": 25 }, // Python for ML (3.11.2)
    "txt": { "flavor": CE, "language_id": 43 } // Plain Text
};

export function initialize() {
    $selectLanguage = $("#select-language");
    $selectLanguage.change(function (event, data) {
        loadSelectedLanguage(true);
    });
}

export async function loadLanguages() {
    return new Promise((resolve, reject) => {
        let options = [];
        const allowedLanguages = {
            'CE': [105, 91],      // C++ (GCC 14.1.0), Java (JDK 17.0.6)
            'EXTRA_CE': [25]      // Python for ML (3.11.2)
        };

        $.ajax({
            url: UNAUTHENTICATED_CE_BASE_URL + "/languages",
            success: function (data) {
                for (let i = 0; i < data.length; i++) {
                    let language = data[i];
                    if (allowedLanguages['CE'] && allowedLanguages['CE'].includes(language.id)) {
                        let option = new Option(language.name, language.id);
                        option.setAttribute("flavor", CE);
                        option.setAttribute("language_mode", getEditorLanguageMode(language.name));
                        options.push(option);
                    }
                }
            },
            error: reject
        }).always(function () {
            $.ajax({
                url: UNAUTHENTICATED_EXTRA_CE_BASE_URL + "/languages",
                success: function (data) {
                    for (let i = 0; i < data.length; i++) {
                        let language = data[i];
                        if (allowedLanguages['EXTRA_CE'] && allowedLanguages['EXTRA_CE'].includes(language.id)) {
                            let option = new Option(language.name, language.id);
                            option.setAttribute("flavor", EXTRA_CE);
                            option.setAttribute("language_mode", getEditorLanguageMode(language.name));
                            options.push(option);
                        }
                    }
                },
                error: reject
            }).always(function () {
                options.sort((a, b) => a.text.localeCompare(b.text));
                $selectLanguage.append(options);
                resolve();
            });
        });
    });
}

export async function loadSelectedLanguage(skipSetDefaultSourceCodeName = false) {
    const languageMode = $selectLanguage.find(":selected").attr("language_mode");
    EditorManager.setEditorLanguage(languageMode);

    if (!skipSetDefaultSourceCodeName) {
        const language = await getSelectedLanguage();
        // Note: setSourceCodeName is disabled in ide.js, so we can skip this
        // setSourceCodeName(language.source_file);
    }
}

export async function getSelectedLanguage() {
    return getLanguage(getSelectedLanguageFlavor(), getSelectedLanguageId());
}

export function getSelectedLanguageId() {
    return parseInt($selectLanguage.val());
}

export function getSelectedLanguageFlavor() {
    return $selectLanguage.find(":selected").attr("flavor");
}

export function selectLanguageByFlavorAndId(languageId, flavor) {
    let option = $selectLanguage.find(`[value=${languageId}][flavor=${flavor}]`);
    if (option.length) {
        option.prop("selected", true);
        $selectLanguage.trigger("change", { skipSetDefaultSourceCodeName: true });
    }
}

export function selectLanguageForExtension(extension) {
    let language = getLanguageForExtension(extension);
    selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

export async function getLanguage(flavor, languageId) {
    return new Promise((resolve, reject) => {
        if (languages[flavor] && languages[flavor][languageId]) {
            resolve(languages[flavor][languageId]);
            return;
        }

        $.ajax({
            url: `${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`,
            success: function (data) {
                if (!languages[flavor]) {
                    languages[flavor] = {};
                }
                languages[flavor][languageId] = data;
                resolve(data);
            },
            error: reject
        });
    });
}

export function getLanguageForExtension(extension) {
    return EXTENSIONS_TABLE[extension] || { "flavor": CE, "language_id": 43 }; // Plain Text
}

// Export constants that might be needed by other modules
export { 
    CE, 
    EXTRA_CE,
    AUTHENTICATED_BASE_URL,
    UNAUTHENTICATED_BASE_URL
}; 