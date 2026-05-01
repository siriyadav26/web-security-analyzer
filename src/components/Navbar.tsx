'use client';

import { motion } from 'framer-motion';
import { Shield, History, ArrowLeft, LogOut, User, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function Navbar() {
  const { view, setView, result, user, logout, chatOpen, setChatOpen } = useAppStore();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl"
      style={{ background: 'rgba(11, 15, 25, 0.8)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="relative"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <Shield className="w-7 h-7 text-cyber-cyan" />
              <div className="absolute inset-0 w-7 h-7 bg-cyber-cyan/20 rounded-full blur-md" />
            </motion.div>
            <span className="text-lg font-semibold gradient-text">
              SecurityAnalyzer
            </span>
          </button>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {view !== 'loading' && view !== 'auth' && (
              <>
                <button
                  onClick={() => setView('landing')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">New Scan</span>
                </button>

                <button
                  onClick={() => setView('history')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                </button>

                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">AI Chat</span>
                </button>

                <div className="w-px h-6 bg-white/10 mx-1" />

                {/* User info */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #22D3EE)' }}>
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-slate-400 hidden sm:inline max-w-[120px] truncate">
                    {user?.name || 'User'}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
