'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { ScoreCircle } from '@/components/cards/ScoreCircle';
import { RiskBadge } from '@/components/cards/RiskBadge';
import { SecurityHeadersCard } from '@/components/cards/SecurityHeadersCard';
import { SSLStatusCard } from '@/components/cards/SSLStatusCard';
import { OpenPortsCard } from '@/components/cards/OpenPortsCard';
import { VulnerabilitiesCard } from '@/components/cards/VulnerabilitiesCard';
import { SuggestionsCard } from '@/components/cards/SuggestionsCard';
import { Globe, Calendar, Shield, FileText, Lock, Eye } from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 30, rotateX: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function DashboardView() {
  const { result } = useAppStore();
  if (!result) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Section - Score and URL Info */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card p-6 sm:p-8 mb-6 relative overflow-hidden"
        style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
      >
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{
            background: result.score >= 80 ? 'rgba(34, 197, 94, 0.05)' :
                       result.score >= 50 ? 'rgba(250, 204, 21, 0.05)' :
                       'rgba(239, 68, 68, 0.05)',
          }} />

        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 relative z-10">
          <ScoreCircle score={result.score} riskLevel={result.riskLevel} />

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
              <Globe className="w-4 h-4 text-cyber-cyan" />
              <span className="text-sm text-slate-400">Analysis Result</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 break-all">
              {result.url}
            </h2>
            <div className="flex items-center gap-4 justify-center sm:justify-start flex-wrap">
              <RiskBadge riskLevel={result.riskLevel} />
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(result.analyzedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5" />
                <span>Full Scan</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Context Banner */}
      {result.context && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-card p-4 mb-6 border-l-2 border-cyber-blue/30"
        >
          <div className="flex items-start gap-3">
            <Eye className="w-4 h-4 text-cyber-cyan mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-cyber-cyan">Site Context Analysis</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  result.context.isStaticSite ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                }`}>
                  {result.context.isStaticSite ? 'Static/Informational' : 'Interactive/Web App'}
                </span>
                {result.context.hasLogin && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                    Authentication Detected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{result.context.detectionNotes}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Risk assessments are adjusted based on site type — static sites have lower XSS/clickjacking risk than interactive applications.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid of Cards — SSL first (highest priority), then headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SSL/TLS Card — FIRST (highest priority) */}
        <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: 2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <SSLStatusCard ssl={result.ssl} />
          </motion.div>
        </motion.div>

        {/* Security Headers Card — SECOND */}
        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: -2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <SecurityHeadersCard headers={result.headers} />
          </motion.div>
        </motion.div>

        {/* Vulnerabilities Card — THIRD */}
        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: 2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <VulnerabilitiesCard vulnerabilities={result.vulnerabilities} />
          </motion.div>
        </motion.div>

        {/* Open Ports Card — FOURTH (informational) */}
        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: -2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <OpenPortsCard ports={result.ports} />
          </motion.div>
        </motion.div>

        {/* Suggestions Card — LAST */}
        <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible" className="lg:col-span-2"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateX: -1 }} transition={{ duration: 0.2 }}>
            <SuggestionsCard suggestions={result.suggestions} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
