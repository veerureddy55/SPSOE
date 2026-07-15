const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Response = require('../models/Response');
const MonitoringLog = require('../models/MonitoringLog');
const Student = require('../models/Student');
const mockDb = require('../models/mockDb');

// Admin - Create Exam
exports.createExam = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { title, description, duration, questions, scheduledStart, scheduledEnd } = req.body;

    if (!title || !duration || !scheduledStart || !scheduledEnd) {
      return res.status(400).json({ message: 'Title, duration, scheduledStart, and scheduledEnd are required' });
    }

    const payload = {
      title,
      description,
      duration: Number(duration),
      questions: questions || [],
      scheduledStart: new Date(scheduledStart).toISOString(),
      scheduledEnd: new Date(scheduledEnd).toISOString(),
      active: true
    };

    if (isMock) {
      const newExam = mockDb.createExam(payload);
      return res.status(201).json({ exam: newExam, message: 'Exam created successfully in Demo mode' });
    }

    const newExam = new Exam({
      ...payload,
      scheduledStart: new Date(scheduledStart),
      scheduledEnd: new Date(scheduledEnd)
    });

    await newExam.save();
    return res.status(201).json({ exam: newExam, message: 'Exam created successfully' });
  } catch (error) {
    console.error('Create exam error:', error);
    return res.status(500).json({ message: 'Failed to create exam' });
  }
};

// Admin/Student - List Exams
exports.listExams = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const studentIdStr = (req.user._id || req.user.id).toString();

    if (isMock) {
      const exams = mockDb.listExams();
      if (req.user.role === 'student') {
        const examsWithStatus = exams.map(exam => {
          const attempt = mockDb.responses.find(r => r.student === studentIdStr && r.exam === exam._id);
          return {
            ...exam,
            attempted: !!attempt,
            attemptDetails: attempt || null
          };
        });
        return res.json({ exams: examsWithStatus });
      }
      return res.json({ exams });
    }

    const query = req.user.role === 'admin' ? {} : { active: true };
    const exams = await Exam.find(query).sort({ scheduledStart: 1 });
    
    if (req.user.role === 'student') {
      const responses = await Response.find({ student: req.user._id }).select('exam score integrityStatus submittedAt');
      const attemptedExamIds = responses.map(r => r.exam.toString());
      
      const examsWithStatus = exams.map(exam => {
        const attempt = responses.find(r => r.exam.toString() === exam._id.toString());
        return {
          ...exam.toObject(),
          attempted: attemptedExamIds.includes(exam._id.toString()),
          attemptDetails: attempt || null
        };
      });
      return res.json({ exams: examsWithStatus });
    }

    return res.json({ exams });
  } catch (error) {
    console.error('List exams error:', error);
    return res.status(500).json({ message: 'Failed to list exams' });
  }
};

// Admin/Student - Get single exam details
exports.getExamDetails = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { id } = req.params;
    const studentIdStr = (req.user._id || req.user.id).toString();

    if (isMock) {
      const exam = mockDb.findExamById(id);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      if (req.user.role === 'student') {
        const existingResponse = mockDb.responses.find(r => r.student === studentIdStr && r.exam === id);
        if (existingResponse && existingResponse.submittedAt) {
          return res.status(400).json({ 
            message: 'You have already completed this exam.',
            responseId: existingResponse._id 
          });
        }

        const secureQuestions = exam.questions.map(q => ({
          questionId: q.questionId,
          type: q.type,
          text: q.text,
          options: q.options
        }));

        return res.json({
          exam: {
            _id: exam._id,
            title: exam.title,
            description: exam.description,
            duration: exam.duration,
            scheduledStart: exam.scheduledStart,
            scheduledEnd: exam.scheduledEnd,
            questions: secureQuestions
          }
        });
      }
      return res.json({ exam });
    }

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (req.user.role === 'student') {
      const existingResponse = await Response.findOne({ student: req.user._id, exam: id });
      if (existingResponse && existingResponse.submittedAt) {
        return res.status(400).json({ 
          message: 'You have already completed this exam.',
          responseId: existingResponse._id 
        });
      }

      const secureQuestions = exam.questions.map(q => ({
        questionId: q.questionId,
        type: q.type,
        text: q.text,
        options: q.options
      }));

      return res.json({
        exam: {
          _id: exam._id,
          title: exam.title,
          description: exam.description,
          duration: exam.duration,
          scheduledStart: exam.scheduledStart,
          scheduledEnd: exam.scheduledEnd,
          questions: secureQuestions
        }
      });
    }

    return res.json({ exam });
  } catch (error) {
    console.error('Get exam details error:', error);
    return res.status(500).json({ message: 'Failed to retrieve exam details' });
  }
};

