require("dotenv").config();
const app = require("./server/app");
const config = require("./config");
const chalk = require("chalk");
const { initDB } = require("./db/queries");

async function main() {
  if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) {
    throw new Error(
      "Turso credentials missing. Copy .env.example to .env and add TURSO_DATABASE_URL + TURSO_AUTH_TOKEN"
    );
  }

  await initDB();

  app.listen(config.PORT, () => {
    console.log(chalk.green(`
╔═══════════════════════════════════════════════╗
║   🗺️  Google Maps Scraper API v1.0.0          ║
║   🗄️  Database: Turso (LibSQL)                ║
╚═══════════════════════════════════════════════╝
    `));
    console.log(chalk.cyan(`🚀 Server:   http://localhost:${config.PORT}`));
    console.log(chalk.yellow(`📋 API Docs: http://localhost:${config.PORT}/`));
    console.log(chalk.white(`\nEndpoints:`));
    console.log(`  POST   /api/scrape`);
    console.log(`  GET    /api/status`);
    console.log(`  GET    /api/status/:requestId`);
    console.log(`  GET    /api/results`);
    console.log(`  GET    /api/results/:id`);
    console.log(`  DELETE /api/results`);
  });
}

main().catch((err) => {
  console.error(chalk.red("❌ Startup failed:"), err.message);
  process.exit(1);
});
