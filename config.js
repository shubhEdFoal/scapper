require("dotenv").config();

module.exports = {
  // Turso
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,

  // Scraper
  SEARCH_QUERY: process.env.DEFAULT_SEARCH_QUERY || "digital marketing agency Delhi",
  MAX_RESULTS: parseInt(process.env.DEFAULT_MAX_RESULTS) || 10,
  HEADLESS: process.env.HEADLESS === "true",
  MIN_DELAY: 2000,
  MAX_DELAY: 4000,

  // Server
  PORT: parseInt(process.env.PORT) || 3000,
  IS_VERCEL: !!process.env.VERCEL,
};
