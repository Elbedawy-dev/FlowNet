import sanitizeHtml from 'sanitize-html';

/**
 * Strips all HTML tags and attributes to prevent XSS
 * @param {string} text - Raw input string
 * @returns {string} Sanitized clean string
 */
export const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
};
