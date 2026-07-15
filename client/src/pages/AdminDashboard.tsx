import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Shield, Plus, Calendar, Clock, AlertTriangle, User, FileText, CheckCircle, Volume2, VolumeX, Bell, ListPlus } from 'lucide-react';
import axios from 'axios';

interface StudentSession {
  socketId: string;
  userId: string;
  examId: string;
  studentId: string;
  name: string;
}

interface AlertLog {
  _id?: string;
  studentName: string;
  studentId: string;
  violationType: string;
  confidence: number;
  imageEvidence?: string;
  details: string;
  timestamp: string;
}

interface Exam {
  _id: string;
  title: string;
  duration: number;
  questions: any[];
  scheduledStart: string;
  scheduledEnd: string;
}

export const AdminDashboard: React.FC = () => {

  const [activeTab, setActiveTab] = useState<'monitor' | 'exams' | 'newExam'>('monitor');
  const [activeStudents, setActiveStudents] = useState<StudentSession[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  
  // New Exam Form State
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [examStart, setExamStart] = useState('');
  const [examEnd, setExamEnd] = useState('');
  const [questions, setQuestions] = useState<any[]>([
    { questionId: 'q1', type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '' }
  ]);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Load initial data (exams) and start socket listener
  useEffect(() => {
    fetchExams();
    connectAdminSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchExams = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_URL}/api/exams`);
      setExams(response.data.exams);
    } catch (e) {
      console.error("Error fetching exams:", e);
    }
  };

  const connectAdminSocket = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("Admin Socket connection registered.");
      socket.emit('register_admin');
    });

    socket.on('active_students_list', (list: StudentSession[]) => {
      setActiveStudents(list);
    });

    socket.on('student_joined', (student: StudentSession) => {
      setActiveStudents(prev => {
        if (prev.some(s => s.socketId === student.socketId)) return prev;
        return [...prev, student];
      });
    });

    socket.on('student_left', (data: { socketId: string; studentId: string }) => {
      setActiveStudents(prev => prev.filter(s => s.socketId !== data.socketId));
    });

    socket.on('admin_new_alert', (newAlert: AlertLog) => {
      setAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50 alerts in dashboard view
      
      // Play system alert beep
      if (soundEnabled) {
        triggerBeep();
      }
    });
  };

  // Synthesize custom sound beep on alerts
  const triggerBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = 580; // High warning pitch
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (err) {
      console.error("Audio beep error:", err);
    }
  };

  // Exam Question Actions
  const handleAddQuestion = () => {
    const nextId = `q${questions.length + 1}`;
    setQuestions(prev => [
      ...prev,
      { questionId: nextId, type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '' }
    ]);
  };

  const handleUpdateQuestion = (index: number, field: string, value: any) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === index) {
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIdx) {
        const opts = [...q.options];
        opts[optIdx] = value;
        return { ...q, options: opts };
      }
      return q;
    }));
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle || !examStart || !examEnd) return;

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const payload = {
        title: examTitle,
        description: examDesc,
        duration: examDuration,
        scheduledStart: examStart,
        scheduledEnd: examEnd,
        questions
      };

      await axios.post(`${API_URL}/api/exams`, payload);
      alert('Exam created successfully.');
      
      // Reset form
      setExamTitle('');
      setExamDesc('');
      setExamDuration(60);
      setExamStart('');
      setExamEnd('');
      setQuestions([{ questionId: 'q1', type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '' }]);
      
      setActiveTab('exams');
      fetchExams();
    } catch (err) {
      console.error("Failed to save exam:", err);
      alert('Error creating exam. Check inputs.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-900">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-500" /> Admin Control Room
            </h1>
            <p className="text-slate-400 text-sm mt-1">Real-time examination monitoring & proctor analytics engine.</p>
          </div>

          {/* Toggle sounds & stats */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border transition flex items-center gap-2 text-xs font-bold ${
                soundEnabled 
                  ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {soundEnabled ? 'Alert Sounds ON' : 'Alert Sounds OFF'}
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-900">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition ${
              activeTab === 'monitor' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Real-time Proctor Monitor
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition ${
              activeTab === 'exams' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Exam Management
          </button>
          <button
            onClick={() => setActiveTab('newExam')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition ${
              activeTab === 'newExam' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            + Create Exam Template
          </button>
        </div>

        {/* Dynamic Workspace */}
        {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Monitor Side (Left 2 columns: Scrolling Alerts Stream) */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Live Violation Alerts Stream <Bell className="w-4 h-4 text-rose-500 animate-pulse" />
              </h2>

              {alerts.length === 0 ? (
                <div className="glass-card p-16 text-center rounded-2xl border border-slate-900 flex flex-col items-center justify-center text-slate-500">
                  <CheckCircle className="w-12 h-12 text-slate-700 mb-3" />
                  <span>No security alert signals registered. Clear examination standing.</span>
                </div>
              ) : (
                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className="glass-card p-5 rounded-xl border border-rose-500/20 bg-rose-500/[0.02] flex items-start gap-5">
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-rose-500" />
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-200">{alert.studentName} ({alert.studentId})</span>
                          <span className="text-[10px] text-slate-500 font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">
                            {alert.violationType}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px] font-mono">
                            Confidence: {(alert.confidence * 100).toFixed(0)}%
                          </span>
                        </div>

                        <p className="text-xs text-slate-400">{alert.details}</p>
                      </div>

                      {alert.imageEvidence && (
                        <div className="w-20 h-16 rounded overflow-hidden border border-slate-800 cursor-zoom-in hover:border-blue-500 transition-all flex-shrink-0" onClick={() => {
                          const w = window.open();
                          w?.document.write(`<img src="${alert.imageEvidence}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                        }}>
                          <img src={alert.imageEvidence} alt="Evidence" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monitor Side (Right 1 column: Current active student feeds) */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Active Student Feeds <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{activeStudents.length} Online</span>
              </h2>

              {activeStudents.length === 0 ? (
                <div className="glass-card p-8 text-center rounded-2xl border border-slate-900">
                  <span className="text-slate-500 text-xs">No active exam sessions running.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeStudents.map((student) => (
                    <div key={student.socketId} className="glass-card p-4 rounded-xl border border-slate-900 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">{student.name}</span>
                          <span className="text-[10px] text-slate-500">{student.studentId}</span>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold uppercase animate-pulse">
                        Examining
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Active Examinations</h2>
            
            {exams.length === 0 ? (
              <div className="glass-card p-16 text-center text-slate-500 rounded-2xl">
                No exams scheduled yet. Click "+ Create Exam Template" to setup templates.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {exams.map((exam) => (
                  <div key={exam._id} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white">{exam.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-blue-500" /> {exam.duration} Minutes</span>
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-indigo-500" /> Questions: {exam.questions.length}</span>
                      </div>
                      
                      <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-900">
                        <div>Start: {new Date(exam.scheduledStart).toLocaleString()}</div>
                        <div>End: {new Date(exam.scheduledEnd).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-900">
                      <Link
                        to={`/admin/reports/${exam._id}`}
                        className="w-full py-2.5 rounded-xl border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-blue-300 bg-blue-500/[0.02] text-xs font-bold flex items-center justify-center gap-2 transition"
                      >
                        <FileText className="w-4 h-4" /> View AI Integrity Reports
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'newExam' && (
          <form onSubmit={handleSaveExam} className="glass-card p-8 rounded-2xl border border-slate-850 space-y-6 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-white">Create Exam Template</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Exam Title</label>
                  <input
                    type="text"
                    required
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="E.g. Computer Graphics Semester Exam"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={examDesc}
                    onChange={(e) => setExamDesc(e.target.value)}
                    placeholder="Short summary instructions for students..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Duration (Minutes)</label>
                  <input
                    type="number"
                    required
                    min={5}
                    value={examDuration}
                    onChange={(e) => setExamDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white focus:outline-none focus:border-blue-500 text-sm transition"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Scheduled Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={examStart}
                    onChange={(e) => setExamStart(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white focus:outline-none focus:border-blue-500 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Scheduled End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={examEnd}
                    onChange={(e) => setExamEnd(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-white focus:outline-none focus:border-blue-500 text-sm transition"
                  />
                </div>
              </div>
            </div>

            {/* Questions Editor Section */}
            <div className="border-t border-slate-850 pt-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-200">Questions List ({questions.length})</h3>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4 text-blue-400" /> Add Question
                </button>
              </div>

              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                {questions.map((q, idx) => (
                  <div key={idx} className="p-5 border border-slate-850 rounded-xl bg-slate-900/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Question {idx + 1}</span>
                      <select
                        value={q.type}
                        onChange={(e) => handleUpdateQuestion(idx, 'type', e.target.value)}
                        className="px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-semibold text-slate-300 focus:outline-none"
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="descriptive">Descriptive Explanation</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        required
                        value={q.text}
                        onChange={(e) => handleUpdateQuestion(idx, 'text', e.target.value)}
                        placeholder="Enter question text description..."
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs transition"
                      />
                    </div>

                    {q.type === 'mcq' ? (
                      <div className="space-y-3">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Options:</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt: string, oIdx: number) => (
                            <input
                              key={oIdx}
                              type="text"
                              required
                              value={opt}
                              onChange={(e) => handleUpdateOption(idx, oIdx, e.target.value)}
                              placeholder={`Option ${oIdx + 1}`}
                              className="w-full px-3 py-2 rounded-lg border border-slate-850 bg-slate-900/60 text-white text-xs placeholder-slate-600 focus:outline-none"
                            />
                          ))}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Correct Option Text:</label>
                          <input
                            type="text"
                            required
                            value={q.correctAnswer}
                            onChange={(e) => handleUpdateQuestion(idx, 'correctAnswer', e.target.value)}
                            placeholder="Must match one of the option texts exactly"
                            className="w-full md:w-1/2 px-3 py-2 rounded-lg border border-slate-850 bg-slate-900/60 text-white text-xs placeholder-slate-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Grading Keywords:</label>
                        <input
                          type="text"
                          required
                          value={q.correctAnswer}
                          onChange={(e) => handleUpdateQuestion(idx, 'correctAnswer', e.target.value)}
                          placeholder="E.g. database, query, primary key (comma-separated for key evaluation match scoring)"
                          className="w-full px-3 py-2 rounded-lg border border-slate-850 bg-slate-900/60 text-white text-xs placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-sm cursor-pointer shadow-lg shadow-blue-600/10"
            >
              <ListPlus className="w-5 h-5" /> Save and Deploy Exam Template
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
