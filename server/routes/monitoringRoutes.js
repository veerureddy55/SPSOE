const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/violations', authMiddleware, adminMiddleware, monitoringController.getViolations);
router.get('/reports/:examId', authMiddleware, adminMiddleware, monitoringController.getExamIntegrityReports);
router.get('/stats', authMiddleware, adminMiddleware, monitoringController.getDashboardStats);

module.exports = router;
