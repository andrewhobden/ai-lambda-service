/**
 * Simple handler that converts text to uppercase.
 */
module.exports = async (input) => {
  return { result: input.text.toUpperCase() };
};
