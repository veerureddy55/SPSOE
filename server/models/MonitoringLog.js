const mongoose = require('mongoose');

const MonitoringLogSchema = new mongoose.Schema({
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
  violationType: {
    type: String,
    enum: [
      'MULTIPLE_FACES',
      'FACE_MISSING',
      'EYE_LOOKING_AWAY',
      'UNUSUAL_HEAD_POSE',
      'PROHIBITED_OBJECT',
      'TAB_SWITCH'
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  imageEvidence: {
    type: String, // base64 encoded snapshot or path to file
    default: ''
  },
  confidence: {
    type: Number,
    required: true
  },
  details: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('MonitoringLog', MonitoringLogSchema);
