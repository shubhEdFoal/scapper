const { randomUUID } = require("crypto");
const { scrapeGoogleMaps } = require("../../src/scraper");
const {
  insertMany,
  getAllBusinesses,
  getBusinessById,
  clearAllBusinesses,
  createScrapeRequest,
  updateScrapeRequest,
  getAllScrapeRequests,
  getScrapeRequestById,
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
  const { businessType, state, country, numberOfLeads, emailTone, query, requestID } = params;
  const metadata = { businessType, state, country, emailTone, requestID };

  try {
    const results = await scrapeGoogleMaps(query, numberOfLeads, metadata);
    const recordsWithRequest = results.map((r) => ({ ...r, requestID }));
    const inserted = await insertMany(recordsWithRequest);
    await updateScrapeRequest(requestID, {
      status: "completed",
      inserted: inserted.length,
      error: null,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    await updateScrapeRequest(requestID, {
      status: "failed",
      error: err.message,
      completedAt: new Date().toISOString(),
    });
  }
}

async function triggerScrape(req, res) {
  const params = parseScrapeBody(req.body);
  if (!params) {
    return res.status(400).json({
      success: false,
      message:
        "Required: businessType, state, country, numberOfLeads (or legacy: query + maxResults)",
    });
  }

  const { businessType, state, country, numberOfLeads, emailTone, query } = params;
  const requestID = randomUUID();
  const startedAt = new Date().toISOString();

  await createScrapeRequest({
    requestID,
    businessType,
    state,
    country,
    numberOfLeads,
    emailTone,
    query,
    startedAt,
  });

  const scrapePromise = runScrapeJob({ ...params, requestID });

  if (config.IS_VERCEL) {
    const { waitUntil } = require("@vercel/functions");
    waitUntil(scrapePromise);
  } else {
    scrapePromise.catch((err) => console.error("Scrape job failed:", err.message));
  }

  res.json({
    success: true,
    requestID,
    message: config.IS_VERCEL
      ? "Scraping start ho gayi! Vercel pe max 3-5 leads recommend hai (timeout limit)."
      : "Scraping background mein start ho gayi!",
    businessType,
    state,
    country,
    numberOfLeads,
    emailTone,
    query,
    statusUrl: `/api/status/${requestID}`,
  });
}

async function getAllStatuses(req, res) {
  const { status } = req.query;
  const requests = await getAllScrapeRequests({ status });
  const running = requests.filter((r) => r.isRunning).length;

  res.json({
    success: true,
    total: requests.length,
    running,
    requests,
  });
}

async function getStatusByRequestId(req, res) {
  const request = await getScrapeRequestById(req.params.requestId);
  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Request nahi mili",
      requestID: req.params.requestId,
    });
  }

  res.json({
    success: true,
    request,
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

module.exports = {
  triggerScrape,
  getAllStatuses,
  getStatusByRequestId,
  getAllResults,
  getResultById,
  clearResults,
};
