import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, Download, User } from 'lucide-react';
import axios from 'axios';

interface ViolationLog {
  violationType: string;
  timestamp: string;
  confidence: number;
  imageEvidence?: string;
  details: string;
}

interface Report {
  _id: string;
  student: {
    _id: string;
    name: string;
    email: string;
  };
  score: number;
  cheatingProbability: number;
  integrityStatus: 'green' | 'yellow' | 'red';
  startedAt: string;
  submittedAt: string;
  violationSummary: {
    MULTIPLE_FACES: number;
    FACE_MISSING: number;
    EYE_LOOKING_AWAY: number;
    UNUSUAL_HEAD_POSE: number;
    PROHIBITED_OBJECT: number;
    TAB_SWITCH: number;
  };
  logs: ViolationLog[];
}

export const AdminReports: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailedLogs, setDetailedLogs] = useState<any[]>([]);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        // Load exam details to get title
        const examRes = await axios.get(`${API_URL}/api/exams/${examId}`);
        setExamTitle(examRes.data.exam.title);

        // Load integrity reports
        const reportsRes = await axios.get(`${API_URL}/api/monitoring/reports/${examId}`);
        setReports(reportsRes.data.reports);
        
        if (reportsRes.data.reports.length > 0) {
          setSelectedReport(reportsRes.data.reports[0]);
          await fetchDetailedLogs(reportsRes.data.reports[0].student._id);
        }
      } catch (err: any) {
        console.error("Reports loading error:", err);
        setError("Failed to load integrity reports. Verify connections.");
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [examId]);

  const fetchDetailedLogs = async (studentId: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_URL}/api/monitoring/violations?studentId=${studentId}&examId=${examId}`);
      setDetailedLogs(response.data.logs);
    } catch (e) {
      console.error("Failed to load violations details:", e);
    }
  };

  const handleSelectStudent = async (report: Report) => {
    setSelectedReport(report);
    setDetailedLogs([]);
    await fetchDetailedLogs(report.student._id);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading integrity audit files...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-slate-100 printing-container">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation / Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-900 print:hidden">
          <div className="space-y-2">
            <Link to="/admin" className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition">
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <FileText className="w-8 h-8 text-blue-500" /> AI Integrity Review
            </h1>
            <p className="text-slate-400 text-sm">Exam: <strong className="text-slate-200">{examTitle}</strong></p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-400" /> Export PDF Summary
            </button>
          </div>
        </div>

        {error ? (
          <div className="text-center py-20 text-rose-400">{error}</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl text-slate-500 border border-slate-900">
            No student submissions registered for this exam yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Candidates Table (1 column) */}
            <div className="space-y-6 print:hidden">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Candidate list</h2>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {reports.map((report) => (
                  <button
                    key={report._id}
                    onClick={() => handleSelectStudent(report)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition ${
                      selectedReport?.student._id === report.student._id
                        ? 'bg-blue-600/10 border-blue-500'
                        : 'border-slate-900 bg-slate-900/30 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-slate-200 block">{report.student.name}</span>
                      <span className="text-[10px] text-slate-500 block">{report.student.email}</span>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-xs font-bold text-slate-300 block">Grade: {report.score}%</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        report.integrityStatus === 'green'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : report.integrityStatus === 'yellow'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        Rating: {report.integrityStatus.toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Columns: Selected Student Integrity Audit Details (2 columns) */}
            {selectedReport && (
              <div className="lg:col-span-2 glass-card p-6 md:p-8 rounded-2xl border border-slate-850 space-y-8 print:w-full print:border-none print:bg-transparent">
                
                {/* Profile Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-900">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedReport.student.name}</h3>
                      <span className="text-xs text-slate-500">{selectedReport.student.email}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Submission Integrity Score</span>
                    <span className={`text-3xl font-extrabold ${
                      selectedReport.integrityStatus === 'green'
                        ? 'text-emerald-400'
                        : selectedReport.integrityStatus === 'yellow'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}>
                      {(100 - selectedReport.cheatingProbability).toFixed(0)}% Clear
                    </span>
                  </div>
                </div>

                {/* Score & Timing Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-900 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide block">Exam Grade</span>
                    <strong className="text-lg font-bold text-slate-200">{selectedReport.score}/100</strong>
                  </div>

                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-900 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide block">AI Suspect Rating</span>
                    <strong className="text-lg font-bold text-slate-200">{selectedReport.cheatingProbability}%</strong>
                  </div>

                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-900 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide block">Duration Spent</span>
                    <strong className="text-xs font-bold text-slate-300">
                      {Math.round((new Date(selectedReport.submittedAt).getTime() - new Date(selectedReport.startedAt).getTime()) / 60000)} Min
                    </strong>
                  </div>

                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-900 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide block">Total Violations</span>
                    <strong className="text-lg font-bold text-rose-400">{detailedLogs.length} Events</strong>
                  </div>
                </div>

                {/* Violations Summary Chart */}
                <div className="space-y-4 pt-4 border-t border-slate-900">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Flags Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(selectedReport.violationSummary).map(([key, count]) => (
                      <div key={key} className="p-3 rounded-lg border border-slate-900 bg-slate-900/[0.15] flex justify-between items-center text-xs">
                        <span className="text-slate-500 line-clamp-1 mr-2">{key.replace('_', ' ')}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${count > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Violations Audit Log Timeline */}
                <div className="space-y-6 pt-4 border-t border-slate-900">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detailed Verification Log Timeline</h4>

                  {detailedLogs.length === 0 ? (
                    <div className="p-6 bg-slate-900/10 border border-slate-900 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Candidate completed exam session with zero violations flagged.
                    </div>
                  ) : (
                    <div className="space-y-4 relative border-l border-slate-900 pl-4 ml-2">
                      {detailedLogs.map((log, idx) => (
                        <div key={idx} className="relative space-y-2">
                          {/* Timeline node */}
                          <div className="absolute top-1 -left-[21px] w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-950" />
                          
                          <div className="flex items-center justify-between text-xs">
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">
                              {log.violationType}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString()} ({(log.confidence * 100).toFixed(0)}% conf)
                            </span>
                          </div>

                          <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/40 space-y-3">
                            <p className="text-xs text-slate-300 leading-relaxed">{log.details}</p>
                            
                            {log.imageEvidence && (
                              <div className="w-full max-w-[280px] rounded-lg overflow-hidden border border-slate-850 hover:border-blue-500/40 transition">
                                <img
                                  src={log.imageEvidence}
                                  alt="AI Camera Evidence"
                                  className="w-full h-auto object-cover cursor-zoom-in"
                                  onClick={() => {
                                    const w = window.open();
                                    w?.document.write(`<img src="${log.imageEvidence}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
