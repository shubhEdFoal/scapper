const express = require("express");
const cors = require("cors");
const scraperRoutes = require("./routes/scraper.routes");

const app = express();
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
      "GET    /api/status": "Sab scrape requests dekho (background + completed)",
      "GET    /api/status/:requestId": "Ek request ka status requestID se dekho",
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
