const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  textAnswer: {
    type: String, // descriptive answers
    default: ''
  },
  mcqOption: {
    type: String, // MCQ answers
    default: ''
  }
});

const ResponseSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: {
    type: [AnswerSchema],
    default: []
  },
  score: {
    type: Number,
    default: 0
  },
  cheatingProbability: {
    type: Number,
    default: 0
  },
  integrityStatus: {
    type: String,
    enum: ['green', 'yellow', 'red'],
    default: 'green'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date
  }
});

// Avoid duplicate submissions by the same student for the same exam
ResponseSchema.index({ student: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model('Response', ResponseSchema);
