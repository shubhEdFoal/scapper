const config = require("../config");
const { launchBrowser } = require("./browser");
const { delay, randomDelay, log } = require("./utils");
const { extractEmailsFromWebsite } = require("./emailFinder");
const { getLinkedInSearchUrl } = require("./linkedinFinder");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrollFeed(page) {
  const scrollCount = process.env.VERCEL ? 2 : 5 + Math.floor(Math.random() * 3);
  const pauseMs = process.env.VERCEL ? 800 : 1500;
  for (let i = 0; i < scrollCount; i++) {
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
    await delay(pauseMs);
  }
}

async function collectListingUrls(page, limit) {
  const urls = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
    return links.map((a) => a.href);
  });

  const unique = [...new Set(urls)];
  return unique.slice(0, limit);
}

async function extractListingDetails(page) {
  return page.evaluate(() => {
    const nameEl = document.querySelector("h1");
    const name = nameEl ? nameEl.textContent.trim() : null;

    const addressBtn = document.querySelector('button[data-item-id="address"]');
    const address = addressBtn
      ? addressBtn.getAttribute("aria-label") || addressBtn.textContent.trim()
      : null;

    const phoneBtn = document.querySelector('button[data-item-id^="phone"]');
    const phone = phoneBtn
      ? phoneBtn.getAttribute("aria-label") || phoneBtn.textContent.trim()
      : null;

    const websiteEl = document.querySelector('a[data-item-id="authority"]');
    const website = websiteEl ? websiteEl.href : null;

    const ratingEl = document.querySelector('span[aria-label*="stars"]');
    const rating = ratingEl ? ratingEl.getAttribute("aria-label") : null;

    return { name, address, phone, website, rating };
  });
}

async function scrapeGoogleMaps(scrapeQuery, maxResults, metadata = {}) {
  const query = scrapeQuery || config.SEARCH_QUERY;
  const limit = maxResults || config.MAX_RESULTS;
  const results = [];

  log("info", `Starting scrape: "${query}" (max ${limit} results)`);

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 768 });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    log("info", `Opening Maps: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector('div[role="feed"]', { timeout: 30000 });

    const pageContent = await page.content();
    if (pageContent.includes("captcha") || pageContent.includes("unusual traffic")) {
      throw new Error("Google CAPTCHA detected — try again later or use HEADLESS=false");
    }

    log("info", "Scrolling results feed...");
    await scrollFeed(page);

    const listingUrls = await collectListingUrls(page, limit);
    log("info", `Found ${listingUrls.length} listing URLs`);

    for (let i = 0; i < listingUrls.length; i++) {
      const mapsUrl = listingUrls[i];
      log("info", `Processing ${i + 1}/${listingUrls.length}: ${mapsUrl}`);

      try {
        await page.goto(mapsUrl, { waitUntil: "networkidle2", timeout: 60000 });

        const details = await extractListingDetails(page);
        if (!details.name) {
          log("warn", "Skipping listing — no name found");
          continue;
        }

        let emails = [];
        if (details.website) {
          log("info", `Extracting emails from ${details.website}`);
          emails = await extractEmailsFromWebsite(details.website);
        }

        results.push({
          name: details.name,
          address: details.address,
          phone: details.phone,
          website: details.website,
          rating: details.rating,
          emails,
          linkedinSearch: getLinkedInSearchUrl(details.name),
          mapsUrl: page.url(),
          scrapedAt: new Date().toISOString(),
          businessType: metadata.businessType || null,
          state: metadata.state || null,
          country: metadata.country || null,
          emailTone: metadata.emailTone || null,
        });

        log("success", `Scraped: ${details.name}`);
      } catch (err) {
        log("warn", `Failed listing ${mapsUrl}: ${err.message}`);
      }

      if (i < listingUrls.length - 1) {
        await randomDelay(config.MIN_DELAY, config.MAX_DELAY);
      }
    }
  } finally {
    await browser.close();
  }

  log("success", `Scrape complete — ${results.length} businesses collected`);
  return results;
}

module.exports = { scrapeGoogleMaps };
