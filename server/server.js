const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const authRoutes = require('./routes/authRoutes');
const examRoutes = require('./routes/examRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const MonitoringLog = require('./models/MonitoringLog');
const Response = require('./models/Response');
const mockDb = require('./models/mockDb');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10MB limit for base64 images
});

// Port and DB variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spsoe';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Proctoring System API is running' });
});

// Database Connection
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Ensure MongoDB is running locally or set MONGO_URI in .env');
    console.log('--- RUNNING IN MOCK DATABASE DEMO MODE ---');
  });

// Track active connections
const activeStudents = new Map(); // socketId -> { userId, examId, studentId, name }
const activeAdmins = new Set(); // socketIds of admin page
const connectedAIWorkers = new Set(); // socketIds of python AI services

io.on('connection', (socket) => {
  console.log(`New connection established: ${socket.id}`);

  // Register student session
  socket.on('register_student', ({ userId, examId, studentId, name }) => {
    socket.join(`exam_${examId}`);
    activeStudents.set(socket.id, { userId, examId, studentId, name });
    console.log(`Student ${name} (${studentId}) registered for exam ${examId} on socket ${socket.id}`);
    
    // Notify admins that a student joined
    io.to('admins').emit('student_joined', { socketId: socket.id, userId, examId, studentId, name });
  });

  // Register admin listener
  socket.on('register_admin', () => {
    socket.join('admins');
    activeAdmins.add(socket.id);
    console.log(`Admin registered on socket ${socket.id}`);
    
    // Send list of currently active students
    const studentsList = Array.from(activeStudents.entries()).map(([sid, data]) => ({
      socketId: sid,
      ...data
    }));
    socket.emit('active_students_list', studentsList);
  });

  // Register Python AI proctoring client
  socket.on('register_ai_worker', () => {
    connectedAIWorkers.add(socket.id);
    console.log(`Python AI Proctor Worker registered: ${socket.id}`);
  });

  // Handle incoming student frame (base64)
  socket.on('student_frame', async (data) => {
    const { frame, examId, userId, studentId, name } = data;
    const isMock = mongoose.connection.readyState !== 1;
    
    // Forward frame to connected AI workers if available
    if (connectedAIWorkers.size > 0) {
      for (const workerId of connectedAIWorkers) {
        io.to(workerId).emit('process_frame', {
          socketId: socket.id,
          frame,
          examId,
          userId,
          studentId,
          name
        });
      }
    } else {
      // FALLBACK MOCK PROCTORING (Node-side simulation to guarantee system works without Python)
      const rand = Math.random();
      if (rand < 0.015) {
        const violations = [
          { type: 'FACE_MISSING', conf: 0.92, desc: 'No active face detected in front of the camera.' },
          { type: 'MULTIPLE_FACES', conf: 0.88, desc: 'Multiple faces detected in exam environment.' },
          { type: 'EYE_LOOKING_AWAY', conf: 0.78, desc: 'Abnormal eye movements. Looking away from exam screen.' },
          { type: 'UNUSUAL_HEAD_POSE', conf: 0.82, desc: 'Unusual head rotation detected.' },
          { type: 'PROHIBITED_OBJECT', conf: 0.85, desc: 'Mobile phone or unauthorized book detected.' }
        ];
        
        const selectedViolation = violations[Math.floor(Math.random() * violations.length)];
        
        try {
          if (isMock) {
            const mockLog = mockDb.createLog({
              student: userId,
              exam: examId,
              violationType: selectedViolation.type,
              confidence: selectedViolation.conf,
              imageEvidence: frame,
              details: `[DEMO MODE] ${selectedViolation.desc}`
            });

            // Send warning back to student
            socket.emit('proctor_warning', {
              type: selectedViolation.type,
              message: selectedViolation.desc
            });

            // Notify admins
            io.to('admins').emit('admin_new_alert', {
              ...mockLog,
              studentName: name,
              studentId: studentId
            });
            return;
          }

          const log = new MonitoringLog({
            student: userId,
            exam: examId,
            violationType: selectedViolation.type,
            confidence: selectedViolation.conf,
            imageEvidence: frame,
            details: `[DEMO MODE] ${selectedViolation.desc}`
          });
          
          await log.save();
          const populatedLog = await log.populate('student', 'name email');

          // Send warning back to student
          socket.emit('proctor_warning', {
            type: selectedViolation.type,
            message: selectedViolation.desc
          });

          // Forward alert to admins in real-time
          io.to('admins').emit('admin_new_alert', {
            ...populatedLog.toObject(),
            studentName: name,
            studentId: studentId
          });
        } catch (err) {
          console.error('Error saving fallback log:', err);
        }
      }
    }
  });

  // Handle violation results processed by the AI worker
  socket.on('ai_violation_result', async (data) => {
    const { studentSocketId, userId, examId, studentId, name, violationType, confidence, imageEvidence, details } = data;
    const isMock = mongoose.connection.readyState !== 1;
    
    try {
      if (isMock) {
        const mockLog = mockDb.createLog({
          student: userId,
          exam: examId,
          violationType,
          confidence,
          imageEvidence,
          details
        });

        if (studentSocketId) {
          io.to(studentSocketId).emit('proctor_warning', {
            type: violationType,
            message: details
          });
        }

        io.to('admins').emit('admin_new_alert', {
          ...mockLog,
          studentName: name,
          studentId: studentId
        });
        return;
      }

      const log = new MonitoringLog({
        student: userId,
        exam: examId,
        violationType,
        confidence,
        imageEvidence,
        details
      });

      await log.save();
      const populatedLog = await log.populate('student', 'name email');

      // Warn student socket
      if (studentSocketId) {
        io.to(studentSocketId).emit('proctor_warning', {
          type: violationType,
          message: details
        });
      }

      // Notify admins
      io.to('admins').emit('admin_new_alert', {
        ...populatedLog.toObject(),
        studentName: name,
        studentId: studentId
      });
    } catch (err) {
      console.error('Error handling AI violation result:', err);
    }
  });

  // Handle Tab Switch (Browser Visibility change)
  socket.on('screen_violation', async (data) => {
    const { examId, userId, studentId, name, violationType, details } = data;
    const isMock = mongoose.connection.readyState !== 1;
    
    try {
      if (isMock) {
        const mockLog = mockDb.createLog({
          student: userId,
          exam: examId,
          violationType: violationType || 'TAB_SWITCH',
          confidence: 1.0,
          imageEvidence: '',
          details: details || 'Student switched application tabs or minimized the browser window.'
        });

        socket.emit('proctor_warning', {
          type: violationType || 'TAB_SWITCH',
          message: details || 'Tab switching is strictly prohibited during the exam!'
        });

        io.to('admins').emit('admin_new_alert', {
          ...mockLog,
          studentName: name,
          studentId: studentId
        });
        return;
      }

      const log = new MonitoringLog({
        student: userId,
        exam: examId,
        violationType: violationType || 'TAB_SWITCH',
        confidence: 1.0,
        imageEvidence: '',
        details: details || 'Student switched application tabs or minimized the browser window.'
      });

      await log.save();
      const populatedLog = await log.populate('student', 'name email');

      // Warn student
      socket.emit('proctor_warning', {
        type: violationType || 'TAB_SWITCH',
        message: details || 'Tab switching is strictly prohibited during the exam!'
      });

      // Notify admins
      io.to('admins').emit('admin_new_alert', {
        ...populatedLog.toObject(),
        studentName: name,
        studentId: studentId
      });
    } catch (err) {
      console.error('Error saving screen violation:', err);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (activeStudents.has(socket.id)) {
      const student = activeStudents.get(socket.id);
      console.log(`Student ${student.name} disconnected: ${socket.id}`);
      activeStudents.delete(socket.id);
      io.to('admins').emit('student_left', { socketId: socket.id, studentId: student.studentId });
    } else if (activeAdmins.has(socket.id)) {
      console.log(`Admin disconnected: ${socket.id}`);
      activeAdmins.delete(socket.id);
    } else if (connectedAIWorkers.has(socket.id)) {
      console.log(`AI Worker disconnected: ${socket.id}`);
      connectedAIWorkers.delete(socket.id);
    }
  });
});

// Start Server
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[FATAL ERROR] Port ${PORT} is already in use by another application or duplicate server instance.`);
    console.error(`Please close any existing Node processes running on this port, or define a different port in your environment: e.g., PORT=5001 npm start.\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`API Node Server listening on port ${PORT}`);
});

// Graceful Shutdown
const handleShutdown = () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
