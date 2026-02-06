/**
 * Simple handler that counts words in text.
 */
module.exports = async (input) => {
  const words = input.text.trim().split(/\s+/).filter(w => w.length > 0);
  return { count: words.length };
};
