const chalk = require("chalk");

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(ms);
}

function cleanEmails(emails) {
  const IGNORE = ["@example", "@domain", "@sentry", "@png", "@jpg", "@svg", "@your", "wpcf7"];
  return [...new Set(emails)].filter(
    (e) => e && !IGNORE.some((bad) => e.toLowerCase().includes(bad))
  );
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function log(type, message) {
  const map = {
    info: chalk.blue("ℹ️  " + message),
    success: chalk.green("✅ " + message),
    error: chalk.red("❌ " + message),
    warn: chalk.yellow("⚠️  " + message),
  };
  console.log(map[type] || message);
}

function buildSearchQuery({ businessType, state, country }) {
  return [businessType, state, country].filter(Boolean).join(" ").trim();
}

module.exports = { delay, randomDelay, cleanEmails, isValidUrl, log, buildSearchQuery };
