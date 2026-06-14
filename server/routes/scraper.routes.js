const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/scraper.controller");

router.post("/scrape", ctrl.triggerScrape);
router.get("/scrape/status", ctrl.getStatus);
router.get("/results", ctrl.getAllResults);
router.get("/results/:id", ctrl.getResultById);
router.delete("/results", ctrl.clearResults);

module.exports = router;
