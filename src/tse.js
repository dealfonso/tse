/**
 * 
 *  Template String Evaluator (TSE) - A library for evaluating template strings in the DOM
 *                                    using JavaScript expressions.
 * 
 *  MIT License
 *
 *  Copyright 2025 Carlos A. (https://github.com/dealfonso)
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 * 
 */
'use strict';

if (typeof window === 'undefined') {
    throw new Error("This script must be executed in a browser environment.");
}

const version = "1.0.0";  // Version of the library

// Global context for evaluating expressions
const globalContext = {};

// Default configuration
const defaultConfig = {
    attributePrefix: 'data-bind-',  // Prefix for binding attributes
    templateDelimiter: /\${([^}]*)}/g,  // Regular expression to detect template literals
    evalContext: window,  // Context for evaluating expressions
    observeMutations: true,  // Whether to observe DOM mutations
    debounceTime: 50  // Debounce time to avoid multiple evaluations
};

let config = { ...defaultConfig };

// Reference to the current observer
let currentObserver = null;

/**
 * Evaluates an expression in the provided context.
 * @param {string} expression - The expression to evaluate
 * @param {Object} context - The context for evaluating the expression
 * @returns {*} The result of the evaluation
 */
function evaluateExpression(expression, context) {
    try {
        // Create a merged context combining the base context and library's globalContext
        const mergedContext = { 
            ...context || {}, 
            ...globalContext 
        };
        
        // Create a function to evaluate the expression in the merged context
        const func = new Function('context', `with(context) { return ${expression}; }`);
        return func(mergedContext);
    } catch (error) {
        console.error(`Error evaluating expression "${expression}":`, error);
        return `[Error: ${error.message}]`;
    }
}

/**
 * Processes a text node looking for template literals and replaces them.
 * @param {Node} textNode - The text node to process
 */
function processTextNode(textNode) {
    const originalContent = textNode.nodeValue;
    if (!config.templateDelimiter.test(originalContent)) return;
    
    // Reset the regular expression
    config.templateDelimiter.lastIndex = 0;
    
    // Replace all occurrences of template literals
    const newContent = originalContent.replace(config.templateDelimiter, (match, expression) => {
        const value = evaluateExpression(expression);
        return value !== undefined ? value : match;
    });
    
    if (newContent !== originalContent) {
        textNode.nodeValue = newContent;
    }
}

/**
 * Processes an element node and its attributes.
 * @param {Element} element - The element to process
 */
function processElement(element) {
    // Process attributes with data-bind-
    Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith(config.attributePrefix)) {
            const propertyName = attr.name.substring(config.attributePrefix.length);
            const value = evaluateExpression(attr.value);
            element[propertyName] = value;
        }
    });
}

/**
 * Recursively traverses all DOM nodes.
 * @param {Node} rootNode - The root node to start from
 */
function scanDOM(rootNode = document.body) {
    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
            processTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            processElement(node);
        }
    }
}

/**
 * Sets up a MutationObserver to watch for DOM changes.
 * @returns {MutationObserver} The newly created observer
 */
function setupMutationObserver() {
    if (!window.MutationObserver) return null;
    
    // Disconnect the existing observer if there is one
    if (currentObserver) {
        // console.log("Disconnecting existing observer...");
        currentObserver.disconnect();
        currentObserver = null;
    }
    
    // Debounce control to avoid multiple evaluations
    let debounceTimer;
    
    const observer = new MutationObserver(mutations => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            mutations.forEach(mutation => {
                // Process added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        processTextNode(node);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        processElement(node);
                        scanDOM(node); // Scan children
                    }
                });
                
                // Process attribute changes
                if (mutation.type === 'attributes') {
                    processElement(mutation.target);
                }
                
                // Process text changes
                if (mutation.type === 'characterData') {
                    processTextNode(mutation.target);
                }
            });
        }, config.debounceTime);
    });
    
    observer.observe(document.body, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true
    });
    
    // Save reference to the new observer
    currentObserver = observer;
    
    return observer;
}

/**
 * Public API of the library.
 */
window.DOMTemplateStringEvaluator = {
    /**
     * Initializes the library with the provided configuration or updates the existing configuration.
     * @param {Object} customConfig - Custom configuration
     */
    init: function(customConfig = {}) {
        // console.log("Initializing/Updating DOMTemplateStringEvaluator...", customConfig);

        // Update configuration with new parameters
        const previousConfig = { ...config };
        config = { ...config, ...customConfig };
        
        // Extend the global context with the provided one
        if (customConfig.evalContext) {
            Object.assign(globalContext, customConfig.evalContext);
        }
        
        // Perform initial scan when DOM is ready
        const domReady = document.readyState !== 'loading';
        
        const setupObserverIfNeeded = () => {
            // Recreate the observer if observation settings or debounce has changed
            if (config.observeMutations) {
                if (!currentObserver || 
                    previousConfig.debounceTime !== config.debounceTime || 
                    !previousConfig.observeMutations) {
                    setupMutationObserver();
                }
            } else if (currentObserver) {
                // If observation was disabled, disconnect the observer
                currentObserver.disconnect();
                currentObserver = null;
            }
        };
        
        if (domReady) {
            scanDOM();
            setupObserverIfNeeded();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                scanDOM();
                setupObserverIfNeeded();
            });
        }
        
        return this;
    },
    
    /**
     * Manually scans the DOM from a root node.
     * @param {Node} rootNode - The root node to start scanning from
     */
    scan: function(rootNode = document.body) {
        scanDOM(rootNode);
        return this;
    },
    
    /**
     * Adds variables to the global context for evaluating expressions.
     * @param {Object} contextVars - Variables to add to the context
     */
    addToContext: function(contextVars) {
        Object.assign(globalContext, contextVars);
        return this;
    },
    
    /**
     * Evaluates an expression in the current context.
     * @param {string} expression - The expression to evaluate
     * @returns {*} The result of the evaluation
     */
    evaluate: function(expression) {
        return evaluateExpression(expression, config.evalContext);
    },
    
    /**
     * Gets the current configuration.
     * @returns {Object} The current configuration
     */
    getConfig: function() {
        return { ...config };
    },

    /**
     * Gets the current version of the library.
     * @returns {string} The version of the library
     */
    getVersion: function() {
        return version;
    }
};

document.addEventListener("DOMContentLoaded", function() {
    DOMTemplateStringEvaluator.init();
});
