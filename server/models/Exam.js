const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['mcq', 'descriptive'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  options: {
    type: [String], // only for MCQ
    default: []
  },
  correctAnswer: {
    type: String, // MCQ option text or keywords for descriptive
    required: true
  }
});

const ExamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  questions: {
    type: [QuestionSchema],
    default: []
  },
  scheduledStart: {
    type: Date,
    required: true
  },
  scheduledEnd: {
    type: Date,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Exam', ExamSchema);
