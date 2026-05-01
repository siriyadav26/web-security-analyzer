'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Bug, AlertOctagon, Info } from 'lucide-react';
import type { Vulnerability } from '@/lib/analyzer/types';

interface VulnerabilitiesCardProps {
  vulnerabilities: Vulnerability[];
}

export function VulnerabilitiesCard({ vulnerabilities }: VulnerabilitiesCardProps) {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...vulnerabilities].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertOctagon className="w-4 h-4 text-red-400" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <Bug className="w-4 h-4 text-yellow-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-cyber-cyan" />
          <h3 className="font-semibold text-white">Vulnerabilities</h3>
        </div>
        <span className="text-xs text-slate-500">
          {vulnerabilities.length} found
        </span>
      </div>

      {vulnerabilities.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-green-400 text-xl">✓</span>
          </div>
          <p className="text-sm text-slate-400">No vulnerabilities detected</p>
          <p className="text-xs text-slate-600 mt-1">Your website looks secure!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {sorted.map((vuln, index) => (
            <motion.div
              key={`${vuln.type}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{getSeverityIcon(vuln.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{vuln.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getSeverityBadge(vuln.severity)}`}>
                      {vuln.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{vuln.description}</p>
                  {vuln.recommendation && (
                    <p className="text-xs text-cyber-cyan/80 mt-1.5 leading-relaxed">
                      <span className="font-medium">Fix:</span> {vuln.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
