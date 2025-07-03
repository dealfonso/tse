/**
    MIT License

    Copyright 2025 Carlos A. (https://github.com/dealfonso)

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

(function (exports) {
	"use strict";
	if (typeof window === "undefined") {
		throw new Error("This script must be executed in a browser environment.");
	}
	const version = "1.0.0";
	const globalContext = {};
	const defaultConfig = {
		attributePrefix: "data-bind-",
		templateDelimiter: /\${([^}]*)}/g,
		evalContext: window,
		observeMutations: true,
		debounceTime: 50
	};
	let config = {
		...defaultConfig
	};
	let currentObserver = null;

	function evaluateExpression(expression, context) {
		try {
			const mergedContext = {
				...context || {},
				...globalContext
			};
			const func = new Function("context", `with(context) { return ${expression}; }`);
			return func(mergedContext);
		} catch (error) {
			console.error(`Error evaluating expression "${expression}":`, error);
			return `[Error: ${error.message}]`;
		}
	}

	function processTextNode(textNode) {
		const originalContent = textNode.nodeValue;
		if (!config.templateDelimiter.test(originalContent)) return;
		config.templateDelimiter.lastIndex = 0;
		const newContent = originalContent.replace(config.templateDelimiter, (match, expression) => {
			const value = evaluateExpression(expression);
			return value !== undefined ? value : match;
		});
		if (newContent !== originalContent) {
			textNode.nodeValue = newContent;
		}
	}

	function processElement(element) {
		Array.from(element.attributes).forEach(attr => {
			if (attr.name.startsWith(config.attributePrefix)) {
				const propertyName = attr.name.substring(config.attributePrefix.length);
				const value = evaluateExpression(attr.value);
				element[propertyName] = value;
			}
		});
	}

	function scanDOM(rootNode = document.body) {
		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
		let node;
		while (node = walker.nextNode()) {
			if (node.nodeType === Node.TEXT_NODE) {
				processTextNode(node);
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				processElement(node);
			}
		}
	}

	function setupMutationObserver() {
		if (!window.MutationObserver) return null;
		if (currentObserver) {
			currentObserver.disconnect();
			currentObserver = null;
		}
		let debounceTimer;
		const observer = new MutationObserver(mutations => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				mutations.forEach(mutation => {
					mutation.addedNodes.forEach(node => {
						if (node.nodeType === Node.TEXT_NODE) {
							processTextNode(node);
						} else if (node.nodeType === Node.ELEMENT_NODE) {
							processElement(node);
							scanDOM(node);
						}
					});
					if (mutation.type === "attributes") {
						processElement(mutation.target);
					}
					if (mutation.type === "characterData") {
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
		currentObserver = observer;
		return observer;
	}
	window.DOMTemplateStringEvaluator = {
		init: function (customConfig = {}) {
			const previousConfig = {
				...config
			};
			config = {
				...config,
				...customConfig
			};
			if (customConfig.evalContext) {
				Object.assign(globalContext, customConfig.evalContext);
			}
			const domReady = document.readyState !== "loading";
			const setupObserverIfNeeded = () => {
				if (config.observeMutations) {
					if (!currentObserver || previousConfig.debounceTime !== config.debounceTime || !previousConfig.observeMutations) {
						setupMutationObserver();
					}
				} else if (currentObserver) {
					currentObserver.disconnect();
					currentObserver = null;
				}
			};
			if (domReady) {
				scanDOM();
				setupObserverIfNeeded();
			} else {
				document.addEventListener("DOMContentLoaded", () => {
					scanDOM();
					setupObserverIfNeeded();
				});
			}
			return this;
		},
		scan: function (rootNode = document.body) {
			scanDOM(rootNode);
			return this;
		},
		addToContext: function (contextVars) {
			Object.assign(globalContext, contextVars);
			return this;
		},
		evaluate: function (expression) {
			return evaluateExpression(expression, config.evalContext);
		},
		getConfig: function () {
			return {
				...config
			};
		},
		getVersion: function () {
			return version;
		}
	};
	document.addEventListener("DOMContentLoaded", function () {
		DOMTemplateStringEvaluator.init();
	});
})(window);
