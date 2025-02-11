/**
 * IDE Bootstrap File
 * 
 * This is the main entry point for the IDE application.
 * It simply waits for the DOM to be ready and then initializes the App component.
 */

import * as App from "./App.js";

document.addEventListener("DOMContentLoaded", () => App.initialize()); 