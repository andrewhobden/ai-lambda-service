/**
 * Template engine for evaluating {{...}} expressions in chain handler configurations.
 * Supports nested path access and various context references.
 */

/**
 * Evaluates a single template expression against a context object.
 * Supports:
 * - {{input.fieldName}} - Access input data
 * - {{stepName.fieldName}} - Access named step outputs
 * - {{steps[0].fieldName}} - Access step outputs by index
 * - {{previousStep.fieldName}} - Access immediate previous step
 * - {{stepName}} - Access entire step output
 * - {{input}} - Access entire input
 *
 * @param {string} templateString - The template expression (with or without {{...}})
 * @param {object} context - Context object containing input, steps, stepsByName, previousStep
 * @returns {any} - The evaluated value
 * @throws {Error} - If the path cannot be resolved
 */
function evaluateTemplate(templateString, context) {
  // Remove {{ and }} if present
  let path = templateString.trim();
  if (path.startsWith('{{') && path.endsWith('}}')) {
    path = path.slice(2, -2).trim();
  }

  // Split path into segments (handle both dot notation and array indices)
  const segments = path.split('.').flatMap(segment => {
    // Handle array indices like steps[0]
    const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      return [arrayMatch[1], parseInt(arrayMatch[2], 10)];
    }
    return segment;
  });

  // Special handling: if first segment is not a reserved key (input, steps, stepsByName, previousStep)
  // but exists in stepsByName, redirect to stepsByName[segment]
  const reservedKeys = ['input', 'steps', 'stepsByName', 'previousStep'];
  if (segments.length > 0 && !reservedKeys.includes(segments[0])) {
    if (context.stepsByName && segments[0] in context.stepsByName) {
      // Rewrite path to use stepsByName
      segments.unshift('stepsByName');
    }
  }

  // Traverse the context
  let current = context;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (current === null || current === undefined) {
      throw new Error(
        `Cannot resolve template path "${path}": ` +
        `"${segments.slice(0, i).join('.')}" is ${current === null ? 'null' : 'undefined'}`
      );
    }

    if (typeof current !== 'object') {
      throw new Error(
        `Cannot resolve template path "${path}": ` +
        `"${segments.slice(0, i).join('.')}" is not an object (got ${typeof current})`
      );
    }

    if (!(segment in current)) {
      throw new Error(
        `Cannot resolve template path "${path}": ` +
        `property "${segment}" does not exist in "${segments.slice(0, i).join('.') || 'context'}". ` +
        `Available properties: ${Object.keys(current).join(', ')}`
      );
    }

    current = current[segment];
  }

  return current;
}

/**
 * Recursively processes an object/array and replaces all template strings with their evaluated values.
 *
 * @param {any} obj - The object, array, or primitive to process
 * @param {object} context - Context object for template evaluation
 * @returns {any} - New object/array/primitive with templates replaced
 * @throws {Error} - If any template cannot be resolved
 */
function compileTemplate(obj, context) {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings (check if they contain templates)
  if (typeof obj === 'string') {
    // Check if the entire string is a single template expression
    const fullTemplateMatch = obj.match(/^\{\{(.+)\}\}$/);
    if (fullTemplateMatch) {
      // Return the evaluated value directly (preserves type)
      return evaluateTemplate(obj, context);
    }

    // Check if string contains embedded templates (not supported in MVP)
    if (obj.includes('{{')) {
      throw new Error(
        `Embedded templates are not supported. ` +
        `Use a single template expression like "{{path}}", not "${obj}"`
      );
    }

    // Regular string, return as-is
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => compileTemplate(item, context));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const compiled = {};
    for (const [key, value] of Object.entries(obj)) {
      compiled[key] = compileTemplate(value, context);
    }
    return compiled;
  }

  // Handle primitives (numbers, booleans, etc.)
  return obj;
}

module.exports = {
  evaluateTemplate,
  compileTemplate
};
