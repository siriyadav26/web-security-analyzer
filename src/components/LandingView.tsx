'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Search, AlertTriangle, Globe, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function LandingView() {
  const { startAnalysis, error } = useAppStore();
  const [url, setUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleAnalyze = () => {
    if (url.trim()) {
      startAnalysis(url.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-center max-w-3xl mx-auto mb-12"
      >
        {/* Animated shield icon */}
        <motion.div
          animate={{
            filter: [
              'drop-shadow(0 0 20px rgba(34, 211, 238, 0.3))',
              'drop-shadow(0 0 40px rgba(34, 211, 238, 0.5))',
              'drop-shadow(0 0 20px rgba(34, 211, 238, 0.3))',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="flex justify-center mb-6"
        >
          <Shield className="w-16 h-16 text-cyber-cyan" />
        </motion.div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
          Analyze Your Website{' '}
          <span className="gradient-text">Security</span>{' '}
          Instantly
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          Perform a comprehensive security analysis of any website. Check headers, SSL certificates, open ports, and vulnerability indicators in seconds.
        </p>
      </motion.div>

      {/* URL Input Section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="w-full max-w-2xl mx-auto mb-8"
      >
        <div
          className={`relative rounded-2xl transition-all duration-300 ${
            isFocused
              ? 'cyber-glow'
              : 'glow-border'
          }`}
        >
          <div className="flex items-center gap-3 p-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
            <div className="flex items-center gap-3 flex-1 pl-4">
              <Globe className="w-5 h-5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Enter website URL (e.g., example.com)"
                className="w-full bg-transparent text-white text-lg placeholder:text-slate-600 focus:outline-none py-3"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: url.trim()
                  ? 'linear-gradient(135deg, #3B82F6, #22D3EE)'
                  : 'rgba(255,255,255,0.1)',
              }}
            >
              <Search className="w-4 h-4" />
              <span>Analyze</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 text-cyber-red text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Feature Cards */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto w-full"
      >
        {[
          { icon: Shield, title: 'Security Headers', desc: 'CSP, HSTS, X-Frame-Options & more' },
          { icon: Zap, title: 'SSL/TLS Check', desc: 'Certificate validity & encryption' },
          { icon: Search, title: 'Port Scanning', desc: 'HTTP, HTTPS, FTP, SSH detection' },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
            className="glass-card p-4 text-center hover:border-cyber-blue/30 transition-colors"
          >
            <feature.icon className="w-6 h-6 text-cyber-cyan mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
            <p className="text-xs text-slate-500">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
