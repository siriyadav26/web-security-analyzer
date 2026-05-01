'use client';

import { motion } from 'framer-motion';
import { Lock, Unlock, AlertTriangle, Check, Clock } from 'lucide-react';
import type { SSLResult } from '@/lib/analyzer/types';

interface SSLStatusCardProps {
  ssl: SSLResult;
}

export function SSLStatusCard({ ssl }: SSLStatusCardProps) {
  const isSecure = ssl.enabled && ssl.valid;

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isSecure ? (
            <Lock className="w-5 h-5 text-green-400" />
          ) : (
            <Unlock className="w-5 h-5 text-red-400" />
          )}
          <h3 className="font-semibold text-white">SSL/TLS Status</h3>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
          isSecure
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {isSecure ? 'Secure' : 'Not Secure'}
        </span>
      </div>

      {/* SSL Details */}
      <div className="space-y-3">
        {/* HTTPS Status */}
        <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-sm text-slate-400">HTTPS Enabled</span>
          <div className="flex items-center gap-1.5">
            {ssl.enabled ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm ${ssl.enabled ? 'text-green-400' : 'text-red-400'}`}>
              {ssl.enabled ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Certificate Validity */}
        <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-sm text-slate-400">Certificate Valid</span>
          <div className="flex items-center gap-1.5">
            {ssl.valid ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm ${ssl.valid ? 'text-green-400' : 'text-red-400'}`}>
              {ssl.valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
        </div>

        {/* Protocol */}
        {ssl.protocol && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">Protocol</span>
            <span className="text-sm text-white font-mono">{ssl.protocol}</span>
          </div>
        )}

        {/* Issuer */}
        {ssl.issuer && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">Issuer</span>
            <span className="text-sm text-white truncate ml-4 max-w-[200px]">{ssl.issuer}</span>
          </div>
        )}

        {/* Expiry */}
        {ssl.expiryDate && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">Expires</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className={`text-sm ${
                ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30
                  ? 'text-yellow-400'
                  : 'text-white'
              }`}>
                {new Date(ssl.expiryDate).toLocaleDateString()}
                {ssl.daysUntilExpiry !== null && (
                  <span className="text-xs text-slate-500 ml-1">({ssl.daysUntilExpiry} days)</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {ssl.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-300">{ssl.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
