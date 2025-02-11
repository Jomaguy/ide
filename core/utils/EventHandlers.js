/**
 * Event handling utilities with passive event support
 */

// List of events that should be passive
const PASSIVE_EVENTS = [
    'scroll',
    'touchstart',
    'touchmove',
    'touchend',
    'wheel',
    'mousewheel'
];

let originalAddEventListener;

/**
 * Initialize passive event listeners for the application
 * @param {HTMLElement} rootElement - The root element to attach listeners to
 */
export function initializePassiveEvents(rootElement = document) {
    // Only override once
    if (EventTarget.prototype.addEventListener.__passiveOverride) {
        return;
    }

    // Store original method
    originalAddEventListener = EventTarget.prototype.addEventListener;

    // Override addEventListener
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        let newOptions = options;

        if (PASSIVE_EVENTS.includes(type)) {
            if (typeof options === 'boolean') {
                newOptions = {
                    capture: options,
                    passive: true
                };
            } else if (typeof options === 'object') {
                newOptions = {
                    ...options,
                    passive: options.passive !== false
                };
            } else {
                newOptions = {
                    capture: false,
                    passive: true
                };
            }
        }

        return originalAddEventListener.call(this, type, listener, newOptions);
    };

    // Mark as overridden
    EventTarget.prototype.addEventListener.__passiveOverride = true;

    // Initialize passive listeners for common events
    PASSIVE_EVENTS.forEach(eventType => {
        try {
            rootElement.addEventListener(eventType, null, { passive: true });
            rootElement.removeEventListener(eventType, null, { passive: true });
        } catch (err) {
            console.debug(`Failed to initialize passive listener for ${eventType}`, err);
        }
    });
}

/**
 * Clean up event listener overrides
 */
export function cleanupPassiveEvents() {
    if (EventTarget.prototype.addEventListener.__passiveOverride) {
        EventTarget.prototype.addEventListener = originalAddEventListener;
        delete EventTarget.prototype.addEventListener.__passiveOverride;
    }
} 