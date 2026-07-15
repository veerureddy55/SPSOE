import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Camera, AlertCircle, CheckCircle, Video, ArrowRight } from 'lucide-react';
import axios from 'axios';

export const ExamVerification: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  // Load exam info and start webcam
  useEffect(() => {
    const loadData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await axios.get(`${API_URL}/api/exams/${examId}`);
        setExam(response.data.exam);
        await startCamera();
      } catch (err: any) {
        console.error("Exam load error:", err);
        setError(err.response?.data?.message || 'Failed to load exam details.');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup camera tracks on unmount
    return () => {
      stopCamera();
    };
  }, [examId]);

  const startCamera = async () => {
    setCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera start error:", err);
      setError("Unable to access webcam. Aegis Proctor requires camera access to authorize exam entry.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setVerifying(true);
    setError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const snapshot = canvas.toDataURL('image/jpeg');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await axios.post(`${API_URL}/api/exams/verify-identity`, {
          examId,
          currentSnapshot: snapshot
        });

        if (response.data.verified) {
          setVerified(true);
          setMatchScore(response.data.matchScore);
          stopCamera();
        }
      }
    } catch (err: any) {
      console.error("Verification failed:", err);
      setError(err.response?.data?.message || 'Verification failed. Please align your face and try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading verification workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 relative flex items-center justify-center">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 glass-card p-8 rounded-2xl border border-slate-800 relative z-10">
        
        {/* Left Side: Exam Instructions & Rules */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase">
              <Shield className="w-3.5 h-3.5" /> AI Verification Pipeline
            </div>
            
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">{exam?.title}</h1>
            <p className="text-slate-400 text-sm">{exam?.description || 'Review the requirements carefully before commencing the proctored exam.'}</p>
            
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Examination Protocols:</h3>
              <ul className="space-y-3 text-xs text-slate-400">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span>Do not minimize this window, open other applications, or switch tabs. Any visibility changes are logged as violations.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span>Maintain front-facing posture looking at the screen. Avoid frequent looking away from your camera frame.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span>Ensure no unauthorized individuals enter your physical testing zone. Multiple people triggers security flag.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span>Do not use hand-held devices (mobile phones/tablets) or read printed books within camera range.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Duration: <strong className="text-slate-200">{exam?.duration} min</strong></span>
            
            {verified && (
              <button
                onClick={() => navigate(`/exam/take/${examId}`)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                Enter Examination <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Camera Capture & Matching */}
        <div className="flex flex-col items-center justify-center p-6 border border-slate-850 bg-slate-900/30 rounded-2xl">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6">Identity Authorization</h2>
          
          <div className="relative w-full max-w-[360px] aspect-[4/3] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shadow-inner">
            {cameraActive && !verified ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                {/* Advanced Face Mesh/Scanner styling overlay */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500 shadow-md shadow-blue-500/80 animate-[bounce_3s_infinite]" />
                <div className="absolute inset-0 border border-blue-500/30 m-4 rounded-xl pointer-events-none" />
              </>
            ) : verified ? (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                <CheckCircle className="w-16 h-16 text-emerald-400 mb-3 drop-shadow-[0_4px_10px_rgba(52,211,153,0.2)] animate-bounce" />
                <span className="text-base font-bold text-slate-200 uppercase tracking-wider">Identity Match Found</span>
                {matchScore && (
                  <span className="text-xs text-slate-500 font-mono mt-1">Match Confidence: {(matchScore * 100).toFixed(1)}%</span>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-slate-600">
                <Video className="w-12 h-12 text-slate-800 mb-2" />
                <span className="text-xs font-semibold">Webcam Offline</span>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {error && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-2 max-w-[360px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex gap-4">
            {!verified && (
              <>
                {!cameraActive && (
                  <button
                    onClick={startCamera}
                    className="px-5 py-2.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition"
                  >
                    Reactivate Camera
                  </button>
                )}
                
                <button
                  onClick={handleVerify}
                  disabled={verifying || !cameraActive}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-600/10 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> {verifying ? 'Matching Face...' : 'Verify Face Match'}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
