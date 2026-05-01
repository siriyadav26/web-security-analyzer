'use client';

import { motion } from 'framer-motion';
import { Terminal, Loader2, Shield } from 'lucide-react';
import { useAppStore, LOADING_STEPS } from '@/lib/store';

export function LoadingView() {
  const { url, loadingStep } = useAppStore();
  const progress = ((loadingStep + 1) / LOADING_STEPS.length) * 100;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* 3D Floating shield above terminal */}
        <motion.div
          animate={{
            y: [-8, 8, -8],
            rotateY: [0, 360],
            rotateX: [0, 10, 0, -10, 0],
          }}
          transition={{
            y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            rotateY: { duration: 10, repeat: Infinity, ease: 'linear' },
            rotateX: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="flex justify-center mb-8"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
        >
          <div className="relative">
            <Shield className="w-16 h-16 text-cyber-cyan" />
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 w-16 h-16 border-2 border-cyber-cyan/30 rounded-full"
            />
          </div>
        </motion.div>

        {/* Terminal window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card overflow-hidden"
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
        >
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cyber-red/80" />
              <div className="w-3 h-3 rounded-full bg-cyber-yellow/80" />
              <div className="w-3 h-3 rounded-full bg-cyber-green/80" />
            </div>
            <div className="flex items-center gap-2 ml-3 text-xs text-slate-500">
              <Terminal className="w-3.5 h-3.5" />
              <span>security-analyzer</span>
            </div>
          </div>

          {/* Terminal body */}
          <div className="p-5 space-y-3 font-mono text-sm min-h-[280px]">
            <div className="text-slate-500">
              <span className="text-cyber-cyan">$</span> analyzing <span className="text-cyber-blue">{url}</span>
            </div>

            <div className="space-y-2 mt-4">
              {LOADING_STEPS.map((step, index) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: index <= loadingStep ? 1 : 0.3,
                    x: 0,
                  }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-center gap-2"
                >
                  {index < loadingStep ? (
                    <span className="text-cyber-green text-xs">✔</span>
                  ) : index === loadingStep ? (
                    <Loader2 className="w-3.5 h-3.5 text-cyber-cyan animate-spin" />
                  ) : (
                    <span className="text-slate-700 text-xs">○</span>
                  )}
                  <span
                    className={`${
                      index < loadingStep
                        ? 'text-slate-400'
                        : index === loadingStep
                        ? 'text-white'
                        : 'text-slate-700'
                    }`}
                  >
                    {step}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Analyzing...</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              className="h-full rounded-full relative"
              style={{ background: 'linear-gradient(90deg, #3B82F6, #22D3EE)' }}
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* Glow on progress bar */}
              <div className="absolute right-0 top-0 h-full w-4 rounded-full"
                style={{ background: 'rgba(34, 211, 238, 0.6)', filter: 'blur(4px)' }} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
