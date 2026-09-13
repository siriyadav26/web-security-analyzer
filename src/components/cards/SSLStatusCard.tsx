'use client';

import { motion } from 'framer-motion';
import { Lock, Unlock, AlertTriangle, Check, X, Clock, ShieldAlert, ShieldCheck, ArrowRight, Eye } from 'lucide-react';
import type { SSLResult } from '@/lib/analyzer/types';

interface SSLStatusCardProps {
  ssl: SSLResult;
}

export function SSLStatusCard({ ssl }: SSLStatusCardProps) {
  // Determine SSL status more precisely
  let statusLabel: string;
  let statusColor: string;
  let StatusIcon: typeof Lock;

  const hasUntrustedTLS = !ssl.enabled && ssl.protocol !== null;

  if (!ssl.enabled && !hasUntrustedTLS) {
    // Truly no HTTPS at all (no TLS server on port 443)
    statusLabel = 'No HTTPS';
    statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    StatusIcon = Unlock;
  } else if (!ssl.enabled && hasUntrustedTLS) {
    // HTTPS exists but certificate is not trusted
    statusLabel = ssl.certIssue === 'self-signed' ? 'Self-Signed' :
                 ssl.certIssue === 'expired' ? 'Expired' :
                 ssl.certIssue === 'hostname-mismatch' ? 'Hostname Mismatch' :
                 'Untrusted HTTPS';
    statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    StatusIcon = ShieldAlert;
  } else if (!ssl.httpsVerified) {
    // HTTPS enabled but certificate verification failed
    statusLabel = ssl.certIssue === 'self-signed' ? 'Self-Signed' :
                 ssl.certIssue === 'expired' ? 'Expired' :
                 ssl.certIssue === 'hostname-mismatch' ? 'Hostname Mismatch' :
                 'Untrusted';
    statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    StatusIcon = ShieldAlert;
  } else if (!ssl.trusted) {
    statusLabel = 'Invalid';
    statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    StatusIcon = ShieldAlert;
  } else if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 30) {
    statusLabel = 'Expiring Soon';
    statusColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    StatusIcon = AlertTriangle;
  } else {
    statusLabel = 'Secure';
    statusColor = 'bg-green-500/10 text-green-400 border-green-500/20';
    StatusIcon = ShieldCheck;
  }

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${
            !ssl.enabled && !hasUntrustedTLS ? 'text-red-400' :
            !ssl.enabled && hasUntrustedTLS ? 'text-orange-400' :
            !ssl.trusted ? 'text-red-400' :
            ssl.valid ? 'text-green-400' : 'text-yellow-400'
          }`} />
          <h3 className="font-semibold text-white">SSL/TLS Status</h3>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* SSL Details */}
      <div className="space-y-3">
        {/* HTTPS Status (Strict Verification) */}
        <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-sm text-slate-400">HTTPS Verified</span>
          <div className="flex items-center gap-1.5">
            {ssl.httpsVerified ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : hasUntrustedTLS ? (
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm ${
              ssl.httpsVerified ? 'text-green-400' : 
              hasUntrustedTLS ? 'text-orange-400' : 'text-red-400'
            }`}>
              {ssl.httpsVerified ? 'Yes' : hasUntrustedTLS ? 'Present (untrusted)' : 'No'}
            </span>
          </div>
        </div>

        {/* HTTPS Enabled (can TLS connect at all?) */}
        {!ssl.enabled && ssl.protocol && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">TLS Server Detected</span>
            <span className="text-sm text-yellow-400">Yes (untrusted)</span>
          </div>
        )}

        {/* Certificate Trust */}
        {ssl.enabled && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">Certificate Trusted</span>
            <div className="flex items-center gap-1.5">
              {ssl.trusted ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm ${ssl.trusted ? 'text-green-400' : 'text-red-400'}`}>
                {ssl.trusted ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}

        {/* Certificate Validity */}
        {ssl.enabled && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">Certificate Valid</span>
            <div className="flex items-center gap-1.5">
              {ssl.valid ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm ${ssl.valid ? 'text-green-400' : 'text-red-400'}`}>
                {ssl.valid ? 'Valid' : ssl.certIssue || 'Invalid'}
              </span>
            </div>
          </div>
        )}

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

        {/* HTTP→HTTPS Redirect */}
        {ssl.httpToHttpsRedirect !== null && (
          <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-sm text-slate-400">HTTP→HTTPS Redirect</span>
            <div className="flex items-center gap-1.5">
              {ssl.httpToHttpsRedirect ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <ArrowRight className="w-4 h-4 text-yellow-400" />
              )}
              <span className={`text-sm ${ssl.httpToHttpsRedirect ? 'text-green-400' : 'text-yellow-400'}`}>
                {ssl.httpToHttpsRedirect ? 'Yes' : 'No'}
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
