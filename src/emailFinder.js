const axios = require("axios");
const cheerio = require("cheerio");
const { cleanEmails } = require("./utils");

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; research-bot)" };
const TIMEOUT = 8000;

async function fetchPage(url) {
  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: TIMEOUT,
    maxRedirects: 5,
    validateStatus: (status) => status < 400,
  });
  return response.data;
}

function extractFromHtml(html) {
  const emails = [];

  const regexMatches = html.match(EMAIL_REGEX) || [];
  emails.push(...regexMatches);

  const $ = cheerio.load(html);
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (email) emails.push(email);
  });

  return emails;
}

async function extractEmailsFromWebsite(websiteUrl) {
  if (!websiteUrl) return [];

  try {
    let url = websiteUrl;
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const allEmails = [];

    try {
      const homepageHtml = await fetchPage(url);
      allEmails.push(...extractFromHtml(homepageHtml));
    } catch {
      // homepage failed — try contact pages below
    }

    const baseUrl = new URL(url);
    const contactPaths = ["/contact", "/contact-us", "/contactus", "/about/contact"];

    for (const path of contactPaths) {
      try {
        const contactUrl = new URL(path, baseUrl.origin).href;
        const contactHtml = await fetchPage(contactUrl);
        allEmails.push(...extractFromHtml(contactHtml));
      } catch {
        // skip unavailable contact pages
      }
    }

    return cleanEmails(allEmails);
  } catch {
    return [];
  }
}

module.exports = { extractEmailsFromWebsite };
