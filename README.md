# DOM Template String Evaluator

[![](https://data.jsdelivr.com/v1/package/gh/dealfonso/tse/badge?style=rounded)](https://www.jsdelivr.com/package/gh/dealfonso/tse) ![](https://img.shields.io/github/v/release/dealfonso/tse) ![](https://img.shields.io/github/release-date/dealfonso/tse) ![](https://img.shields.io/github/languages/code-size/dealfonso/tse) ![](https://img.shields.io/github/license/dealfonso/tse)

A lightweight JavaScript library that allows using template literals (`${expression}`) directly in HTML and automatically keeps them updated. This library traverses the DOM, identifies template literals and replaces them with their evaluated values.

## Features

- Evaluates template literals (`${expression}`) in DOM text and replaces them with their values
- Binds attributes with customizable prefix (default `data-tse-bind-`) to element properties
- Automatically observes DOM changes to process dynamically added nodes
- Dual context system: access to global context (window) + custom library context
- Includes debounce system to optimize performance
- Fluent API that allows chaining operations
- Selective evaluation with `data-tse-disable` attribute to exclude elements from processing

## Installation

Include the script in your HTML page:

```html
<script src="path/to/tse.js"></script>
```

or use a CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/dealfonso/tse/dist/tse.min.js"></script>
```

## Basic Usage

The library is automatically initialized when the DOM is ready:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/gh/dealfonso/tse/dist/tse.min.js"></script>
</head>
<body>
    <div>
        <p>The current date is: ${new Date().toLocaleDateString()}</p>
        <input type="text" data-bind-value="'Default value'">
    </div>
</body>
</html>
```

See this example in action: [Live Example](https://dealfonso.github.io/tse/example.html) or at [CodePen](https://codepen.io/dealfonso/pen/RNPzwVN).

## Disabling Template Evaluation

You can exclude specific elements and all their children from template evaluation by adding the `data-tse-disable` attribute:

```html
<div>
    <p>This will be evaluated: ${new Date().toLocaleDateString()}</p>
    
    <div data-tse-disable>
        <p>This will NOT be evaluated: ${new Date().toLocaleDateString()}</p>
        <input data-tse-bind-value="'This binding is ignored too'">
    </div>
    
    <p>This will be evaluated again: ${new Date().toLocaleDateString()}</p>
</div>
```

This is particularly useful when you need to display raw template code examples or when you want to temporarily disable evaluation for a section of the page.

You can also programmatically enable or disable elements:

```javascript
// Disable template evaluation for an element
const myElement = document.getElementById('my-element');
DOMTemplateStringEvaluator.disable(myElement);

// Re-enable template evaluation (and immediately process its content)
DOMTemplateStringEvaluator.enable(myElement);

// Check if an element has evaluation disabled
if (DOMTemplateStringEvaluator.isDisabled(myElement)) {
    console.log('Template evaluation is disabled for this element');
}
```

## Context System

This library uses a dual context system:

1. **Base context**: By default it's `window`, where you can access all global functions and objects.
2. **Custom context**: Variables and functions added through `addToContext()`.

The evaluated expressions have access to both contexts, with priority given to the custom context in case of duplicate names.

### Context Usage Example

```html
<script>
    // Add variables to the custom context
    DOMTemplateStringEvaluator.addToContext({
        user: {
            name: 'Maria',
            age: 30
        },
        greet: function(name) {
            return `Hello, ${name}!`;
        }
    });
</script>

<!-- Using variables from custom context -->
<p>${greet(user.name)}</p>
<p>Age: ${user.age}</p>

<!-- Using objects from global context (window) -->
<p>Browser: ${navigator.userAgent}</p>
```

## API

### `DOMTemplateStringEvaluator.init(customConfig)`

Initializes or updates the library with custom configuration.

```javascript
DOMTemplateStringEvaluator.init({
    attributePrefix: 'data-bind-',       // Attribute prefix
    templateDelimiter: /\${([^}]*)}/g,   // Template delimiter
    evalContext: window,                 // Base evaluation context
    observeMutations: true,              // Observe DOM changes
    debounceTime: 50                     // Debounce time (ms)
});
```

#### Configuration Options

* **attributePrefix** (default: `'data-bind-'`)  
  Defines the prefix used to identify attributes that should be bound to element properties. For example, `<input data-bind-value="name">` makes the `value` property of the input element (`this`) take the value of `name`. You can change this if you need to avoid conflicts with other frameworks or use a specific syntax.

* **templateDelimiter** (default: `/\${([^}]*)}/g`)  
  Regular expression that identifies template literals in the text. By default it looks for the format `${expression}`, but you can customize it if you need another syntax, such as `{{expression}}` for Mustache or Handlebars.

* **evalContext** (default: `window`)  
  The base context for evaluating expressions. It's the "global" object where variables and functions not defined in the custom context will be looked up. It's usually left as `window`, but you can change it to another object if you need to isolate the evaluation environment.

* **observeMutations** (default: `true`)  
  Controls whether the library should automatically observe DOM changes using MutationObserver. If set to `false`, templates will only be evaluated during initial loading or when `scan()` is manually called. Disabling this option can improve performance on pages with many unrelated DOM updates.

* **debounceTime** (default: `50`)  
  Time in milliseconds to group multiple DOM changes before processing them. This prevents repeated evaluations when many changes occur in a short period of time (for example, during the rendering of a large list). A higher value reduces processing load but increases visual latency. A lower value makes updates more immediate but may affect performance.

### `DOMTemplateStringEvaluator.addToContext(contextVars)`

Adds variables to the custom context for evaluating expressions.

```javascript
DOMTemplateStringEvaluator.addToContext({
    greeting: 'Hello world',
    calculateTotal: (a, b) => a + b
});
```

This way, you can later access the `greeting` variable and the `calculateTotal` function in your template literals.

### `DOMTemplateStringEvaluator.scan(rootNode)`

Manually scans the DOM from a specific root node.

```javascript
// Scan the entire page
DOMTemplateStringEvaluator.scan();

// Scan only a specific container
DOMTemplateStringEvaluator.scan(document.getElementById('my-container'));
```

In principle, the library will automatically scan `document.body` when initialized, and when a DOM change occurs. However, if you need to scan a specific node or re-scan after changes, you can use this method.

### `DOMTemplateStringEvaluator.evaluate(expression)`

Manually evaluates an expression in the combined context.

```javascript
const result = DOMTemplateStringEvaluator.evaluate('2 + 2'); // Returns 4
const customGreeting = DOMTemplateStringEvaluator.evaluate('greet("John")');
```

This method allows you to directly evaluate expressions, using the library's combined context. It can be used to evaluate expressions that are not directly in the DOM, or for unit testing.

### `DOMTemplateStringEvaluator.evaluateText(text)`

Manually evaluates a string containing template expressions.

```javascript
const template = "Hello, ${user.name}!";
const result = DOMTemplateStringEvaluator.evaluateText(template);
```

### `DOMTemplateStringEvaluator.setContent(element, content, method)`

Sets element content with immediate template evaluation.

```javascript
const element = document.getElementById('greeting');
DOMTemplateStringEvaluator.setContent(element, 'Hello, ${user.name}!');
// Or with HTML content
DOMTemplateStringEvaluator.setContent(element, '<strong>Hello, ${user.name}!</strong>', 'html');
```

### `DOMTemplateStringEvaluator.disable(element)`

Disables template evaluation for an element and all its descendants by adding the `data-tse-disable` attribute.

```javascript
const container = document.getElementById('raw-template-container');
DOMTemplateStringEvaluator.disable(container);
```

### `DOMTemplateStringEvaluator.enable(element)`

Enables template evaluation for an element by removing the `data-tse-disable` attribute and immediately processes its content.

```javascript
const container = document.getElementById('template-container');
DOMTemplateStringEvaluator.enable(container);
```

### `DOMTemplateStringEvaluator.isDisabled(element)`

Checks if an element has template evaluation disabled.

```javascript
if (DOMTemplateStringEvaluator.isDisabled(element)) {
    console.log('This element is not being processed');
}
```

### `DOMTemplateStringEvaluator.getConfig()`

Gets the current configuration of the library.

```javascript
// Get the complete configuration object
const currentConfig = DOMTemplateStringEvaluator.getConfig();
console.log(currentConfig.attributePrefix); // 'data-tse-bind-'
console.log(currentConfig.debounceTime); // 10
```

This is useful for debugging or when you need to check the current settings before making changes.

### `DOMTemplateStringEvaluator.getVersion()`

Returns the current version of the library.

```javascript
const version = DOMTemplateStringEvaluator.getVersion();
console.log(`Using TSE version: ${version}`);
```

### `DOMTemplateStringEvaluator.destroy()`

Completely removes the library's functionality, disconnecting the observer and restoring original DOM methods.

```javascript
// Clean up the library when you no longer need it
DOMTemplateStringEvaluator.destroy();
```

This is particularly useful in single page applications when you need to clean up resources before navigating away from a page, or when you need to temporarily disable the library to perform DOM operations without template evaluation.

## Techinical Details

- This library uses `new Function()` to evaluate expressions, which could be dangerous if untrusted expressions are executed. Use it only with controlled content.
- It uses `MutationObserver` to automatically detect changes in the DOM and re-evaluate templates.
- The library is designed to be lightweight and efficient, minimizing performance impact even on pages with many dynamic updates.
- The library overrides the `textContent` and `innerHTML` properties of elements to insert evaluated values so that it is more immediate and does not require a full re-render of the element.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.