'use client';

import { useSyncExternalStore, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppView } from '@/lib/store';

function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// Seeded PRNG for deterministic values (avoids hydration mismatch)
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface SecurityBackground3DProps {
  view: AppView;
}

/* ============================================================
   AUTH BACKGROUND — Giant rotating shield + lock matrix
   ============================================================ */
function AuthBackground() {
  // Pre-generate lock positions deterministically
  const locks = useMemo(() => {
    const rand = seededRandom(101);
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: 8 + (i % 5) * 20 + rand() * 6,
      top: 5 + Math.floor(i / 5) * 16 + rand() * 4,
      duration1: 6 + (i % 5) * 0.5,
      duration2: 20 + (i % 5) * 2,
      duration3: 4,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Giant rotating shield center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{
            rotateY: [0, 360],
            rotateX: [0, 15, 0, -15, 0],
          }}
          transition={{
            rotateY: { duration: 40, repeat: Infinity, ease: 'linear' },
            rotateX: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformStyle: 'preserve-3d', perspective: '1200px' }}
          className="opacity-[0.06]"
        >
          <svg width="700" height="800" viewBox="0 0 24 28" fill="none">
            <path
              d="M12 2L3 7v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
              stroke="#22D3EE"
              strokeWidth="0.8"
              fill="rgba(34,211,238,0.03)"
            />
            <path
              d="M12 8a3 3 0 00-3 3v2h6v-2a3 3 0 00-3-3z"
              stroke="#3B82F6"
              strokeWidth="0.5"
              fill="rgba(59,130,246,0.05)"
            />
          </svg>
        </motion.div>
      </div>

      {/* Lock matrix - rows of floating locks */}
      {locks.map((lock) => (
        <motion.div
          key={`lock-${lock.id}`}
          className="absolute"
          style={{ left: `${lock.left}%`, top: `${lock.top}%` }}
          animate={{
            y: [0, -15 - (lock.id % 3) * 5, 0],
            rotateY: [0, 180, 360],
            opacity: [0.03, 0.06, 0.03],
          }}
          transition={{
            y: { duration: lock.duration1, repeat: Infinity, ease: 'easeInOut', delay: (lock.id % 5) * 0.3 },
            rotateY: { duration: lock.duration2, repeat: Infinity, ease: 'linear' },
            opacity: { duration: lock.duration3, repeat: Infinity, ease: 'easeInOut', delay: lock.id * 0.2 },
          }}
        >
          <svg width="40" height="50" viewBox="0 0 24 30" fill="none" className="opacity-40">
            <rect x="3" y="14" width="18" height="12" rx="2" stroke="#3B82F6" strokeWidth="1" fill="rgba(59,130,246,0.1)" />
            <path d="M8 14V10a4 4 0 018 0v4" stroke="#22D3EE" strokeWidth="1" fill="none" />
          </svg>
        </motion.div>
      ))}

      {/* Pulsing security rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyber-cyan/20"
          style={{ width: 300 + i * 200, height: 300 + i * 200 }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.12, 0.05],
            rotateX: [0, 30, 0],
          }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
        />
      ))}

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(90deg, #3B82F6 1px, transparent 1px), linear-gradient(0deg, #3B82F6 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }} />
    </div>
  );
}

/* ============================================================
   LANDING BACKGROUND — 3D globe network with data nodes
   ============================================================ */
function LandingBackground() {
  const nodes = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const phi = Math.acos(-1 + (2 * i) / 20);
      const theta = Math.sqrt(20 * Math.PI) * phi;
      const r = 280;
      return {
        id: i,
        x: r * Math.cos(theta) * Math.sin(phi),
        y: r * Math.sin(theta) * Math.sin(phi),
        z: r * Math.cos(phi),
      };
    });
  }, []);

  // Pre-calculate connection line positions
  const connections = useMemo(() => {
    return nodes.slice(0, 10).map((node, i) => {
      const next = nodes[(i + 1) % 10];
      return {
        id: i,
        x1: 300 + node.x * 0.5,
        y1: 300 + node.y * 0.5,
        x2: 300 + next.x * 0.5,
        y2: 300 + next.y * 0.5,
      };
    });
  }, [nodes]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* 3D Rotating Globe */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ perspective: '1200px' }}>
        <motion.div
          animate={{ rotateY: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Globe wireframe circles */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`globe-circle-${i}`}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                width: 560,
                height: 560,
                borderColor: `rgba(34, 211, 238, ${0.06 + i * 0.01})`,
                transform: `rotateX(${i * 22.5}deg) rotateY(${i * 15}deg)`,
              }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
            />
          ))}

          {/* Network nodes on globe */}
          {nodes.map((node) => (
            <motion.div
              key={`node-${node.id}`}
              className="absolute rounded-full"
              style={{
                width: 6,
                height: 6,
                left: '50%',
                top: '50%',
                transform: `translate3d(${node.x}px, ${node.y}px, ${node.z}px)`,
                background: node.z > 0 ? 'rgba(34, 211, 238, 0.5)' : 'rgba(59, 130, 246, 0.2)',
                boxShadow: node.z > 0 ? '0 0 8px rgba(34, 211, 238, 0.4)' : 'none',
              }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{
                duration: 2 + (node.id % 3),
                repeat: Infinity,
                ease: 'easeInOut',
                delay: node.id * 0.15,
              }}
            />
          ))}

          {/* Connection lines (static SVG lines, no framer-motion on SVG elements) */}
          <svg width="600" height="600" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
            {connections.map((conn) => (
              <line
                key={`conn-${conn.id}`}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke="#3B82F6"
                strokeWidth="0.5"
              />
            ))}
          </svg>
        </motion.div>
      </div>

      {/* Floating data packets */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`packet-${i}`}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            background: 'rgba(59, 130, 246, 0.4)',
            boxShadow: '0 0 6px rgba(59, 130, 246, 0.3)',
            left: `${10 + (i * 12) % 80}%`,
            top: `${20 + (i * 17) % 60}%`,
          }}
          animate={{
            x: [0, 100 + i * 30, 0],
            y: [0, -50 + i * 10, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
        />
      ))}

      {/* Hexagonal grid overlay (static SVG) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
        <defs>
          <pattern id="hexGrid" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,0 60,15 60,37 30,52 0,37 0,15" fill="none" stroke="#3B82F6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexGrid)" />
      </svg>

      {/* Large corner shields */}
      <motion.div
        className="absolute -top-20 -left-20 opacity-[0.04]"
        animate={{ rotateZ: [0, 5, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="300" height="350" viewBox="0 0 24 28" fill="none">
          <path d="M12 2L3 7v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
            stroke="#22D3EE" strokeWidth="0.3" fill="rgba(34,211,238,0.02)" />
        </svg>
      </motion.div>
      <motion.div
        className="absolute -bottom-20 -right-20 opacity-[0.04]"
        animate={{ rotateZ: [0, -5, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="300" height="350" viewBox="0 0 24 28" fill="none">
          <path d="M12 2L3 7v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
            stroke="#3B82F6" strokeWidth="0.3" fill="rgba(59,130,246,0.02)" />
        </svg>
      </motion.div>
    </div>
  );
}

/* ============================================================
   LOADING BACKGROUND — 3D Radar scanner + data streams
   ============================================================ */
function LoadingBackground() {
  // Pre-generate binary streams deterministically
  const streams = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: 5 + i * 10,
      text: Array.from({ length: 40 }, () => rand() > 0.5 ? '1' : '0').join(' '),
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Giant radar scanner center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ perspective: '800px' }}>
        <motion.div
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateX: [60, 60] }}
        >
          {/* Radar circles */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={`radar-ring-${i}`}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                width: 120 + i * 100,
                height: 120 + i * 100,
                borderColor: `rgba(34, 211, 238, ${0.08 - i * 0.01})`,
              }}
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
            />
          ))}

          {/* Radar sweep beam */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 500, height: 500, transformStyle: 'preserve-3d' }}
            animate={{ rotateZ: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute top-1/2 left-1/2 origin-left"
              style={{
                width: '50%',
                height: '2px',
                background: 'linear-gradient(90deg, rgba(34, 211, 238, 0.6), transparent)',
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.3)',
              }}
            />
            <div
              className="absolute top-1/2 left-1/2 origin-left"
              style={{
                width: '50%',
                height: '80px',
                marginTop: '-40px',
                background: 'linear-gradient(90deg, rgba(34, 211, 238, 0.08), transparent)',
                clipPath: 'polygon(0 50%, 100% 0%, 100% 100%)',
              }}
            />
          </motion.div>

          {/* Center dot */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyber-cyan/50"
            animate={{
              scale: [1, 1.5, 1],
              boxShadow: ['0 0 10px rgba(34,211,238,0.3)', '0 0 30px rgba(34,211,238,0.6)', '0 0 10px rgba(34,211,238,0.3)'],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>

      {/* Data streams - vertical falling binary (deterministic) */}
      {streams.map((stream) => (
        <motion.div
          key={`stream-${stream.id}`}
          className="absolute font-mono text-xs text-cyber-cyan/[0.07]"
          style={{
            left: `${stream.left}%`,
            top: 0,
            writingMode: 'vertical-lr',
            letterSpacing: '0.3em',
          }}
          animate={{ y: ['0vh', '100vh'] }}
          transition={{
            duration: 8 + stream.id * 0.5,
            repeat: Infinity,
            ease: 'linear',
            delay: stream.id * 0.6,
          }}
        >
          {stream.text}
        </motion.div>
      ))}

      {/* Scanning pulse rings from center */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`pulse-ring-${i}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyber-cyan/30"
          animate={{ scale: [0.5, 3], opacity: [0.4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: i * 1 }}
        />
      ))}

      {/* Floating scan targets */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`target-${i}`}
          className="absolute"
          style={{ left: `${15 + i * 18}%`, top: `${20 + (i * 13) % 60}%` }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        >
          <svg width="50" height="50" viewBox="0 0 50 50" fill="none" className="opacity-40">
            <circle cx="25" cy="25" r="20" stroke="#22D3EE" strokeWidth="0.5" />
            <circle cx="25" cy="25" r="12" stroke="#22D3EE" strokeWidth="0.5" />
            <circle cx="25" cy="25" r="4" stroke="#3B82F6" strokeWidth="0.5" fill="rgba(59,130,246,0.1)" />
            <line x1="25" y1="0" x2="25" y2="50" stroke="#22D3EE" strokeWidth="0.3" />
            <line x1="0" y1="25" x2="50" y2="25" stroke="#22D3EE" strokeWidth="0.3" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

/* ============================================================
   DASHBOARD BACKGROUND — 3D data matrix + flowing streams
   ============================================================ */
function DashboardBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* 3D Rotating data cube */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ perspective: '1000px' }}>
        <motion.div
          animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
          transition={{
            rotateX: { duration: 30, repeat: Infinity, ease: 'linear' },
            rotateY: { duration: 45, repeat: Infinity, ease: 'linear' },
          }}
          style={{ transformStyle: 'preserve-3d' }}
          className="opacity-[0.04]"
        >
          {[
            { transform: 'translateZ(200px)', bg: 'rgba(34,211,238,0.03)' },
            { transform: 'translateZ(-200px) rotateY(180deg)', bg: 'rgba(59,130,246,0.03)' },
            { transform: 'translateX(200px) rotateY(90deg)', bg: 'rgba(168,85,247,0.03)' },
            { transform: 'translateX(-200px) rotateY(-90deg)', bg: 'rgba(34,197,94,0.03)' },
            { transform: 'translateY(-200px) rotateX(90deg)', bg: 'rgba(250,204,21,0.03)' },
            { transform: 'translateY(200px) rotateX(-90deg)', bg: 'rgba(239,68,68,0.03)' },
          ].map((face, i) => (
            <div
              key={`cube-face-${i}`}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border"
              style={{
                width: 400,
                height: 400,
                transform: face.transform,
                transformStyle: 'preserve-3d',
                background: face.bg,
                borderColor: 'rgba(34, 211, 238, 0.15)',
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* Data flow streams - horizontal */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`hstream-${i}`}
          className="absolute h-px"
          style={{
            top: `${15 + i * 15}%`,
            left: 0, right: 0,
            background: `linear-gradient(90deg, transparent 0%, rgba(34,211,238,${0.03 + i * 0.01}) 30%, rgba(59,130,246,${0.03 + i * 0.01}) 70%, transparent 100%)`,
          }}
          animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [0.8, 1, 0.8] }}
          transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        />
      ))}

      {/* Data flow streams - vertical */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={`vstream-${i}`}
          className="absolute w-px"
          style={{
            left: `${20 + i * 20}%`,
            top: 0, bottom: 0,
            background: `linear-gradient(0deg, transparent 0%, rgba(59,130,246,${0.02 + i * 0.01}) 30%, rgba(34,211,238,${0.02 + i * 0.01}) 70%, transparent 100%)`,
          }}
          animate={{ opacity: [0.2, 0.6, 0.2], scaleY: [0.8, 1, 0.8] }}
          transition={{ duration: 5 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
        />
      ))}

      {/* Floating data nodes */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={`dnode-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            left: `${8 + (i * 8) % 85}%`,
            top: `${10 + (i * 12) % 80}%`,
            background: i % 3 === 0 ? 'rgba(34,211,238,0.3)' : i % 3 === 1 ? 'rgba(59,130,246,0.3)' : 'rgba(168,85,247,0.3)',
            boxShadow: `0 0 6px ${i % 3 === 0 ? 'rgba(34,211,238,0.2)' : i % 3 === 1 ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'}`,
          }}
          animate={{ y: [0, -20 + i * 2, 0], x: [0, 10 - i, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 5 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
        />
      ))}

      {/* Dashboard grid */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'linear-gradient(90deg, #22D3EE 1px, transparent 1px), linear-gradient(0deg, #22D3EE 1px, transparent 1px)',
        backgroundSize: '100px 100px',
      }} />
    </div>
  );
}

