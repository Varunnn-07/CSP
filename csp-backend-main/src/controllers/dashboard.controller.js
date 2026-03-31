const dashboardService = require("../services/dashboard.service");

async function getDashboardFull(req, res, next) {
  try {
    const data = await dashboardService.getDashboardFullData(req.user.id);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardFull
};
