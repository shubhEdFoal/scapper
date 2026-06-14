const express = require("express");
const cors = require("cors");
const config = require("../config");
const scraperRoutes = require("./routes/scraper.routes");
const { initDB } = require("../db/queries");

const app = express();

let dbInitPromise = null;

app.use(async (req, res, next) => {
  if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) {
    return res.status(500).json({
      success: false,
      message:
        "Turso credentials missing. Vercel → Settings → Environment Variables mein TURSO_DATABASE_URL aur TURSO_AUTH_TOKEN add karo.",
    });
  }

  if (!dbInitPromise) {
    dbInitPromise = initDB();
  }

  try {
    await dbInitPromise;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "🗺️ Google Maps Scraper API",
    version: "1.0.0",
    database: "Turso (LibSQL)",
    endpoints: {
      "POST   /api/scrape":
        "Scraping shuru karo — body: businessType, state, country, numberOfLeads, emailTone",
      "GET    /api/scrape/status": "Scraping progress dekho",
      "GET    /api/results": "Sab results (search, filter, paginate)",
      "GET    /api/results/:id": "Single result by ID",
      "DELETE /api/results": "Sab data clear karo",
    },
  });
});

app.use("/api", scraperRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route nahi mili" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message });
});

module.exports = app;
