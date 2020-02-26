// helper function to record function names for namespaces
module.exports = function register(API, type, name) {
  const [namespace, fname] = name.split(/[$:]/);
  if (!API[namespace]) API[namespace] = { client: [], server: [] };
  API[namespace][type].push(fname);
};
