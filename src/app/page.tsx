'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import { AuthView } from '@/components/AuthView';
import { LandingView } from '@/components/LandingView';
import { LoadingView } from '@/components/LoadingView';
import { DashboardView } from '@/components/DashboardView';
import { HistoryView } from '@/components/HistoryView';
import { ChatBot } from '@/components/ChatBot';
import { SecurityBackground3D } from '@/components/SecurityBackground3D';

function AppContent() {
  const { view, isAuthenticated } = useAppStore();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Only sync from NextAuth session if we're not already authenticated
    // This prevents the store from being reset when session fetch fails
    if (session?.user && !isAuthenticated) {
      useAppStore.getState().setAuthenticated(true, {
        id: (session.user as any).id || '',
        email: session.user.email || '',
        name: session.user.name || '',
      });
      if (view === 'auth') {
        useAppStore.getState().setView('landing');
      }
    }
  }, [session, isAuthenticated, view]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0B0F19' }}>
      {/* Page-specific 3D Background */}
      <SecurityBackground3D view={view} />

      {/* Ambient blurs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      {isAuthenticated && view !== 'auth' && <Navbar />}

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {view === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <AuthView />
            </motion.div>
          )}

          {view === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <LandingView />
            </motion.div>
          )}

          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LoadingView />
            </motion.div>
          )}

          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <DashboardView />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <HistoryView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isAuthenticated && <ChatBot />}
    </div>
  );
}

export default function Home() {
  return <AppContent />;
}
