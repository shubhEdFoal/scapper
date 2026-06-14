function getLinkedInSearchUrl(businessName) {
  const q = encodeURIComponent(`${businessName} site:linkedin.com/company`);
  return `https://www.google.com/search?q=${q}`;
}

module.exports = { getLinkedInSearchUrl };
