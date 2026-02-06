// Load and summarize Launch containers in a VM sandbox.

const fs = require('fs');
const vm = require('vm');

function loadContainer(containerPath) {
  const code = fs.readFileSync(containerPath, 'utf8');
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window._satellite && context.window._satellite.container
    ? context.window._satellite.container
    : null;
}

function summarizeContainer(container) {
  const dataElements = container.dataElements || {};
  const extensions = container.extensions || {};
  const rules = Array.isArray(container.rules) ? container.rules : [];

  return {
    buildInfo: container.buildInfo || {},
    environment: container.environment || {},
    counts: {
      dataElements: Object.keys(dataElements).length,
      extensions: Object.keys(extensions).length,
      rules: rules.length
    },
    dataElements,
    extensions,
    rules
  };
}

module.exports = {
  loadContainer,
  summarizeContainer
};
