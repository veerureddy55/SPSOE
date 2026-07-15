const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, adminMiddleware, examController.createExam);
router.get('/', authMiddleware, examController.listExams);
router.get('/:id', authMiddleware, examController.getExamDetails);
router.post('/verify-identity', authMiddleware, examController.verifyIdentity);
router.post('/save-answers', authMiddleware, examController.saveAnswers);
router.post('/submit', authMiddleware, examController.submitExam);

module.exports = router;
