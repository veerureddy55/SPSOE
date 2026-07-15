const mongoose = require('mongoose');
const MonitoringLog = require('../models/MonitoringLog');
const Response = require('../models/Response');
const Exam = require('../models/Exam');
const User = require('../models/User');
const mockDb = require('../models/mockDb');

// Admin - Fetch all violations with optional filters
exports.getViolations = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { studentId, examId, type } = req.query;

    if (isMock) {
      const logs = mockDb.listLogs({ studentId, examId, violationType: type });
      const enrichedLogs = logs.map(log => {
        const student = mockDb.users.find(u => u._id === log.student);
        const exam = mockDb.exams.find(e => e._id === log.exam);
        return {
          ...log,
          student: student ? { name: student.name, email: student.email } : null,
          exam: exam ? { title: exam.title } : null
        };
      });
      return res.json({ logs: enrichedLogs });
    }

    const filter = {};
    if (studentId) filter.student = studentId;
    if (examId) filter.exam = examId;
    if (type) filter.violationType = type;

    const logs = await MonitoringLog.find(filter)
      .populate('student', 'name email')
      .populate('exam', 'title')
      .sort({ timestamp: -1 });

    return res.json({ logs });
  } catch (error) {
    console.error('Get violations error:', error);
    return res.status(500).json({ message: 'Failed to retrieve violation logs' });
  }
};

// Admin - Fetch student response summary for a specific exam
exports.getExamIntegrityReports = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { examId } = req.params;
    if (!examId) {
      return res.status(400).json({ message: 'Exam ID is required' });
    }

    if (isMock) {
      const reports = mockDb.listResponsesByExam(examId);
      const enrichedReports = reports.map(report => {
        const student = mockDb.users.find(u => u._id === report.student);
        const logs = mockDb.listLogs({ studentId: report.student, examId });
        
        const violationCounts = {
          MULTIPLE_FACES: 0,
          FACE_MISSING: 0,
          EYE_LOOKING_AWAY: 0,
          UNUSUAL_HEAD_POSE: 0,
          PROHIBITED_OBJECT: 0,
          TAB_SWITCH: 0
        };

        logs.forEach(log => {
          if (violationCounts[log.violationType] !== undefined) {
            violationCounts[log.violationType]++;
          }
        });

        return {
          ...report,
          student: student ? { _id: student._id, name: student.name, email: student.email } : null,
          violationSummary: violationCounts,
          logs: logs
        };
      }).sort((a, b) => b.cheatingProbability - a.cheatingProbability);

      return res.json({ reports: enrichedReports });
    }

    const reports = await Response.find({ exam: examId })
      .populate('student', 'name email')
      .sort({ cheatingProbability: -1 });

    const enrichedReports = await Promise.all(reports.map(async (report) => {
      const logs = await MonitoringLog.find({ student: report.student._id, exam: examId }).select('violationType timestamp confidence');
      
      const violationCounts = {
        MULTIPLE_FACES: 0,
        FACE_MISSING: 0,
        EYE_LOOKING_AWAY: 0,
        UNUSUAL_HEAD_POSE: 0,
        PROHIBITED_OBJECT: 0,
        TAB_SWITCH: 0
      };

      logs.forEach(log => {
        if (violationCounts[log.violationType] !== undefined) {
          violationCounts[log.violationType]++;
        }
      });

      return {
        ...report.toObject(),
        violationSummary: violationCounts,
        logs: logs
      };
    }));

    return res.json({ reports: enrichedReports });
  } catch (error) {
    console.error('Get exam integrity reports error:', error);
    return res.status(500).json({ message: 'Failed to retrieve integrity reports' });
  }
};

// Admin - Get overview statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;

    if (isMock) {
      const totalStudents = mockDb.users.filter(u => u.role === 'student').length;
      const totalExams = mockDb.exams.length;
      const totalSubmissions = mockDb.responses.filter(r => r.submittedAt).length;
      const totalViolations = mockDb.logs.length;

      const greenIntegrity = mockDb.responses.filter(r => r.integrityStatus === 'green').length;
      const yellowIntegrity = mockDb.responses.filter(r => r.integrityStatus === 'yellow').length;
      const redIntegrity = mockDb.responses.filter(r => r.integrityStatus === 'red').length;

      const recentLogs = mockDb.logs.slice(-10).reverse().map(log => {
        const student = mockDb.users.find(u => u._id === log.student);
        const exam = mockDb.exams.find(e => e._id === log.exam);
        return {
          ...log,
          student: student ? { name: student.name } : null,
          exam: exam ? { title: exam.title } : null
        };
      });

      return res.json({
        stats: {
          totalStudents,
          totalExams,
          totalSubmissions,
          totalViolations,
          integrityStatus: {
            green: greenIntegrity,
            yellow: yellowIntegrity,
            red: redIntegrity
          }
        },
        recentViolations: recentLogs
      });
    }

    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalExams = await Exam.countDocuments({});
    const totalSubmissions = await Response.countDocuments({ submittedAt: { $exists: true } });
    const totalViolations = await MonitoringLog.countDocuments({});

    const greenIntegrity = await Response.countDocuments({ integrityStatus: 'green' });
    const yellowIntegrity = await Response.countDocuments({ integrityStatus: 'yellow' });
    const redIntegrity = await Response.countDocuments({ integrityStatus: 'red' });

    const recentViolations = await MonitoringLog.find({})
      .populate('student', 'name')
      .populate('exam', 'title')
      .sort({ timestamp: -1 })
      .limit(10);

    return res.json({
      stats: {
        totalStudents,
        totalExams,
        totalSubmissions,
        totalViolations,
        integrityStatus: {
          green: greenIntegrity,
          yellow: yellowIntegrity,
          red: redIntegrity
        }
      },
      recentViolations
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({ message: 'Failed to compile dashboard statistics' });
  }
};
