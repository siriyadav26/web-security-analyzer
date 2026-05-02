'use client';

import { motion } from 'framer-motion';
import { Calculator, TrendingDown, TrendingUp, Minus, Shield, FileText, Globe, Lock } from 'lucide-react';
import type { ScoreBreakdownItem } from '@/lib/analyzer/types';

interface ScoreBreakdownCardProps {
  breakdown: ScoreBreakdownItem[];
  score: number;
}

export function ScoreBreakdownCard({ breakdown, score }: ScoreBreakdownCardProps) {
  // Guard against undefined/null breakdown
  const safeBreakdown = breakdown || [];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ssl': return <Lock className="w-3 h-3" />;
      case 'header': return <FileText className="w-3 h-3" />;
      case 'port': return <Globe className="w-3 h-3" />;
      case 'context': return <Shield className="w-3 h-3" />;
      default: return <Shield className="w-3 h-3" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'ssl': return 'SSL/TLS';
      case 'header': return 'Headers';
      case 'port': return 'Ports';
      case 'context': return 'Context';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ssl': return 'text-red-400';
      case 'header': return 'text-yellow-400';
      case 'port': return 'text-blue-400';
      case 'context': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  // Group breakdown by category
  const grouped = safeBreakdown.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ScoreBreakdownItem[]>);

  const categoryOrder = ['ssl', 'header', 'port', 'context'];
  const totalDeductions = safeBreakdown.filter(b => b.points < 0).reduce((sum, b) => sum + b.points, 0);

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-cyber-cyan" />
          <h3 className="font-semibold text-white">Score Breakdown</h3>
        </div>
        <span className="text-xs text-slate-500">
          Starts at 100{totalDeductions < 0 && ` | ${totalDeductions} deductions`}
        </span>
      </div>

      {/* Score visualization */}
      <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Final Score</span>
          <span className={`text-lg font-bold ${
            score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {score}/100
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: score >= 80 ? '#22C55E' : score >= 50 ? '#FACC15' : '#EF4444',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
      </div>

      {/* Breakdown by category */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {categoryOrder.map(category => {
          const items = grouped[category];
          if (!items || items.length === 0) return null;

          return (
            <div key={category}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={getCategoryColor(category)}>{getCategoryIcon(category)}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  {getCategoryLabel(category)}
                </span>
              </div>
              <div className="space-y-1 ml-5">
                {items.map((item, i) => (
                  <motion.div
                    key={`${category}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-slate-300 truncate max-w-[200px]">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.points === 0 ? (
                        <Minus className="w-3 h-3 text-slate-500" />
                      ) : item.points > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className={`text-xs font-mono ${
                        item.points === 0 ? 'text-slate-500' :
                        item.points > 0 ? 'text-green-400' :
                        'text-red-400'
                      }`}>
                        {item.points > 0 ? '+' : ''}{item.points}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
