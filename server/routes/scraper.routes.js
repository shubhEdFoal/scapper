const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/scraper.controller");

router.post("/scrape", ctrl.triggerScrape);
router.get("/status", ctrl.getAllStatuses);
router.get("/status/:requestId", ctrl.getStatusByRequestId);
router.get("/results", ctrl.getAllResults);
router.get("/results/:id", ctrl.getResultById);
router.delete("/results", ctrl.clearResults);

module.exports = router;
