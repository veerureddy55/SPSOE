import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { Shield, Clock, AlertTriangle, Video, ArrowLeft, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface Question {
  questionId: string;
  type: 'mcq' | 'descriptive';
  text: string;
  options: string[];
}

interface Answer {
  questionId: string;
  textAnswer: string;
  mcqOption: string;
}

export const ExamPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [latestWarning, setLatestWarning] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const frameIntervalRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const autoSaveIntervalRef = useRef<any>(null);

  // Initialize Exam & Settings
  useEffect(() => {
    const loadExam = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await axios.get(`${API_URL}/api/exams/${examId}`);
        const examData = response.data.exam;
        setExam(examData);
        setQuestions(examData.questions);

        // Load pre-existing cached answers if they exist
        const cached = localStorage.getItem(`exam_cache_${examId}`);
        if (cached) {
          setAnswers(JSON.parse(cached));
        } else {
          // Initialize empty answers array
          const initialAnswers = examData.questions.map((q: Question) => ({
            questionId: q.questionId,
            textAnswer: '',
            mcqOption: ''
          }));
          setAnswers(initialAnswers);
        }

        // Set up Timer
        const durationSecs = examData.duration * 60;
        setTimeLeft(durationSecs);
        
        // Start camera stream
        await startProctoringCamera();
        
        // Connect Socket.io
        connectProctorSocket();
      } catch (err: any) {
        console.error("Exam loading error:", err);
        alert(err.response?.data?.message || 'Access blocked. Make sure you completed verification.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadExam();

    // Cleanup code
    return () => {
      clearInterval(timerRef.current);
      clearInterval(frameIntervalRef.current);
      clearInterval(autoSaveIntervalRef.current);
      stopProctoringCamera();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [examId]);

  // Handle countdown timer
  useEffect(() => {
    if (timeLeft > 0 && !loading) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            autoSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timeLeft, loading]);

  // Auto-save answers to DB and cache every 20 seconds
  useEffect(() => {
    if (answers.length > 0) {
      localStorage.setItem(`exam_cache_${examId}`, JSON.stringify(answers));
      
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = setInterval(() => {
        saveAnswersToBackend(true);
      }, 20000);
    }
    return () => clearInterval(autoSaveIntervalRef.current);
  }, [answers]);

  // Tab change / Window blur monitoring listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && socketRef.current && user) {
        // Tab hidden violation
        const payload = {
          examId,
          userId: user.id,
          studentId: user.studentId,
          name: user.name,
          violationType: 'TAB_SWITCH',
          details: 'Student switched away from the examination browser tab!'
        };
        socketRef.current.emit('screen_violation', payload);
      }
    };

    const handleWindowBlur = () => {
      if (socketRef.current && user) {
        // Window blur violation
        const payload = {
          examId,
          userId: user.id,
          studentId: user.studentId,
          name: user.name,
          violationType: 'TAB_SWITCH',
          details: 'Student switched application focus or minimized browser window!'
        };
        socketRef.current.emit('screen_violation', payload);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [examId, user]);

  const startProctoringCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Proctoring camera error:", err);
      alert("Proctoring webcam must remain active to proceed. Access denied.");
      navigate('/dashboard');
    }
  };

  const stopProctoringCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const connectProctorSocket = () => {
    if (!user) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    // Connect to websocket server
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("Exam proctoring websocket linked.");
      socket.emit('register_student', {
        userId: user.id,
        examId,
        studentId: user.studentId,
        name: user.name
      });
      
      // Start frame capture loop (every 2 seconds)
      startFrameCaptureLoop();
    });

    // Receive AI Proctoring Alert Warning
    socket.on('proctor_warning', (data: { type: string; message: string }) => {
      setWarnings(prev => [...prev, data.message]);
      setLatestWarning(data.message);
      setShowWarningModal(true);
      
      // Auto-close modal after 4 seconds
      setTimeout(() => {
        setShowWarningModal(false);
      }, 4000);
    });
  };

  const startFrameCaptureLoop = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    
    frameIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && socketRef.current && user) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          canvas.width = 160; // downscale frame size to reduce bandwidth and load on server
          canvas.height = 120;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frameBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% compression quality

          socketRef.current.emit('student_frame', {
            frame: frameBase64,
            examId,
            userId: user.id,
            studentId: user.studentId,
            name: user.name
          });
        }
      }
    }, 2000); // 2 seconds
  };

  const saveAnswersToBackend = async (autoSave = false) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/exams/save-answers`, {
        examId,
        answers,
        autoSave
      });
    } catch (e) {
      console.error("Failed to auto-save answers:", e);
    }
  };

  const updateAnswer = (questionId: string, value: string, type: 'mcq' | 'descriptive') => {
    setAnswers(prev => 
      prev.map(ans => {
        if (ans.questionId === questionId) {
          return {
            ...ans,
            mcqOption: type === 'mcq' ? value : ans.mcqOption,
            textAnswer: type === 'descriptive' ? value : ans.textAnswer
          };
        }
        return ans;
      })
    );
  };

  const handleManualSubmit = () => {
    if (window.confirm("Are you sure you want to finalize and submit your exam? You cannot modify your answers afterwards.")) {
      submitExamFinal();
    }
  };

  const autoSubmitExam = () => {
    console.log("Exam duration timeout. Auto-submitting answers.");
    submitExamFinal(true);
  };

  const submitExamFinal = async (isAuto = false) => {
    setSubmitting(true);
    // Cancel timers
    clearInterval(timerRef.current);
    clearInterval(frameIntervalRef.current);
    clearInterval(autoSaveIntervalRef.current);
    stopProctoringCamera();

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_URL}/api/exams/submit`, {
        examId,
        answers
      });

      // Clear local storage cache
      localStorage.removeItem(`exam_cache_${examId}`);
      
      const { score, integrityStatus } = response.data;
      
      // Redirect to results completion landing page
      navigate(`/dashboard`, { replace: true });
      alert(`Exam submitted successfully!${isAuto ? ' (Auto-submitted on timeout)' : ''}\nScore: ${score}/100\nIntegrity Standing: ${integrityStatus.toUpperCase()}`);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert(err.response?.data?.message || 'Error occurred during final submission. Saving cache...');
    } finally {
      setSubmitting(false);
    }
  };

  // Time conversion helper
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours > 0 ? hours + ':' : ''}${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Configuring secure proctored examination frame...
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.find(a => a.questionId === currentQuestion?.questionId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Upper Status Panel */}
      <header className="glass-panel px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-rose-500 animate-pulse" />
          <div>
            <h1 className="text-sm font-bold text-white leading-none">{exam?.title}</h1>
            <span className="text-[10px] text-rose-400 uppercase tracking-widest font-semibold block mt-1">
              Active AI Proctor Stream
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Warning Flag Indicator */}
          {warnings.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Warnings: {warnings.length}</span>
            </div>
          )}

          {/* Countdown Clock */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="font-mono text-sm font-bold">{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={handleManualSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:bg-emerald-800"
          >
            {submitting ? 'Submitting...' : 'Finish Exam'}
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        
        {/* Left Side: Exam Question navigation & Answering Panel (3 columns) */}
        <main className="lg:col-span-3 p-6 md:p-8 flex flex-col justify-between overflow-y-auto space-y-8">
          
          <div className="space-y-6">
            {/* Question Counter */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-slate-500 font-mono italic">
                Answers auto-save every 20s
              </span>
            </div>

            {/* Question Card */}
            {currentQuestion && (
              <div className="space-y-6">
                <h2 className="text-lg md:text-xl font-medium text-slate-200 leading-relaxed">
                  {currentQuestion.text}
                </h2>

                {/* Answers Inputs */}
                {currentQuestion.type === 'mcq' ? (
                  <div className="space-y-3 max-w-2xl">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => updateAnswer(currentQuestion.questionId, option, 'mcq')}
                        className={`w-full text-left p-4 rounded-xl border transition text-sm font-semibold flex items-center justify-between ${
                          currentAnswer?.mcqOption === option
                            ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                            : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <span>{option}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          currentAnswer?.mcqOption === option ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                        }`}>
                          {currentAnswer?.mcqOption === option && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="max-w-3xl space-y-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Answer</label>
                    <textarea
                      rows={8}
                      value={currentAnswer?.textAnswer || ''}
                      onChange={(e) => updateAnswer(currentQuestion.questionId, e.target.value, 'descriptive')}
                      placeholder="Write your explanation answer here..."
                      className="w-full p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm transition"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-900">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-transparent text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex gap-1.5 max-w-xs overflow-x-auto py-1">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                    currentIndex === idx 
                      ? 'bg-blue-600 text-white' 
                      : (answers[idx]?.mcqOption || answers[idx]?.textAnswer)
                      ? 'bg-slate-850 text-slate-300 border border-slate-800'
                      : 'bg-slate-950 text-slate-500 hover:bg-slate-900 border border-slate-900'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 border border-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-transparent text-xs font-semibold flex items-center gap-1.5 transition"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        {/* Right Side: Security Proctoring HUD Panel (1 column) */}
        <aside className="border-t lg:border-t-0 lg:border-l border-slate-900 p-6 bg-slate-900/20 flex flex-col justify-between items-center text-center gap-6">
          <div className="w-full space-y-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Webcam Monitoring Feed</span>
            
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover pointer-events-none scale-x-[-1]"
                muted
                playsInline
              />
              {isCameraActive ? (
                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500 text-[10px] font-bold text-white uppercase animate-pulse">
                  <Video className="w-3 h-3" /> Live
                </div>
              ) : (
                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700 text-[10px] font-bold text-white uppercase">
                  Offline
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Security System:</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Network Sync:</span>
                <span className="text-blue-400 font-semibold">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device Locked:</span>
                <span className="text-emerald-400 font-semibold">Yes</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-left w-full space-y-2">
            <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">Aegis AI Proctor Note</h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Aegis AI continually screens the webcam feed for faces, eye movements, and phone presence. Avoid looking away or switching screens.
            </p>
          </div>
        </aside>
      </div>

      {/* Real-time Warning Overlay Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-md bg-slate-900 border-2 border-rose-500/40 p-6 rounded-2xl flex flex-col items-center text-center gap-4 shadow-2xl shadow-rose-500/10">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center animate-bounce">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">AI Proctoring Warning</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {latestWarning}
              </p>
            </div>
            <div className="w-full bg-rose-500/5 p-2.5 rounded-lg border border-rose-500/10 text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-2">
              Violation logged in admin audit report
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
