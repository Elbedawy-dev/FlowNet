/**
 * Strips HTML tags and script/style contents from input text (dependency-free)
 * @param {string} value - Raw input text
 * @returns {string} Clean plain text
 */
export const stripTags = (value = "") =>
  String(value)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();

/**
 * Strips all HTML tags to prevent stored XSS
 * @param {string} text - Raw input string
 * @returns {string} Sanitized clean string
 */
export const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return stripTags(text);
};

export default { stripTags, sanitizeText };