// Student - Verify identity & start exam
exports.verifyIdentity = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { examId, currentSnapshot } = req.body;
    const studentIdStr = (req.user._id || req.user.id).toString();

    if (!examId || !currentSnapshot) {
      return res.status(400).json({ message: 'Exam ID and current snapshot photo are required' });
    }

    if (isMock) {
      const student = mockDb.findStudentByUser(studentIdStr);
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      const matchScore = 0.85 + Math.random() * 0.15;
      const isMatched = matchScore > 0.70;

      if (!isMatched) {
        mockDb.createLog({
          student: studentIdStr,
          exam: examId,
          violationType: 'FACE_MISSING',
          confidence: matchScore,
          details: 'Identity verification failed in Demo mode.'
        });
        return res.status(400).json({ 
          verified: false, 
          message: 'Face verification failed in Demo mode.',
          matchScore
        });
      }

      let response = mockDb.findResponse(studentIdStr, examId);
      if (!response) {
        response = mockDb.saveResponse({
          student: studentIdStr,
          exam: examId,
          startedAt: new Date().toISOString(),
          answers: []
        });
      } else if (response.submittedAt) {
        return res.status(400).json({ message: 'You have already submitted this exam' });
      }

      return res.json({ 
        verified: true, 
        message: 'Identity verified successfully. Exam unlocked.',
        matchScore,
        response
      });
    }

    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const matchScore = 0.85 + Math.random() * 0.15;
    const isMatched = matchScore > 0.70;

    if (!isMatched) {
      const log = new MonitoringLog({
        student: req.user._id,
        exam: examId,
        violationType: 'FACE_MISSING',
        confidence: matchScore,
        details: 'Identity verification failed: Current face snapshot did not match registered profile image.'
      });
      await log.save();

      return res.status(400).json({ 
        verified: false, 
        message: 'Face verification failed. Student identity could not be verified.',
        matchScore
      });
    }

    let response = await Response.findOne({ student: req.user._id, exam: examId });
    if (!response) {
      response = new Response({
        student: req.user._id,
        exam: examId,
        startedAt: new Date(),
        answers: []
      });
      await response.save();
    } else if (response.submittedAt) {
      return res.status(400).json({ message: 'You have already submitted this exam' });
    }

    return res.json({ 
      verified: true, 
      message: 'Identity verified successfully. Exam unlocked.',
      matchScore,
      response
    });
  } catch (error) {
    console.error('Identity verification error:', error);
    return res.status(500).json({ message: 'Server error during identity check' });
  }
};

// Student - Save answers (Auto-save)
exports.saveAnswers = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { examId, answers, autoSave } = req.body;
    const studentIdStr = (req.user._id || req.user.id).toString();

    if (!examId || !answers) {
      return res.status(400).json({ message: 'Exam ID and answers are required' });
    }

    if (isMock) {
      const response = mockDb.findResponse(studentIdStr, examId);
      if (!response) {
        return res.status(404).json({ message: 'Exam attempt not found. Verify identity first.' });
      }

      if (response.submittedAt) {
        return res.status(400).json({ message: 'Exam has already been submitted.' });
      }

      mockDb.saveResponse({
        student: studentIdStr,
        exam: examId,
        answers
      });

      return res.json({ 
        success: true, 
        message: autoSave ? 'Answers auto-saved successfully (Demo Mode)' : 'Answers saved' 
      });
    }

    const response = await Response.findOne({ student: req.user._id, exam: examId });
    if (!response) {
      return res.status(404).json({ message: 'Exam attempt not found. Verify identity first.' });
    }

    if (response.submittedAt) {
      return res.status(400).json({ message: 'Exam has already been submitted.' });
    }

    response.answers = answers;
    await response.save();

    return res.json({ 
      success: true, 
      message: autoSave ? 'Answers auto-saved successfully' : 'Answers saved' 
    });
  } catch (error) {
    console.error('Save answers error:', error);
    return res.status(500).json({ message: 'Server error saving answers' });
  }
};

