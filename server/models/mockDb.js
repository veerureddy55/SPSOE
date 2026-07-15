// In-memory mock database store for running the application in Demo/Fallback Mode
const bcrypt = require('bcryptjs');

const users = [];
const students = [];
const exams = [];
const responses = [];
const logs = [];

// Pre-populate with some mock exams so the system is immediately usable
const sampleExam = {
  _id: 'mock_exam_1',
  title: 'Artificial Intelligence & Ethics (Demo Exam)',
  description: 'This is a sample exam to test Aegis Proctoring system. Keep your face aligned to the camera.',
  duration: 15,
  questions: [
    {
      questionId: 'q1',
      type: 'mcq',
      text: 'Which of the following is considered a subset of Artificial Intelligence?',
      options: ['Machine Learning', 'Cloud Computing', 'Web Development', 'Hardware Engineering'],
      correctAnswer: 'Machine Learning'
    },
    {
      questionId: 'q2',
      type: 'mcq',
      text: 'What is the primary purpose of facial liveness detection in remote exams?',
      options: [
        'To prevent spoofing attacks using flat photos or videos',
        'To measure candidate heart rate',
        'To improve video loading latency',
        'To count number of screen switches'
      ],
      correctAnswer: 'To prevent spoofing attacks using flat photos or videos'
    },
    {
      questionId: 'q3',
      type: 'descriptive',
      text: 'Explain briefly the concept of computer vision and how it can be applied to remote exam monitoring.',
      options: [],
      correctAnswer: 'camera, tracking, detection, vision, movement'
    }
  ],
  scheduledStart: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  scheduledEnd: new Date(Date.now() + 86400000).toISOString(),   // tomorrow
  active: true,
  createdAt: new Date()
};

exams.push(sampleExam);

module.exports = {
  users,
  students,
  exams,
  responses,
  logs,
  
  // Helpers
  generateId: () => Math.random().toString(36).substring(2, 9),
  
  // Users
  findUserByEmail: (email) => users.find(u => u.email === email.toLowerCase().trim()),
  findUserById: (id) => users.find(u => u._id === id),
  createUser: (data) => {
    const newUser = {
      _id: `mock_user_${module.exports.generateId()}`,
      ...data,
      email: data.email.toLowerCase().trim(),
      createdAt: new Date()
    };
    users.push(newUser);
    return newUser;
  },

  // Students
  findStudentByUser: (userId) => students.find(s => s.user === userId),
  findStudentById: (studentId) => students.find(s => s.studentId === studentId),
  createStudent: (data) => {
    const newStudent = {
      _id: `mock_student_${module.exports.generateId()}`,
      ...data,
      createdAt: new Date()
    };
    students.push(newStudent);
    return newStudent;
  },

  // Exams
  listExams: () => exams,
  findExamById: (id) => exams.find(e => e._id === id),
  createExam: (data) => {
    const newExam = {
      _id: `mock_exam_${module.exports.generateId()}`,
      ...data,
      createdAt: new Date()
    };
    exams.push(newExam);
    return newExam;
  },

  // Responses
  findResponse: (studentId, examId) => responses.find(r => r.student === studentId && r.exam === examId),
  saveResponse: (data) => {
    const existingIdx = responses.findIndex(r => r.student === data.student && r.exam === data.exam);
    if (existingIdx !== -1) {
      responses[existingIdx] = { ...responses[existingIdx], ...data };
      return responses[existingIdx];
    } else {
      const newResponse = {
        _id: `mock_resp_${module.exports.generateId()}`,
        ...data,
        startedAt: data.startedAt || new Date()
      };
      responses.push(newResponse);
      return newResponse;
    }
  },
  listResponsesByExam: (examId) => responses.filter(r => r.exam === examId),

  // Monitoring Logs
  createLog: (data) => {
    const newLog = {
      _id: `mock_log_${module.exports.generateId()}`,
      ...data,
      timestamp: new Date()
    };
    logs.push(newLog);
    return newLog;
  },
  listLogs: (filters = {}) => {
    return logs.filter(log => {
      if (filters.studentId && log.student !== filters.studentId) return false;
      if (filters.examId && log.exam !== filters.examId) return false;
      if (filters.violationType && log.violationType !== filters.violationType) return false;
      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }
};
