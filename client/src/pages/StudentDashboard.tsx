import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Calendar, Clock, Award, Shield, Play } from 'lucide-react';
import axios from 'axios';

interface Exam {
  _id: string;
  title: string;
  description: string;
  duration: number;
  scheduledStart: string;
  scheduledEnd: string;
  attempted: boolean;
  attemptDetails?: {
    score: number;
    integrityStatus: 'green' | 'yellow' | 'red';
    cheatingProbability: number;
    submittedAt: string;
  } | null;
}

export const StudentDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await axios.get(`${API_URL}/api/exams`);
        setExams(response.data.exams);
      } catch (err: any) {
        console.error("Fetch exams error:", err);
        setError("Failed to retrieve exams list. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(search.toLowerCase()) || 
    (e.description && e.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Divide exams into categories
  const activeExams = filteredExams.filter(e => !e.attempted && new Date(e.scheduledEnd) > new Date());
  const completedExams = filteredExams.filter(e => e.attempted);

  // Aggregate student stats
  const averageScore = completedExams.length > 0 
    ? Math.round(completedExams.reduce((sum, e) => sum + (e.attemptDetails?.score || 0), 0) / completedExams.length)
    : null;

  const totalViolationsAlerts = completedExams.filter(e => e.attemptDetails?.integrityStatus === 'red').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-900">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Student Portal</h1>
            <p className="text-slate-400 text-sm mt-1">Hello, {user?.name}. Check your exams schedule and academic integrity stats.</p>
          </div>
          
          <div className="relative w-full max-w-sm">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exams..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-800 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition"
            />
          </div>
        </div>

        {/* Stats Row */}
        {completedExams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Score</span>
                <span className="text-2xl font-bold text-slate-200">{averageScore}%</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Integrity Standing</span>
                <span className={`text-2xl font-bold ${totalViolationsAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {totalViolationsAlerts > 0 ? 'Warning Flagged' : 'Good (Clear)'}
                </span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Exams</span>
                <span className="text-2xl font-bold text-slate-200">{completedExams.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Exams List Container */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading exams list...</div>
        ) : error ? (
          <div className="text-center py-20 text-rose-400">{error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Active / Available Exams (Left 2 columns) */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Available Exams <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal">{activeExams.length}</span>
              </h2>
              
              {activeExams.length === 0 ? (
                <div className="glass-card p-12 text-center rounded-2xl border border-slate-900">
                  <span className="text-slate-500 text-sm">No new exams scheduled at this time.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeExams.map((exam) => (
                    <div key={exam._id} className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-2 max-w-lg">
                        <h3 className="text-lg font-bold text-white leading-snug">{exam.title}</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">{exam.description || 'No description provided.'}</p>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> {exam.duration} Minutes</span>
                          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> Start: {new Date(exam.scheduledStart).toLocaleString()}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate(`/exam/verify/${exam._id}`)}
                        className="w-full md:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 cursor-pointer transition transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <Play className="w-4 h-4 fill-white" /> Start Exam Setup
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previous Attempt History (Right column) */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Exam History <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-800 font-normal">{completedExams.length}</span>
              </h2>

              {completedExams.length === 0 ? (
                <div className="glass-card p-8 text-center rounded-2xl border border-slate-900">
                  <span className="text-slate-500 text-xs">Your completed exam records will appear here.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedExams.map((exam) => (
                    <div key={exam._id} className="glass-card p-5 rounded-xl border border-slate-900 space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 line-clamp-1">{exam.title}</h4>
                        <span className="text-[10px] text-slate-500 block">Submitted {new Date(exam.attemptDetails?.submittedAt || '').toLocaleDateString()}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-3">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Score Received</span>
                          <span className="text-base font-bold text-slate-300">{exam.attemptDetails?.score}/100</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Integrity Rating</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            exam.attemptDetails?.integrityStatus === 'green' 
                              ? 'text-emerald-400' 
                              : exam.attemptDetails?.integrityStatus === 'yellow' 
                              ? 'text-amber-400' 
                              : 'text-rose-400'
                          }`}>
                            {exam.attemptDetails?.integrityStatus === 'green' && 'Clear'}
                            {exam.attemptDetails?.integrityStatus === 'yellow' && 'Suspicious'}
                            {exam.attemptDetails?.integrityStatus === 'red' && 'Flagged'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};
