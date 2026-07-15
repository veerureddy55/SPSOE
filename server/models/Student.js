const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  profileImage: {
    type: String, // base64 representation of profile image for registration face check
    required: true
  },
  faceEmbedding: {
    type: [Number], // 128 elements or other count of facial landmarks/descriptor values
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', StudentSchema);
