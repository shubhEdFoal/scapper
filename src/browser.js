const config = require("../config");

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ||
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = require("@sparticuz/chromium-min");
    const puppeteer = require("puppeteer-core");

    return puppeteer.launch({
      args: [...chromium.args, "--disable-dev-shm-usage"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: chromium.headless,
    });
  }

  const puppeteer = require("puppeteer");
  return puppeteer.launch({
    headless: config.HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

module.exports = { launchBrowser };
