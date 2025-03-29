/**
 * DOM utility functions for more efficient element selection and manipulation
 */
const DOM = {
    // Get element by ID with caching
    byId: (() => {
        const cache = {};
        return (id) => {
            if (!(id in cache)) {
                cache[id] = document.getElementById(id);
            }
            return cache[id];
        };
    })(),
    
    // Get elements by class name
    byClass: (className, parent = document) => parent.getElementsByClassName(className),
    
    // Get elements by tag name
    byTag: (tagName, parent = document) => parent.getElementsByTagName(tagName),
    
    // Query selector
    query: (selector, parent = document) => parent.querySelector(selector),
    
    // Query selector all
    queryAll: (selector, parent = document) => parent.querySelectorAll(selector),
    
    // Create element with attributes and properties
    create: (tag, attributes = {}, content = '') => {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([prop, val]) => {
                    element.style[prop] = val;
                });
            } else if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Set content
        if (content) {
            element.textContent = content;
        }
        
        return element;
    }
};

// Export DOM for use in other modules
if (typeof module !== 'undefined') {
    module.exports = DOM;
} 