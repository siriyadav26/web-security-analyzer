'use client';

import { motion } from 'framer-motion';
import { Network, Check, X, Minus, Info } from 'lucide-react';
import type { PortResult } from '@/lib/analyzer/types';

interface OpenPortsCardProps {
  ports: PortResult[];
}

export function OpenPortsCard({ ports }: OpenPortsCardProps) {
  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-cyber-cyan" />
          <h3 className="font-semibold text-white">Open Ports</h3>
        </div>
        <span className="text-xs text-slate-500">
          {ports.filter(p => p.open).length} open
        </span>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3 border border-blue-500/10" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
        <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
        <span className="text-[10px] text-blue-300/70 leading-relaxed">
          Ports 80 (HTTP) and 443 (HTTPS) are standard for web servers and expected to be open.
        </span>
      </div>

      {/* Port Table */}
      <div className="space-y-1">
        {/* Table Header */}
        <div className="grid grid-cols-[60px_1fr_80px_80px] gap-2 px-3 py-2 text-xs text-slate-500 font-medium">
          <span>Port</span>
          <span>Service</span>
          <span>Status</span>
          <span className="text-right">State</span>
        </div>

        {ports.map((port, index) => (
          <motion.div
            key={port.port}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="group"
          >
            <div className="grid grid-cols-[60px_1fr_80px_80px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
              <span className="text-sm font-mono text-white">{port.port}</span>
              <div>
                <span className="text-sm text-slate-400">{port.service}</span>
                {port.risk !== 'none' && port.open && (
                  <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-medium ${
                    port.risk === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                    port.risk === 'low' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {port.risk} risk
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {port.open ? (
                  <>
                    <span className={`status-dot ${port.risk === 'none' ? 'green' : port.risk === 'medium' ? 'yellow' : 'green'}`} />
                    <span className={`text-xs ${
                      port.risk === 'none' ? 'text-green-400' :
                      port.risk === 'medium' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>Open</span>
                  </>
                ) : port.status === 'closed' ? (
                  <>
                    <span className="status-dot red" />
                    <span className="text-xs text-red-400">Closed</span>
                  </>
                ) : (
                  <>
                    <span className="status-dot yellow" />
                    <span className="text-xs text-yellow-400">Filtered</span>
                  </>
                )}
              </div>
              <div className="flex justify-end">
                {port.open ? (
                  <Check className={`w-4 h-4 ${port.risk === 'none' ? 'text-green-400' : port.risk === 'medium' ? 'text-yellow-400' : 'text-green-400'}`} />
                ) : port.status === 'closed' ? (
                  <X className="w-4 h-4 text-red-400" />
                ) : (
                  <Minus className="w-4 h-4 text-yellow-400" />
                )}
              </div>
            </div>
            {/* Contextual note on hover */}
            {port.note && port.open && port.risk !== 'none' && (
              <div className="px-3 pb-1">
                <span className="text-[10px] text-slate-500 italic">{port.note}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-white/5 flex gap-4">
        <div className="flex items-center gap-1.5">
          <span className="status-dot green" />
          <span className="text-xs text-slate-500">
            {ports.filter(p => p.open).length} Open
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="status-dot red" />
          <span className="text-xs text-slate-500">
            {ports.filter(p => p.status === 'closed').length} Closed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="status-dot yellow" />
          <span className="text-xs text-slate-500">
            {ports.filter(p => p.status === 'filtered').length} Filtered
          </span>
        </div>
      </div>
    </div>
  );
}
