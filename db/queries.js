const { getClient } = require("./client");

async function initDB() {
  await getClient().execute(`
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
    "ALTER TABLE businesses ADD COLUMN request_id TEXT",
  ];

  for (const sql of migrations) {
    try {
      await getClient().execute(sql);
    } catch {
      // column already exists
    }
  }

  console.log("✅ Turso DB initialized — table ready");

  await getClient().execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await getClient().execute(`
    CREATE TABLE IF NOT EXISTS scrape_requests (
      id              TEXT PRIMARY KEY,
      business_type   TEXT,
      state           TEXT,
      country         TEXT,
      number_of_leads INTEGER,
      email_tone      TEXT,
      query           TEXT,
      status          TEXT NOT NULL DEFAULT 'running',
      inserted        INTEGER DEFAULT 0,
      error           TEXT,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);
}

async function createScrapeRequest(request) {
  await getClient().execute({
    sql: `
      INSERT INTO scrape_requests
        (id, business_type, state, country, number_of_leads, email_tone, query, status, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)
    `,
    args: [
      request.requestID,
      request.businessType || null,
      request.state || null,
      request.country || null,
      request.numberOfLeads || null,
      request.emailTone || null,
      request.query || null,
      request.startedAt,
    ],
  });
}

async function updateScrapeRequest(requestID, updates) {
  const fields = [];
  const args = [];

  if (updates.status !== undefined) {
    fields.push("status = ?");
    args.push(updates.status);
  }
  if (updates.inserted !== undefined) {
    fields.push("inserted = ?");
    args.push(updates.inserted);
  }
  if (updates.error !== undefined) {
    fields.push("error = ?");
    args.push(updates.error);
  }
  if (updates.completedAt !== undefined) {
    fields.push("completed_at = ?");
    args.push(updates.completedAt);
  }

  if (fields.length === 0) return;

  await getClient().execute({
    sql: `UPDATE scrape_requests SET ${fields.join(", ")} WHERE id = ?`,
    args: [...args, requestID],
  });
}

function requestRowToRecord(row) {
  return {
    requestID: row.id,
    status: row.status,
    isRunning: row.status === "running",
    businessType: row.business_type,
    state: row.state,
    country: row.country,
    numberOfLeads: row.number_of_leads,
    emailTone: row.email_tone,
    query: row.query,
    inserted: row.inserted,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

async function getAllScrapeRequests({ status } = {}) {
  const args = [];
  let sql = "SELECT * FROM scrape_requests";

  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }

  sql += " ORDER BY started_at DESC";

  const result = await getClient().execute({ sql, args });
  return result.rows.map(requestRowToRecord);
}

async function getScrapeRequestById(requestID) {
  const result = await getClient().execute({
    sql: "SELECT * FROM scrape_requests WHERE id = ?",
    args: [requestID],
  });
  if (result.rows.length === 0) return null;
  return requestRowToRecord(result.rows[0]);
}

async function insertBusiness(record) {
  const result = await getClient().execute({
    sql: `
      INSERT INTO businesses
        (name, address, phone, website, rating, emails, linkedin_search, maps_url,
         business_type, state, country, email_tone, sent_id, mail_status, response,
         replied_by_us, scraped_at, request_id)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      record.requestID || null,
    ],
  });
  return result.lastInsertRowid;
}

async function insertMany(records) {
  const inserted = [];
  for (const record of records) {
    const existing = await getClient().execute({
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

  const countResult = await getClient().execute({
    sql: `SELECT COUNT(*) as count FROM businesses ${where}`,
    args,
  });
  const total = Number(countResult.rows[0].count);

  const dataResult = await getClient().execute({
    sql: `SELECT * FROM businesses ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const data = dataResult.rows.map(rowToRecord);
  return { total, page: Number(page), limit: Number(limit), data };
}

async function getBusinessById(id) {
  const result = await getClient().execute({
    sql: "SELECT * FROM businesses WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}

async function clearAllBusinesses() {
  await getClient().execute("DELETE FROM businesses");
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
    requestID: row.request_id,
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
  createScrapeRequest,
  updateScrapeRequest,
  getAllScrapeRequests,
  getScrapeRequestById,
};
