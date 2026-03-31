const { AsyncLocalStorage } = require('async_hooks');

const dbRequestContext = new AsyncLocalStorage();

function runWithDbClient(client, callback) {
  return dbRequestContext.run({ client }, callback);
}

function getRequestDbClient() {
  return dbRequestContext.getStore()?.client || null;
}

module.exports = {
  runWithDbClient,
  getRequestDbClient
};
