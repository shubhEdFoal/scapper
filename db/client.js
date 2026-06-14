const { createClient } = require("@libsql/client");
const config = require("../config");

let _client = null;

function getClient() {
  if (!_client) {
    if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) {
      throw new Error(
        "Turso credentials missing. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env"
      );
    }
    _client = createClient({
      url: config.TURSO_DATABASE_URL,
      authToken: config.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

module.exports = new Proxy(
  {},
  {
    get(_, prop) {
      return getClient()[prop];
    },
  }
);
