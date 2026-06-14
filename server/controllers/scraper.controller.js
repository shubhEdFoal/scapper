const { scrapeGoogleMaps } = require("../../src/scraper");
const {
  insertMany,
  getAllBusinesses,
  getBusinessById,
  clearAllBusinesses,
  getScrapeStatus,
  setScrapeStatus,
} = require("../../db/queries");
const config = require("../../config");
const { buildSearchQuery } = require("../../src/utils");

function parseScrapeBody(body = {}) {
  const businessType = body.businessType || body.business_type;
  const state = body.state;
  const country = body.country || body.Country;
  const numberOfLeads = parseInt(body.numberOfLeads || body.number_of_leads || body.maxResults);
  const emailTone = body.emailTone || body.email_tone || "professional";

  if (businessType && state && country && numberOfLeads) {
    return {
      businessType,
      state,
      country,
      numberOfLeads,
      emailTone,
      query: buildSearchQuery({ businessType, state, country }),
    };
  }

  if (body.query) {
    return {
      businessType: businessType || null,
      state: state || null,
      country: country || null,
      numberOfLeads: numberOfLeads || config.MAX_RESULTS,
      emailTone,
      query: body.query,
    };
  }

  return null;
}

async function runScrapeJob(params) {
  const { businessType, state, country, numberOfLeads, emailTone, query } = params;
  const metadata = { businessType, state, country, emailTone };

  try {
    const results = await scrapeGoogleMaps(query, numberOfLeads, metadata);
    const inserted = await insertMany(results);
    const status = await getScrapeStatus();
    await setScrapeStatus({
      ...status,
      inserted: inserted.length,
      isRunning: false,
      error: null,
    });
  } catch (err) {
    const status = await getScrapeStatus();
    await setScrapeStatus({
      ...status,
      error: err.message,
      isRunning: false,
    });
  }
}

async function triggerScrape(req, res) {
  const scrapingStatus = await getScrapeStatus();

  if (scrapingStatus.isRunning) {
    return res.status(409).json({
      success: false,
      message: "Scraping already in progress. /api/scrape/status check karo.",
    });
  }

  const params = parseScrapeBody(req.body);
  if (!params) {
    return res.status(400).json({
      success: false,
      message:
        "Required: businessType, state, country, numberOfLeads (or legacy: query + maxResults)",
    });
  }

  const { businessType, state, country, numberOfLeads, emailTone, query } = params;

  const newStatus = {
    isRunning: true,
    startedAt: new Date().toISOString(),
    businessType,
    state,
    country,
    numberOfLeads,
    emailTone,
    query,
    inserted: 0,
    error: null,
  };
  await setScrapeStatus(newStatus);

  const scrapePromise = runScrapeJob(params);

  if (config.IS_VERCEL) {
    const { waitUntil } = require("@vercel/functions");
    waitUntil(scrapePromise);
  } else {
    scrapePromise.catch((err) => console.error("Scrape job failed:", err.message));
  }

  res.json({
    success: true,
    message: config.IS_VERCEL
      ? "Scraping start ho gayi! Vercel pe max 3-5 leads recommend hai (timeout limit)."
      : "Scraping background mein start ho gayi!",
    businessType,
    state,
    country,
    numberOfLeads,
    emailTone,
    query,
    statusUrl: "/api/scrape/status",
  });
}

async function getStatus(req, res) {
  const scrapingStatus = await getScrapeStatus();
  const { total } = await getAllBusinesses({ limit: 1 });
  res.json({
    success: true,
    status: scrapingStatus,
    totalRecordsInDB: total,
  });
}

async function getAllResults(req, res) {
  const { search, hasEmail, hasWebsite, page, limit } = req.query;
  const result = await getAllBusinesses({ search, hasEmail, hasWebsite, page, limit });
  res.json({ success: true, ...result });
}

async function getResultById(req, res) {
  const record = await getBusinessById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: "Record nahi mila" });
  }
  res.json({ success: true, data: record });
}

async function clearResults(req, res) {
  await clearAllBusinesses();
  res.json({ success: true, message: "Turso DB se sab records delete ho gaye" });
}

module.exports = { triggerScrape, getStatus, getAllResults, getResultById, clearResults };