/* ============================================================
   HISTORY BACKGROUND — 3D archive timeline + floating docs
   ============================================================ */
function HistoryBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* 3D Rotating archive cylinder */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ perspective: '1000px' }}>
        <motion.div
          animate={{ rotateX: [15, 15], rotateY: [0, 360] }}
          transition={{ rotateY: { duration: 50, repeat: Infinity, ease: 'linear' } }}
          style={{ transformStyle: 'preserve-3d' }}
          className="opacity-[0.03]"
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`cyl-ring-${i}`}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                width: 400, height: 400,
                transform: `translateY(${-200 + i * 45}px) rotateX(90deg)`,
                borderColor: 'rgba(34, 211, 238, 0.3)',
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* Timeline line */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 w-px top-0 bottom-0"
        style={{
          background: 'linear-gradient(0deg, transparent, rgba(59,130,246,0.08) 20%, rgba(34,211,238,0.08) 80%, transparent)',
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Timeline dots */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`timeline-dot-${i}`}
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
          style={{ top: `${10 + i * 11}%` }}
          animate={{
            scale: [1, 1.5, 1],
            boxShadow: ['0 0 4px rgba(34,211,238,0.2)', '0 0 12px rgba(34,211,238,0.5)', '0 0 4px rgba(34,211,238,0.2)'],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        >
          <div className="w-full h-full rounded-full bg-cyber-cyan/20" />
        </motion.div>
      ))}

      {/* Floating document shapes */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`doc-${i}`}
          className="absolute"
          style={{ left: `${10 + (i * 15) % 80}%`, top: `${10 + (i * 18) % 70}%` }}
          animate={{
            y: [0, -25 + i * 3, 0],
            rotateY: [0, 15, -15, 0],
            rotateX: [0, 5, -5, 0],
            opacity: [0.04, 0.08, 0.04],
          }}
          transition={{ duration: 7 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
        >
          <svg width="60" height="80" viewBox="0 0 60 80" fill="none" className="opacity-50">
            <rect x="5" y="5" width="50" height="70" rx="3" stroke="#3B82F6" strokeWidth="0.8" fill="rgba(59,130,246,0.03)" />
            <line x1="15" y1="20" x2="45" y2="20" stroke="#22D3EE" strokeWidth="0.5" opacity="0.5" />
            <line x1="15" y1="30" x2="40" y2="30" stroke="#22D3EE" strokeWidth="0.5" opacity="0.4" />
            <line x1="15" y1="40" x2="42" y2="40" stroke="#22D3EE" strokeWidth="0.5" opacity="0.3" />
            <line x1="15" y1="50" x2="35" y2="50" stroke="#22D3EE" strokeWidth="0.5" opacity="0.2" />
          </svg>
        </motion.div>
      ))}

      {/* Archive grid */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'linear-gradient(90deg, #3B82F6 1px, transparent 1px), linear-gradient(0deg, #3B82F6 1px, transparent 1px)',
        backgroundSize: '120px 120px',
      }} />
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT — Routes to the correct background
   ============================================================ */
export function SecurityBackground3D({ view }: SecurityBackground3DProps) {
  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(90deg, #3B82F6 1px, transparent 1px), linear-gradient(0deg, #3B82F6 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      >
        {view === 'auth' && <AuthBackground />}
        {view === 'landing' && <LandingBackground />}
        {view === 'loading' && <LoadingBackground />}
        {view === 'dashboard' && <DashboardBackground />}
        {view === 'history' && <HistoryBackground />}
      </motion.div>
    </AnimatePresence>
  );
}
