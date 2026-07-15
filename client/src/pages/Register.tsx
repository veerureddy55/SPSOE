import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, CreditCard, Camera, Upload, AlertCircle, Sparkles } from 'lucide-react';
import axios from 'axios';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Activate webcam to snap photo
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Webcam could not be accessed. Please upload an image instead.");
      setCameraActive(false);
    }
  };

  // Capture image snapshot from video
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setProfileImage(dataUrl);
        
        // Stop camera stream
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setCameraActive(false);
      }
    }
  };

  // Handle uploaded profile image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === 'student' && (!studentId || !profileImage)) {
      setError("Student ID and a Profile Photo are required for verification.");
      return;
    }

    setSubmitting(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const payload = {
        name,
        email,
        password,
        role,
        studentId: role === 'student' ? studentId : undefined,
        profileImage: role === 'student' ? profileImage : undefined
      };

      const response = await axios.post(`${API_URL}/api/auth/register`, payload);
      const { token, user } = response.data;
      
      login(token, user);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-6 flex items-center justify-center bg-slate-950 relative">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl glass-card p-8 rounded-2xl relative z-10 border border-slate-800">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Create Account <Sparkles className="w-6 h-6 text-blue-500" />
          </h2>
          <p className="text-slate-400 text-sm mt-1">Register to start taking secure proctored exams</p>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-lg bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Base Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Role Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-2 px-4 rounded-xl border text-sm font-bold transition ${
                      role === 'student'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 px-4 rounded-xl border text-sm font-bold transition ${
                      role === 'admin'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@university.edu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>
              </div>

              {role === 'student' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Student ID Number</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <CreditCard className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      required={role === 'student'}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="STU-10928"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Profile Photo Capture / Upload for Student */}
            {role === 'student' && (
              <div className="flex flex-col items-center justify-center p-6 border border-slate-800 rounded-2xl bg-slate-900/30">
                <label className="block text-sm font-semibold text-slate-300 mb-4 text-center">
                  Face Registration Image
                </label>

                {profileImage ? (
                  <div className="relative w-40 h-40 rounded-full border-2 border-blue-500 overflow-hidden mb-4 shadow-lg shadow-blue-500/10">
                    <img src={profileImage} alt="Face Snapshot" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProfileImage(null)}
                      className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition flex items-center justify-center text-xs font-semibold text-rose-400"
                    >
                      Remove Photo
                    </button>
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-slate-850 border border-slate-800 flex flex-col items-center justify-center text-center p-2 mb-4 text-slate-500">
                    {cameraActive ? (
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover rounded-full"
                        muted
                        playsInline
                      />
                    ) : (
                      <>
                        <User className="w-12 h-12 text-slate-700 mb-1" />
                        <span className="text-[10px]">No Registered Face</span>
                      </>
                    )}
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />

                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  {cameraActive ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Camera className="w-4 h-4" /> Capture Photo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Camera className="w-4 h-4 text-blue-400" /> Use Webcam
                    </button>
                  )}

                  <label className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer text-center">
                    <Upload className="w-4 h-4 text-blue-400" /> Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transform hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer text-sm"
          >
            {submitting ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold underline decoration-2 underline-offset-4">
            Sign In Here
          </Link>
        </p>
      </div>
    </div>
  );
};
