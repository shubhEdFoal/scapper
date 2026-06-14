const client = require("./client");

async function initDB() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      address         TEXT,
      phone           TEXT,
      website         TEXT,
      rating          TEXT,
      emails          TEXT,
      linkedin_search TEXT,
      maps_url        TEXT,
      business_type   TEXT,
      state           TEXT,
      country         TEXT,
      email_tone      TEXT,
      sent_id         TEXT,
      mail_status     TEXT,
      response        TEXT,
      replied_by_us   TEXT,
      scraped_at      TEXT NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    "ALTER TABLE businesses ADD COLUMN business_type TEXT",
    "ALTER TABLE businesses ADD COLUMN state TEXT",
    "ALTER TABLE businesses ADD COLUMN country TEXT",
    "ALTER TABLE businesses ADD COLUMN email_tone TEXT",
    "ALTER TABLE businesses ADD COLUMN sent_id TEXT",
    "ALTER TABLE businesses ADD COLUMN mail_status TEXT",
    "ALTER TABLE businesses ADD COLUMN response TEXT",
    "ALTER TABLE businesses ADD COLUMN replied_by_us TEXT",
  ];

  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch {
      // column already exists
    }
  }

  console.log("✅ Turso DB initialized — table ready");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

const DEFAULT_SCRAPE_STATUS = {
  isRunning: false,
  startedAt: null,
  businessType: null,
  state: null,
  country: null,
  numberOfLeads: null,
  emailTone: null,
  query: null,
  inserted: 0,
  error: null,
};

async function getScrapeStatus() {
  const result = await client.execute({
    sql: "SELECT value FROM app_state WHERE key = 'scraping_status'",
    args: [],
  });
  if (result.rows.length === 0) return { ...DEFAULT_SCRAPE_STATUS };
  return { ...DEFAULT_SCRAPE_STATUS, ...JSON.parse(result.rows[0].value) };
}

async function setScrapeStatus(status) {
  await client.execute({
    sql: `INSERT INTO app_state (key, value) VALUES ('scraping_status', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [JSON.stringify(status)],
  });
}

async function insertBusiness(record) {
  const result = await client.execute({
    sql: `
      INSERT INTO businesses
        (name, address, phone, website, rating, emails, linkedin_search, maps_url,
         business_type, state, country, email_tone, sent_id, mail_status, response,
         replied_by_us, scraped_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      record.name,
      record.address || null,
      record.phone || null,
      record.website || null,
      record.rating || null,
      JSON.stringify(record.emails || []),
      record.linkedinSearch || null,
      record.mapsUrl || null,
      record.businessType || null,
      record.state || null,
      record.country || null,
      record.emailTone || null,
      null,
      null,
      null,
      null,
      record.scrapedAt || new Date().toISOString(),
    ],
  });
  return result.lastInsertRowid;
}

async function insertMany(records) {
  const inserted = [];
  for (const record of records) {
    const existing = await client.execute({
      sql: "SELECT id FROM businesses WHERE name = ? LIMIT 1",
      args: [record.name],
    });
    if (existing.rows.length === 0) {
      const id = await insertBusiness(record);
      inserted.push({ ...record, id });
    }
  }
  return inserted;
}

async function getAllBusinesses({ search, hasEmail, hasWebsite, page = 1, limit = 10 } = {}) {
  const whereClauses = [];
  const args = [];

  if (search) {
    whereClauses.push("(name LIKE ? OR address LIKE ? OR emails LIKE ?)");
    const term = `%${search}%`;
    args.push(term, term, term);
  }
  if (hasEmail === "true") {
    whereClauses.push("emails != '[]' AND emails IS NOT NULL");
  }
  if (hasWebsite === "true") {
    whereClauses.push("website IS NOT NULL");
  }

  const where = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
  const offset = (page - 1) * limit;

  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as count FROM businesses ${where}`,
    args,
  });
  const total = Number(countResult.rows[0].count);

  const dataResult = await client.execute({
    sql: `SELECT * FROM businesses ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const data = dataResult.rows.map(rowToRecord);
  return { total, page: Number(page), limit: Number(limit), data };
}

async function getBusinessById(id) {
  const result = await client.execute({
    sql: "SELECT * FROM businesses WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}

async function clearAllBusinesses() {
  await client.execute("DELETE FROM businesses");
}

function rowToRecord(row) {
  return {
    id: Number(row.id),
    name: row.name,
    address: row.address,
    phone: row.phone,
    website: row.website,
    rating: row.rating,
    emails: JSON.parse(row.emails || "[]"),
    linkedinSearch: row.linkedin_search,
    mapsUrl: row.maps_url,
    businessType: row.business_type,
    state: row.state,
    country: row.country,
    emailTone: row.email_tone,
    sentId: row.sent_id,
    mailStatus: row.mail_status,
    response: row.response,
    repliedByUs: row.replied_by_us,
    scrapedAt: row.scraped_at,
    createdAt: row.created_at,
  };
}

module.exports = {
  initDB,
  insertBusiness,
  insertMany,
  getAllBusinesses,
  getBusinessById,
  clearAllBusinesses,
  getScrapeStatus,
  setScrapeStatus,
};
