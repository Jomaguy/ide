/**
 * Compiler Manager Component
 * 
 * Manages code compilation and execution through the Judge0 API.
 * Handles submission of code, tracking execution status, and processing results.
 */

import * as EditorManager from "../editor/EditorManager.js";
import * as LanguageManager from "../language/LanguageManager.js";
import * as ErrorChatButton from "../chat/ErrorChatButton.js";

// Constants
const INITIAL_WAIT_TIME_MS = 0;
const WAIT_TIME_FUNCTION = i => 100;
const MAX_PROBE_REQUESTS = 50;

// API Configuration
const API_KEY = ""; // Get yours at https://platform.sulu.sh/apis/judge0
const AUTH_HEADERS = API_KEY ? {
    "Authorization": `Bearer ${API_KEY}`
} : {};

// State variables
let timeStart;
let $runBtn;
let $statusLine;
let sqliteAdditionalFiles;
let layout;

/**
 * Shows an error modal with the given title and content
 */
function showError(title, content) {
    $("#judge0-site-modal #title").html(title);
    $("#judge0-site-modal .content").html(content);
}

/**
 * Shows an HTTP error modal
 */
function showHttpError(jqXHR) {
    showError("Error", `HTTP ${jqXHR.status} - ${jqXHR.statusText}`);
}

/**
 * Checks if the solution is correct
 */
function checkSolution(output) {
    // Convert output to number and trim whitespace
    const userAnswer = parseInt(output.trim());
    const expectedAnswer = 233168; // Sum of multiples of 3 or 5 below 1000
    
    if (userAnswer === expectedAnswer) {
        // Show success modal
        $("#judge0-site-modal #title").html("🎉 Congratulations!");
        $("#judge0-site-modal .content").html(`
            <div style="text-align: center; padding: 20px;">
                <h2>Problem Solved!</h2>
                <p>You've successfully solved Problem 1: Multiples of 3 or 5</p>
                <p>Your answer: ${userAnswer}</p>
            </div>
        `);
        $("#judge0-site-modal").modal("show");
        return true;
    }
    return false;
}

/**
 * Initializes the compiler manager
 * @param {JQuery<HTMLElement>} runButton - The run button element
 * @param {JQuery<HTMLElement>} statusLine - The status line element
 * @param {GoldenLayout} layoutInstance - The GoldenLayout instance
 */
export function initialize(runButton, statusLine, layoutInstance) {
    $runBtn = runButton;
    $statusLine = statusLine;
    layout = layoutInstance;
}

/**
 * Encodes a string to base64
 * @param {string} str - The string to encode
 * @returns {string} The base64 encoded string
 */
function encode(str) {
    return btoa(unescape(encodeURIComponent(str || "")));
}

/**
 * Decodes a base64 string
 * @param {string} bytes - The base64 string to decode
 * @returns {string} The decoded string
 */
function decode(bytes) {
    var escaped = escape(atob(bytes || ""));
    try {
        return decodeURIComponent(escaped);
    } catch {
        return unescape(escaped);
    }
}

/**
 * Handles errors during code execution
 * @param {Object} jqXHR - The jQuery XHR object containing error details
 */
function handleRunError(jqXHR) {
    showHttpError(jqXHR);
    $runBtn.removeClass("disabled");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "runError",
        data: jqXHR
    })), "*");

    window.dispatchEvent(new CustomEvent('compiler-error', { 
        detail: jqXHR
    }));
}

/**
 * Handles the result of code execution
 * @param {Object} data - The execution result data
 */
function handleResult(data) {
    const tat = Math.round(performance.now() - timeStart);
    console.log(`It took ${tat}ms to get submission result.`);

    const status = data.status;
    const stdout = decode(data.stdout);
    const compileOutput = decode(data.compile_output);
    const time = (data.time === null ? "-" : data.time + "s");
    const memory = (data.memory === null ? "-" : data.memory + "KB");

    $statusLine.html(`${status.description}, ${time}, ${memory} (TAT: ${tat}ms)`);

    const output = [compileOutput, stdout].join("\n").trim();

    EditorManager.setStdoutValue(output);

    // Find the stdout container using the layout API
    const stdoutComponent = layout.root.getItemsById('stdout')[0];
    if (!stdoutComponent) {
        console.error('Could not find stdout component');
        return;
    }

    // Get the Monaco editor instance
    const editorElement = stdoutComponent.container.getElement().find('.monaco-editor')[0];
    if (!editorElement) {
        console.error('Could not find editor element');
        return;
    }

    // Check if there's an error in the output
    if (compileOutput || (status && status.id !== 3)) {  // 3 is typically the "Accepted" status
        ErrorChatButton.create(output, editorElement);
        window.dispatchEvent(new CustomEvent('compiler-error', { 
            detail: output
        }));
    } else {
        ErrorChatButton.remove();
        // Check if the solution is correct
        if (checkSolution(output)) {
            window.dispatchEvent(new CustomEvent('compiler-success', { 
                detail: output
            }));
        }
    }

    $runBtn.removeClass("disabled");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "postExecution",
        status: data.status,
        time: data.time,
        memory: data.memory,
        output: output
    })), "*");
}

