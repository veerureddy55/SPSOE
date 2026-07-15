const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const { JWT_SECRET } = require('../middleware/auth');
const mockDb = require('../models/mockDb');

exports.register = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { name, email, password, role, studentId, profileImage } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (isMock) {
      console.log(`[DEMO MODE] Processing registration for ${email}`);
      const existingUser = mockDb.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = mockDb.createUser({
        name,
        email,
        password: hashedPassword,
        role: role || 'student'
      });

      if (newUser.role === 'student') {
        if (!studentId || !profileImage) {
          // clean up user
          mockDb.users.pop();
          return res.status(400).json({ message: 'Student ID and Profile Image are required for student accounts' });
        }

        const existingStudent = mockDb.findStudentById(studentId);
        if (existingStudent) {
          mockDb.users.pop();
          return res.status(400).json({ message: 'Student ID already registered' });
        }

        mockDb.createStudent({
          user: newUser._id,
          studentId,
          profileImage, // base64 string
          faceEmbedding: Array.from({ length: 128 }, () => Math.random())
        });
      }

      const token = jwt.sign(
        { userId: newUser._id, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        },
        message: 'Registered successfully in Demo mode'
      });
    }

    // Normal MongoDB database flow
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'student'
    });

    await newUser.save();

    if (newUser.role === 'student') {
      if (!studentId || !profileImage) {
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'Student ID and Profile Image are required for student accounts' });
      }

      const existingStudent = await Student.findOne({ studentId });
      if (existingStudent) {
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'Student ID already registered' });
      }

      const faceEmbedding = Array.from({ length: 128 }, () => Math.random());

      const newStudent = new Student({
        user: newUser._id,
        studentId,
        profileImage,
        faceEmbedding
      });

      await newStudent.save();
    }

    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed due to a server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (isMock) {
      console.log(`[DEMO MODE] Processing login for ${email}`);
      const user = mockDb.findUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      let studentDetails = null;
      if (user.role === 'student') {
        studentDetails = mockDb.findStudentByUser(user._id);
      }

      const token = jwt.sign(
        { userId: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: studentDetails ? studentDetails.studentId : null,
          profileImage: studentDetails ? studentDetails.profileImage : null
        },
        message: 'Logged in successfully in Demo mode'
      });
    }

    // Normal MongoDB database flow
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let studentDetails = null;
    if (user.role === 'student') {
      studentDetails = await Student.findOne({ user: user._id });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: studentDetails ? studentDetails.studentId : null,
        profileImage: studentDetails ? studentDetails.profileImage : null
      },
      message: 'Logged in successfully'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed due to a server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const isMock = mongoose.connection.readyState !== 1;
    const user = req.user;
    
    if (isMock) {
      let studentDetails = null;
      if (user.role === 'student') {
        studentDetails = mockDb.findStudentByUser(user._id || user.id);
      }
      return res.json({
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: studentDetails ? studentDetails.studentId : null,
          profileImage: studentDetails ? studentDetails.profileImage : null
        }
      });
    }

    let studentDetails = null;
    if (user.role === 'student') {
      studentDetails = await Student.findOne({ user: user._id });
    }
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: studentDetails ? studentDetails.studentId : null,
        profileImage: studentDetails ? studentDetails.profileImage : null
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error retrieving profile' });
  }
};
