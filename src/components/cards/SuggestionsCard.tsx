'use client';

import { motion } from 'framer-motion';
import { Lightbulb, ArrowUp } from 'lucide-react';
import type { SecuritySuggestion } from '@/lib/analyzer/types';

interface SuggestionsCardProps {
  suggestions: SecuritySuggestion[];
}

export function SuggestionsCard({ suggestions }: SuggestionsCardProps) {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...suggestions].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-green-500/10 text-green-400 border-green-500/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    return category === 'SSL/TLS' ? '🔐' :
           category === 'Security Headers' ? '🛡️' :
           category === 'Cookie Security' ? '🍪' :
           category === 'Information Disclosure' ? '👁️' :
           category === 'Network Security' ? '🌐' :
           category === 'Overall Security' ? '🔒' : '💡';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-cyber-cyan" />
          <h3 className="font-semibold text-white">Security Recommendations</h3>
        </div>
        <span className="text-xs text-slate-500">
          {suggestions.length} suggestions
        </span>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">No suggestions at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((suggestion, index) => (
            <motion.div
              key={`${suggestion.title}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="p-4 rounded-lg border border-white/5 hover:border-cyber-blue/20 transition-all"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">{getCategoryIcon(suggestion.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-white">{suggestion.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${getPriorityBadge(suggestion.priority)}`}>
                      {suggestion.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{suggestion.description}</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-600">
                    <ArrowUp className="w-3 h-3" />
                    <span>{suggestion.category}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
