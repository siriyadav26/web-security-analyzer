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
import { ScoreBreakdownCard } from '@/components/cards/ScoreBreakdownCard';
import { Globe, Calendar, Shield, Lock, Eye, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

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

  // Ensure all required fields exist with safe defaults
  const safeResult: typeof result = {
    ...result,
    analysisMode: result.analysisMode || 'fallback',
    limitations: result.limitations || [],
    scoreBreakdown: result.scoreBreakdown || [],
    primaryRisk: result.primaryRisk || null,
    context: result.context || {
      siteType: 'unknown',
      hasForms: false,
      hasLogin: false,
      isStaticSite: false,
      isApi: false,
      detectionNotes: 'Context data not available.',
    },
  };

  const siteTypeLabel = (() => {
    switch (safeResult.context.siteType) {
      case 'api': return 'API Endpoint';
      case 'static': return 'Static/Informational';
      case 'interactive': return 'Interactive Web App';
      case 'unknown': return 'Unknown';
      default: return 'Unknown';
    }
  })();

  const siteTypeColor = (() => {
    switch (safeResult.context.siteType) {
      case 'api': return 'bg-emerald-500/10 text-emerald-400';
      case 'static': return 'bg-blue-500/10 text-blue-400';
      case 'interactive': return 'bg-purple-500/10 text-purple-400';
      case 'unknown': return 'bg-slate-500/10 text-slate-400';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  })();

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
            background: safeResult.score >= 80 ? 'rgba(34, 197, 94, 0.05)' :
                       safeResult.score >= 50 ? 'rgba(250, 204, 21, 0.05)' :
                       'rgba(239, 68, 68, 0.05)',
          }} />

        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 relative z-10">
          <ScoreCircle score={safeResult.score} riskLevel={safeResult.riskLevel} />

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
              <Globe className="w-4 h-4 text-cyber-cyan" />
              <span className="text-sm text-slate-400">Analysis Result</span>
              {/* Analysis Mode Badge */}
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                safeResult.analysisMode === 'secure'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}>
                {safeResult.analysisMode === 'secure' ? '🔒 Secure Mode' : '⚠️ Fallback Mode'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 break-all">
              {safeResult.url}
            </h2>
            <div className="flex items-center gap-4 justify-center sm:justify-start flex-wrap">
              <RiskBadge riskLevel={safeResult.riskLevel} />
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(safeResult.analyzedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5" />
                <span>Full Scan</span>
              </div>
            </div>

            {/* Primary Risk */}
            {safeResult.primaryRisk && (
              <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Primary Risk</span>
                  <p className="text-xs text-red-300 leading-relaxed">{safeResult.primaryRisk}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Context Banner */}
      {safeResult.context && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-card p-4 mb-6 border-l-2 border-cyber-blue/30"
        >
          <div className="flex items-start gap-3">
            <Eye className="w-4 h-4 text-cyber-cyan mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-medium text-cyber-cyan">Site Context Analysis</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${siteTypeColor}`}>
                  {siteTypeLabel}
                </span>
                {safeResult.context.hasLogin && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                    Authentication Detected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{safeResult.context.detectionNotes}</p>

              {/* Context explanation for site type */}
              {safeResult.context.siteType === 'api' && (
                <p className="text-[10px] text-emerald-400/70 mt-1">
                  API endpoints have different security requirements than web pages — browser-specific headers (CSP, X-Frame-Options) are not applicable and excluded from scoring.
                </p>
              )}
              {safeResult.context.siteType === 'static' && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Static sites have lower XSS/clickjacking risk — header severities are adjusted accordingly.
                </p>
              )}
              {safeResult.context.siteType === 'unknown' && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Could not determine site type. Risk assessments use default severity levels, which may overestimate risk for static sites or APIs.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Analysis Limitations */}
      {safeResult.limitations && safeResult.limitations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass-card p-4 mb-6 border-l-2 border-yellow-500/20"
        >
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-medium text-yellow-400">Analysis Limitations</span>
              <ul className="mt-1 space-y-1">
                {safeResult.limitations.map((limitation, i) => (
                  <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-yellow-500/60 mt-0.5">•</span>
                    {limitation}
                  </li>
                ))}
              </ul>
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
            <SSLStatusCard ssl={safeResult.ssl} />
          </motion.div>
        </motion.div>

        {/* Score Breakdown Card — SECOND (explains the score) */}
        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: -2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <ScoreBreakdownCard breakdown={safeResult.scoreBreakdown} score={safeResult.score} />
          </motion.div>
        </motion.div>

        {/* Security Headers Card — THIRD */}
        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: -2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <SecurityHeadersCard headers={safeResult.headers} siteType={safeResult.context.siteType} />
          </motion.div>
        </motion.div>

        {/* Vulnerabilities Card — FOURTH */}
        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: 2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <VulnerabilitiesCard vulnerabilities={safeResult.vulnerabilities} />
          </motion.div>
        </motion.div>

        {/* Open Ports Card — FIFTH (informational) */}
        <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: -2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <OpenPortsCard ports={safeResult.ports} />
          </motion.div>
        </motion.div>

        {/* Suggestions Card — LAST */}
        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
          <motion.div whileHover={{ rotateY: 2, rotateX: -1 }} transition={{ duration: 0.2 }}>
            <SuggestionsCard suggestions={safeResult.suggestions} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
