require("dotenv").config();
const app = require("../server/app");
const { initDB } = require("../db/queries");

let ready = false;

module.exports = async (req, res) => {
  if (!ready) {
    await initDB();
    ready = true;
  }
  return app(req, res);
};