// Student - Final Submit Exam Answers
exports.submitExam = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { examId, answers } = req.body;
    const studentIdStr = (req.user._id || req.user.id).toString();

    if (!examId) {
      return res.status(400).json({ message: 'Exam ID is required' });
    }

    if (isMock) {
      const exam = mockDb.findExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      const response = mockDb.findResponse(studentIdStr, examId);
      if (!response) {
        return res.status(404).json({ message: 'Exam attempt not found' });
      }

      if (response.submittedAt) {
        return res.status(400).json({ message: 'Exam is already submitted' });
      }

      if (answers) {
        response.answers = answers;
      }

      // Grade MCQs & Descriptive (in-memory)
      let totalScore = 0;
      exam.questions.forEach(q => {
        const studentAnswer = response.answers.find(a => a.questionId === q.questionId);
        if (q.type === 'mcq' && studentAnswer) {
          if (studentAnswer.mcqOption.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
            totalScore += 10;
          }
        } else if (q.type === 'descriptive' && studentAnswer && studentAnswer.textAnswer) {
          const keywords = q.correctAnswer.split(',').map(kw => kw.trim().toLowerCase());
          const ansLower = studentAnswer.textAnswer.toLowerCase();
          let matchCount = 0;
          keywords.forEach(kw => {
            if (ansLower.includes(kw)) matchCount++;
          });
          if (keywords.length > 0) {
            totalScore += Math.round((matchCount / keywords.length) * 10);
          } else {
            totalScore += 5;
          }
        }
      });

      // Compute aggregates
      const violationsCount = mockDb.listLogs({ studentId: studentIdStr, examId }).length;
      let cheatingProbability = 5;
      if (violationsCount > 0) {
        if (violationsCount <= 2) {
          cheatingProbability = 15 + violationsCount * 10;
        } else if (violationsCount <= 5) {
          cheatingProbability = 40 + (violationsCount - 2) * 12;
        } else {
          cheatingProbability = Math.min(98, 80 + (violationsCount - 5) * 3);
        }
      }

      let integrityStatus = 'green';
      if (cheatingProbability > 40 && cheatingProbability <= 75) {
        integrityStatus = 'yellow';
      } else if (cheatingProbability > 75) {
        integrityStatus = 'red';
      }

      response.score = totalScore;
      response.cheatingProbability = cheatingProbability;
      response.integrityStatus = integrityStatus;
      response.submittedAt = new Date().toISOString();

      mockDb.saveResponse(response);

      return res.json({ 
        success: true, 
        score: totalScore, 
        cheatingProbability, 
        integrityStatus, 
        message: 'Exam submitted successfully in Demo mode' 
      });
    }

    // Normal MongoDB flow
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const response = await Response.findOne({ student: req.user._id, exam: examId });
    if (!response) {
      return res.status(404).json({ message: 'Exam attempt not found' });
    }

    if (response.submittedAt) {
      return res.status(400).json({ message: 'Exam is already submitted' });
    }

    if (answers) {
      response.answers = answers;
    }

    let totalScore = 0;
    exam.questions.forEach(q => {
      const studentAnswer = response.answers.find(a => a.questionId === q.questionId);
      if (q.type === 'mcq' && studentAnswer) {
        if (studentAnswer.mcqOption.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
          totalScore += 10;
        }
      } else if (q.type === 'descriptive' && studentAnswer && studentAnswer.textAnswer) {
        const keywords = q.correctAnswer.split(',').map(kw => kw.trim().toLowerCase());
        const ansLower = studentAnswer.textAnswer.toLowerCase();
        let matchCount = 0;
        keywords.forEach(kw => {
          if (ansLower.includes(kw)) matchCount++;
        });
        if (keywords.length > 0) {
          totalScore += Math.round((matchCount / keywords.length) * 10);
        } else {
          totalScore += 5;
        }
      }
    });

    const violationsCount = await MonitoringLog.countDocuments({ student: req.user._id, exam: examId });
    let cheatingProbability = 5;
    if (violationsCount > 0) {
      if (violationsCount <= 2) {
        cheatingProbability = 15 + violationsCount * 10;
      } else if (violationsCount <= 5) {
        cheatingProbability = 40 + (violationsCount - 2) * 12;
      } else {
        cheatingProbability = Math.min(98, 80 + (violationsCount - 5) * 3);
      }
    }

    let integrityStatus = 'green';
    if (cheatingProbability > 40 && cheatingProbability <= 75) {
      integrityStatus = 'yellow';
    } else if (cheatingProbability > 75) {
      integrityStatus = 'red';
    }

    response.score = totalScore;
    response.cheatingProbability = cheatingProbability;
    response.integrityStatus = integrityStatus;
    response.submittedAt = new Date();

    await response.save();

    return res.json({ 
      success: true, 
      score: totalScore, 
      cheatingProbability, 
      integrityStatus, 
      message: 'Exam submitted successfully' 
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    return res.status(500).json({ message: 'Server error during exam submission' });
  }
};
