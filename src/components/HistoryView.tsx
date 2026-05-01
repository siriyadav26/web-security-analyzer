'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Clock, Shield, Trash2, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import type { AnalysisResult } from '@/lib/analyzer/types';

export function HistoryView() {
  const { history, setView, setResult, deleteScan } = useAppStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleViewScan = (scan: any) => {
    const result: AnalysisResult = {
      url: scan.url,
      score: scan.score,
      riskLevel: scan.riskLevel,
      headers: scan.headers,
      ssl: scan.ssl,
      ports: scan.ports,
      vulnerabilities: scan.vulnerabilities,
      suggestions: scan.suggestions,
      analyzedAt: scan.createdAt,
    };
    setResult(result);
    setView('dashboard');
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteScan(id);
    setDeletingId(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 50) return '#FACC15';
    return '#EF4444';
  };

  const getRiskBg = (riskLevel: string) => {
    if (riskLevel === 'Low Risk') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (riskLevel === 'Medium Risk') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-8">
          <motion.div
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Clock className="w-6 h-6 text-cyber-cyan" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Scan History</h1>
          <span className="text-sm text-slate-500">({history.length} scans)</span>
        </div>

        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-12 text-center"
          >
            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Search className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-lg font-medium text-slate-400 mb-2">No scans yet</h3>
            <p className="text-sm text-slate-600">Start by analyzing a website to see your scan history here.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {history.map((scan, index) => (
                <motion.div
                  key={scan.id || index}
                  initial={{ opacity: 0, x: -20, rotateY: -5 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  exit={{ opacity: 0, x: 20, rotateY: 5 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.01, rotateY: 1 }}
                  className="glass-card p-4 hover:border-cyber-blue/30 transition-all group"
                  style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
                >
                  <div className="flex items-center gap-4">
                    {/* Score Circle Mini */}
                    <div className="relative w-12 h-12 shrink-0">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                        <circle
                          cx="24" cy="24" r="20" fill="none"
                          stroke={getScoreColor(scan.score)}
                          strokeWidth="4"
                          strokeDasharray={`${(scan.score / 100) * 125.6} 125.6`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                        style={{ color: getScoreColor(scan.score) }}>
                        {scan.score}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">{scan.url}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskBg(scan.riskLevel)}`}>
                          {scan.riskLevel}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(scan.analyzedAt).toLocaleDateString()} {new Date(scan.analyzedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => scan.id && handleDelete(scan.id)}
                        disabled={deletingId === scan.id}
                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <motion.button
                        onClick={() => handleViewScan(scan)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-cyber-cyan hover:bg-cyber-cyan/10 transition-all"
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
