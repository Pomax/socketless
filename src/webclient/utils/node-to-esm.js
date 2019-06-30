/**
 * Replace `module.exports` with `export defaults.
 */
module.exports = function nodeToESM(location, content) {

  if (location.endsWith(`upgrade-socket.js`)) {
    content = content
      .toString()
      .replace(`module.exports = `, `export default `);
  }

  return content;
};