/**
 * Fetches the submission status and result
 * @param {string} flavor - The Judge0 API flavor (CE or EXTRA_CE)
 * @param {string} region - The API region
 * @param {string} submission_token - The submission token
 * @param {number} iteration - The current iteration count
 */
function fetchSubmission(flavor, region, submission_token, iteration) {
    if (iteration >= MAX_PROBE_REQUESTS) {
        handleRunError({
            statusText: "Maximum number of probe requests reached.",
            status: 504
        });
        return;
    }

    $.ajax({
        url: `${LanguageManager.UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${submission_token}?base64_encoded=true`,
        headers: {
            "X-Judge0-Region": region
        },
        success: function (data) {
            if (data.status.id <= 2) { // In Queue or Processing
                $statusLine.html(data.status.description);
                setTimeout(fetchSubmission.bind(null, flavor, region, submission_token, iteration + 1), WAIT_TIME_FUNCTION(iteration));
            } else {
                handleResult(data);
            }
        },
        error: handleRunError
    });
}

/**
 * Sends a compilation request to the Judge0 API
 * @param {Object} data - The request data
 * @param {string} flavor - The API flavor
 * @param {number} languageId - The language ID
 */
function sendRequest(data, flavor, languageId) {
    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "preExecution",
        source_code: EditorManager.getSourceValue(),
        language_id: languageId,
        flavor: flavor,
        stdin: ""
    })), "*");

    timeStart = performance.now();
    $.ajax({
        url: `${LanguageManager.AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        headers: AUTH_HEADERS,
        success: function (data, textStatus, request) {
            console.log(`Your submission token is: ${data.token}`);
            let region = request.getResponseHeader('X-Judge0-Region');
            setTimeout(fetchSubmission.bind(null, flavor, region, data.token, 1), INITIAL_WAIT_TIME_MS);
        },
        error: handleRunError
    });
}

/**
 * Runs the code in the editor
 */
export function run() {
    if (EditorManager.getSourceValue().trim() === "") {
        showError("Error", "Source code can't be empty!");
        return;
    }

    $runBtn.addClass("disabled");
    EditorManager.setStdoutValue("");
    $statusLine.html("");

    let x = layout.root.getItemsById("stdout")[0];
    x.parent.header.parent.setActiveContentItem(x);

    let sourceValue = encode(EditorManager.getSourceValue());
    let languageId = LanguageManager.getSelectedLanguageId();
    let flavor = LanguageManager.getSelectedLanguageFlavor();

    if (languageId === 44) {
        sourceValue = EditorManager.getSourceValue();
    }

    let data = {
        source_code: sourceValue,
        language_id: languageId,
        stdin: "",
        redirect_stderr_to_stdout: true
    };

    // Handle SQLite specific requirements
    if (languageId === 82) {
        if (!sqliteAdditionalFiles) {
            $.ajax({
                url: `./data/additional_files_zip_base64.txt`,
                contentType: "text/plain",
                success: function (responseData) {
                    sqliteAdditionalFiles = responseData;
                    data["additional_files"] = sqliteAdditionalFiles;
                    sendRequest(data, flavor, languageId);
                },
                error: handleRunError
            });
        } else {
            data["additional_files"] = sqliteAdditionalFiles;
            sendRequest(data, flavor, languageId);
        }
    } else {
        sendRequest(data, flavor, languageId);
    }
}

/**
 * Handles compiler error events
 * @param {Object} detail - The error details
 */
export function handleError(detail) {
    if (detail.message) {
        showError("Error", detail.message);
        return;
    }

    // Find the stdout container using the layout API
    const stdoutComponent = layout.root.getItemsById('stdout')[0];
    if (!stdoutComponent) {
        console.error('Could not find stdout component');
        return;
    }

    // Get the Monaco editor instance
    const editorElement = stdoutComponent.container.getElement().find('.monaco-editor')[0];
    if (!editorElement) {
        console.error('Could not find editor element');
        return;
    }

    ErrorChatButton.create(detail, editorElement);
}

/**
 * Handles compiler success events
 * @param {Object} detail - The success details
 */
export function handleSuccess(detail) {
    // Check if the solution is correct
    checkSolution(detail);
} 