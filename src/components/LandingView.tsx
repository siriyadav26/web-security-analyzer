'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Search, AlertTriangle, Globe, Zap, Server, Lock, Eye } from 'lucide-react';
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
    if (e.key === 'Enter') handleAnalyze();
  };

  const features = [
    { icon: Shield, title: 'Security Headers', desc: 'CSP, HSTS, X-Frame-Options & more', color: '#3B82F6' },
    { icon: Lock, title: 'SSL/TLS Check', desc: 'Certificate validity & encryption', color: '#22D3EE' },
    { icon: Server, title: 'Port Scanning', desc: 'HTTP, HTTPS, FTP, SSH detection', color: '#a855f7' },
    { icon: Eye, title: 'Vulnerability Scan', desc: 'Detect security weaknesses', color: '#22C55E' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-center max-w-3xl mx-auto mb-12"
      >
        {/* Animated 3D Shield */}
        <div className="flex justify-center mb-8">
          <motion.div
            animate={{
              y: [-5, 5, -5],
              rotateY: [0, 10, 0, -10, 0],
              filter: [
                'drop-shadow(0 0 20px rgba(34, 211, 238, 0.3))',
                'drop-shadow(0 0 40px rgba(34, 211, 238, 0.6))',
                'drop-shadow(0 0 20px rgba(34, 211, 238, 0.3))',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
            className="relative"
          >
            <Shield className="w-20 h-20 text-cyber-cyan" />
            {/* Orbiting ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0"
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyber-blue"
                style={{ boxShadow: '0 0 10px #3B82F6' }} />
            </motion.div>
          </motion.div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
        >
          Analyze Your Website{' '}
          <span className="gradient-text">Security</span>{' '}
          Instantly
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg text-slate-400 max-w-xl mx-auto"
        >
          Perform a comprehensive security analysis of any website. Check headers, SSL certificates, open ports, and vulnerability indicators in seconds.
        </motion.p>
      </motion.div>

      {/* URL Input Section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="w-full max-w-2xl mx-auto mb-10"
      >
        <div
          className={`relative rounded-2xl transition-all duration-500 ${
            isFocused ? 'cyber-glow' : 'glow-border'
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
            <motion.button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              whileHover={{ scale: 1.05, rotateX: 3 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              style={{
                background: url.trim()
                  ? 'linear-gradient(135deg, #3B82F6, #22D3EE)'
                  : 'rgba(255,255,255,0.1)',
                boxShadow: url.trim() ? '0 4px 20px rgba(59, 130, 246, 0.3)' : 'none',
              }}
            >
              <Search className="w-4 h-4" />
              <span>Analyze</span>
            </motion.button>
          </div>
        </div>

        {/* Error */}
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

      {/* Feature Cards with 3D hover */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto w-full"
      >
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20, rotateX: 15 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
            whileHover={{
              scale: 1.05,
              rotateY: 5,
              rotateX: -3,
              transition: { duration: 0.2 },
            }}
            className="glass-card p-5 text-center cursor-default group relative overflow-hidden"
            style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
          >
            {/* Glow accent */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ background: feature.color, boxShadow: `0 0 20px ${feature.color}` }}
            />
            <feature.icon className="w-6 h-6 mx-auto mb-3 transition-colors" style={{ color: feature.color }} />
            <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
            <p className="text-xs text-slate-500">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Stats Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="mt-16 flex items-center gap-8 text-center"
      >
        {[
          { value: '7+', label: 'Security Headers' },
          { value: '4', label: 'Port Checks' },
          { value: '0-100', label: 'Risk Score' },
        ].map((stat, i) => (
          <div key={i}>
            <div className="text-xl font-bold gradient-text">{stat.value}</div>
            <div className="text-xs text-slate-600">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
