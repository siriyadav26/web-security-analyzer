'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, Check, X, AlertTriangle, Info } from 'lucide-react';
import type { HeaderResult } from '@/lib/analyzer/types';

interface SecurityHeadersCardProps {
  headers: HeaderResult[];
}

export function SecurityHeadersCard({ headers }: SecurityHeadersCardProps) {
  const [expanded, setExpanded] = useState(false);

  const presentCount = headers.filter(h => {
    if (h.name === 'Server-Info-Exposure') return !h.present; // Not exposed = good
    if (h.name === 'Cookie-Security') return !h.present; // No insecure cookies = good
    return h.present;
  }).length;

  const totalCount = headers.length;

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyber-cyan" />
          <h3 className="font-semibold text-white">Security Headers</h3>
        </div>
        <span className="text-xs text-slate-500">
          {presentCount}/{totalCount} passed
        </span>
      </div>

      {/* Header List */}
      <div className="space-y-2">
        {headers.slice(0, expanded ? undefined : 5).map((header, index) => {
          const isGood = header.name === 'Server-Info-Exposure' || header.name === 'Cookie-Security'
            ? !header.present
            : header.present;

          const getConfidenceBadge = (confidence?: string) => {
            if (!confidence || confidence === 'high') return null;
            return (
              <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                confidence === 'medium'
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'bg-orange-500/10 text-orange-400'
              }`}>
                {confidence} confidence
              </span>
            );
          };

          return (
            <motion.div
              key={header.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <div className="mt-0.5 shrink-0">
                {isGood ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : header.severity === 'critical' ? (
                  <X className="w-4 h-4 text-red-400" />
                ) : header.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Info className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-white font-medium">{header.name}</span>
                  {!isGood && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      header.severity === 'critical' 
                        ? 'bg-red-500/10 text-red-400' 
                        : header.severity === 'warning'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {header.severity}
                    </span>
                  )}
                  {getConfidenceBadge(header.confidence)}
                </div>
                {header.value && (
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{header.value}</p>
                )}
                {header.confidenceNote && !isGood && (
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed italic">
                    {header.confidenceNote}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Expand/Collapse */}
      {headers.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-slate-500 hover:text-cyber-cyan transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Show less' : `Show ${headers.length - 5} more`}
        </button>
      )}
    </div>
  );
}
