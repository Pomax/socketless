// state and update mechanisms
module.exports = function addStateManagement(instance) {
  instance.state = instance.state || {};

  instance.setState = function(newstate) {
    Object.keys(newstate).forEach(key => {
      instance.state[key] = newstate[key];
    });
  }.bind(instance);

  return instance;
};
