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
	const version = "1.0.1";
	const globalContext = {};
	const defaultConfig = {
		attributePrefix: "data-tse-bind-",
		templateDelimiter: /\${([^}]*)}/g,
		evalContext: window,
		observeMutations: true,
		debounceTime: 10,
		disableAttribute: "data-tse-disable"
	};
	let config = {
		...defaultConfig
	};
	let currentObserver = null;
	const originalMethods = {
		textContent: Object.getOwnPropertyDescriptor(Node.prototype, "textContent"),
		innerHTML: Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML"),
		setAttribute: Element.prototype.setAttribute
	};

	function isNodeDisabled(node) {
		if (node.nodeType !== Node.ELEMENT_NODE) {
			if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
				return isNodeDisabled(node.parentElement);
			}
			return false;
		}
		if (node.hasAttribute(config.disableAttribute)) {
			return true;
		}
		let parent = node.parentElement;
		while (parent) {
			if (parent.hasAttribute(config.disableAttribute)) {
				return true;
			}
			parent = parent.parentElement;
		}
		return false;
	}

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

	function evaluateText(text) {
		if (typeof text !== "string" || !config.templateDelimiter.test(text)) return text;
		config.templateDelimiter.lastIndex = 0;
		return text.replace(config.templateDelimiter, (match, expression) => {
			const value = evaluateExpression(expression);
			return value !== undefined ? value : match;
		});
	}

	function processTextNode(textNode) {
		if (isNodeDisabled(textNode)) return;
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
		if (isNodeDisabled(element)) return;
		Array.from(element.attributes).forEach(attr => {
			if (attr.name.startsWith(config.attributePrefix)) {
				const propertyName = attr.name.substring(config.attributePrefix.length);
				const value = evaluateExpression(attr.value);
				element[propertyName] = value;
			}
		});
	}

	function scanDOM(rootNode = document.body) {
		if (rootNode.nodeType === Node.ELEMENT_NODE && isNodeDisabled(rootNode)) {
			return;
		}
		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
			acceptNode: function (node) {
				if (node.nodeType === Node.ELEMENT_NODE && isNodeDisabled(node)) {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		}, false);
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
						if (node.nodeType === Node.ELEMENT_NODE && isNodeDisabled(node)) {
							return;
						}
						if (node.nodeType === Node.TEXT_NODE) {
							processTextNode(node);
						} else if (node.nodeType === Node.ELEMENT_NODE) {
							processElement(node);
							scanDOM(node);
						}
					});
					if (mutation.type === "attributes") {
						if (mutation.attributeName === config.disableAttribute) {
							if (!mutation.target.hasAttribute(config.disableAttribute)) {
								processElement(mutation.target);
								scanDOM(mutation.target);
							}
						} else if (!isNodeDisabled(mutation.target)) {
							processElement(mutation.target);
						}
					}
					if (mutation.type === "characterData") {
						if (!isNodeDisabled(mutation.target)) {
							processTextNode(mutation.target);
						}
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

	function overrideNativeMethods() {
		Object.defineProperty(Node.prototype, "textContent", {
			get: originalMethods.textContent.get,
			set: function (value) {
				if (this.nodeType === Node.ELEMENT_NODE && isNodeDisabled(this)) {
					return originalMethods.textContent.set.call(this, value);
				}
				const evaluatedValue = evaluateText(value);
				return originalMethods.textContent.set.call(this, evaluatedValue);
			},
			configurable: true
		});
		Object.defineProperty(Element.prototype, "innerHTML", {
			get: originalMethods.innerHTML.get,
			set: function (value) {
				if (isNodeDisabled(this)) {
					return originalMethods.innerHTML.set.call(this, value);
				}
				const evaluatedValue = evaluateText(value);
				return originalMethods.innerHTML.set.call(this, evaluatedValue);
			},
			configurable: true
		});
		Element.prototype.setAttribute = function (name, value) {
			if (isNodeDisabled(this) && name !== config.disableAttribute) {
				return originalMethods.setAttribute.call(this, name, value);
			}
			if (typeof value === "string") {
				value = evaluateText(value);
			}
			return originalMethods.setAttribute.call(this, name, value);
		};
	}

	function restoreNativeMethods() {
		Object.defineProperty(Node.prototype, "textContent", originalMethods.textContent);
		Object.defineProperty(Element.prototype, "innerHTML", originalMethods.innerHTML);
		Element.prototype.setAttribute = originalMethods.setAttribute;
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
			overrideNativeMethods();
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
		evaluateText: function (text) {
			return evaluateText(text);
		},
		setContent: function (element, content, method = "text") {
			const evaluatedContent = this.evaluateText(content);
			if (method === "html") {
				element.innerHTML = evaluatedContent;
			} else {
				element.textContent = evaluatedContent;
			}
			return this;
		},
		getConfig: function () {
			return {
				...config
			};
		},
		getVersion: function () {
			return version;
		},
		destroy: function () {
			if (currentObserver) {
				currentObserver.disconnect();
				currentObserver = null;
			}
			restoreNativeMethods();
		},
		isDisabled: function (element) {
			return isNodeDisabled(element);
		},
		enable: function (element) {
			if (element && element.nodeType === Node.ELEMENT_NODE) {
				element.removeAttribute(config.disableAttribute);
				scanDOM(element);
			}
			return this;
		},
		disable: function (element) {
			if (element && element.nodeType === Node.ELEMENT_NODE) {
				element.setAttribute(config.disableAttribute, "");
			}
			return this;
		}
	};
	if (document.readyState !== "loading") {
		DOMTemplateStringEvaluator.init();
	} else {
		document.addEventListener("DOMContentLoaded", function () {
			DOMTemplateStringEvaluator.init();
		});
	}
})(window);
