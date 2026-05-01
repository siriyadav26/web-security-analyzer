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
import { Globe, Calendar } from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: 'easeOut',
    },
  }),
};

export function DashboardView() {
  const { result } = useAppStore();

  if (!result) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Section - Score and URL Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card p-6 sm:p-8 mb-6"
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          {/* Score Circle */}
          <ScoreCircle score={result.score} riskLevel={result.riskLevel} />

          {/* URL Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
              <Globe className="w-4 h-4 text-cyber-cyan" />
              <span className="text-sm text-slate-400">Analysis Result</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 break-all">
              {result.url}
            </h2>
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <RiskBadge riskLevel={result.riskLevel} />
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(result.analyzedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
          <SecurityHeadersCard headers={result.headers} />
        </motion.div>

        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
          <SSLStatusCard ssl={result.ssl} />
        </motion.div>

        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
          <OpenPortsCard ports={result.ports} />
        </motion.div>

        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
          <VulnerabilitiesCard vulnerabilities={result.vulnerabilities} />
        </motion.div>

        <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible" className="lg:col-span-2">
          <SuggestionsCard suggestions={result.suggestions} />
        </motion.div>
      </div>
    </div>
  );
}
