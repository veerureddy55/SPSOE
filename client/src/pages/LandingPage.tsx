import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Eye, CheckCircle, Video, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 md:py-32 flex flex-col items-center text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <Cpu className="w-3.5 h-3.5" /> Next-Gen AI Remote Proctoring
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl leading-tight">
          Secure, AI-Powered Examinations for the{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
            Modern Digital Age
          </span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          Aegis Proctor provides a tamper-proof digital testing environment. Powered by computer vision and deep learning, our engine tracks gaze, head rotation, object presence, and tab switching in real-time.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/dashboard'}
              className="px-8 py-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20 transition transform hover:-translate-y-0.5"
            >
              Enter Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="px-8 py-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20 transition transform hover:-translate-y-0.5"
              >
                Register as Student
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition transform hover:-translate-y-0.5"
              >
                Sign In to Platform
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Key AI Capabilities Section */}
      <section className="container mx-auto px-6 py-16 relative z-10">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-12">
          Advanced Proctoring Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-8 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Gaze & Focus Detection</h3>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed">
              Eye-movement tracking automatically detects when candidates look away from their screen repeatedly to reference external materials.
            </p>
          </div>

          <div className="glass-card p-8 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6">
              <Cpu className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Multi-Face & Object Check</h3>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed">
              Identifies the presence of unauthorized devices (phones, tablets), books, or multiple people in the camera frame immediately.
            </p>
          </div>

          <div className="glass-card p-8 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-6">
              <Lock className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Lockdown & Focus Guard</h3>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed">
              Monitors and records tab switching, desktop minimization, and window resizing, signaling warnings directly to students and admins.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="container mx-auto px-6 py-16 relative z-10 border-t border-slate-900">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-1/2">
            <h3 className="text-2xl md:text-3xl font-extrabold text-white">
              Identity Verification & Liveness Check
            </h3>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Prior to opening any examination window, students undergo facial recognition matching against their registered profile photo. An integrated liveness detection phase checks movements to prevent static photo substitution bypasses.
            </p>
            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                Dual-stage match evaluation
              </li>
              <li className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                Live feedback webcam screen indicator
              </li>
              <li className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                Instant alert logs for failed attempts
              </li>
            </ul>
          </div>
          <div className="w-full md:w-1/2 glass-card p-6 rounded-2xl border border-slate-800 flex justify-center">
            {/* Visual simulation of webcam feed / AI detector box */}
            <div className="relative w-full max-w-[400px] h-[260px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-700">
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                <Video className="w-10 h-10 text-blue-500 mb-2 animate-pulse" />
                <span className="text-xs text-slate-400 font-mono">SIMULATED IDENTITY VERIFICATION SCREEN</span>
              </div>
              <div className="absolute top-6 left-6 right-6 bottom-6 border-2 border-dashed border-blue-500/40 rounded-lg flex items-center justify-center">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-blue-500 text-xs font-semibold text-white uppercase rounded">
                  Face Matching: 94.7%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500 relative z-10">
        <p>&copy; {new Date().getFullYear()} Smart Proctoring System for Online Exams (SPSOE). All rights reserved.</p>
        <p className="mt-1">Developed for secure remote examination authentication and AI monitoring.</p>
      </footer>
    </div>
  );
};
