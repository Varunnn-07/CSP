const express = require("express");

const authMiddleware = require("../middleware/auth.middleware");
const { getDashboardFull } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/", authMiddleware, getDashboardFull);
router.get("/full", authMiddleware, getDashboardFull);

module.exports = router;
