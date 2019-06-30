// A simple module for resolving file types to web content types

const CONTENT_TYPES = {
  ".html": `text/html`,
  ".js": `application/javascript`,
  ".jpg": `image/jpeg`,
  ".png": `image/png`
};

const DEFAULT_CONTENT_TYPE = `text/plain`;

module.exports = function getContentType(location) {
    let key = Object.keys(CONTENT_TYPES).find(key => (location.slice(-key.length) === key));
    let contentType = CONTENT_TYPES[key] || DEFAULT_CONTENT_TYPE;
    return contentType;
};
