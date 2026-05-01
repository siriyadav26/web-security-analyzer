'use client';

import { Shield, History, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { motion } from 'framer-motion';

export function Navbar() {
  const { view, setView, result } = useAppStore();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl"
      style={{ background: 'rgba(11, 15, 25, 0.8)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="relative">
              <Shield className="w-7 h-7 text-cyber-cyan" />
              <div className="absolute inset-0 w-7 h-7 bg-cyber-cyan/20 rounded-full blur-md" />
            </div>
            <span className="text-lg font-semibold gradient-text">
              SecurityAnalyzer
            </span>
          </button>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {view !== 'landing' && view !== 'loading' && (
              <button
                onClick={() => setView('landing')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">New Scan</span>
              </button>
            )}

            {view === 'dashboard' && result && (
              <button
                onClick={() => setView('history')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </button>
            )}

            {view === 'history' && (
              <button
                onClick={() => result ? setView('dashboard') : setView('landing')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Results</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
