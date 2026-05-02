'use client';

import { useSyncExternalStore, useMemo, useEffect, useState, useCallback, useRef } from 'react';
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

// Scroll position hook for parallax
function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return scrollY;
}

interface SecurityBackground3DProps {
  view: AppView;
}

/* ============================================================
   CIRCUIT BOARD — Scrolling motherboard traces with glowing nodes
   ============================================================ */
function CircuitBoard() {
  const scrollY = useScrollY();
  const rand = useMemo(() => seededRandom(77), []);

  const traces = useMemo(() => {
    const r = seededRandom(33);
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x1: r() * 100,
      y1: r() * 100,
      x2: r() * 100,
      y2: r() * 100,
      midX: r() * 100,
      delay: r() * 5,
      duration: 3 + r() * 4,
    }));
  }, []);

  const nodes = useMemo(() => {
    const r = seededRandom(55);
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: r() * 100,
      y: r() * 100,
      size: 2 + r() * 4,
      pulseSpeed: 2 + r() * 3,
      delay: r() * 3,
      brightness: 0.3 + r() * 0.5,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ transform: `translateY(${scrollY * 0.05}px)` }}>
      <svg className="absolute inset-0 w-full h-full" style={{ minHeight: '120vh' }}>
        <defs>
          <filter id="glow-circuit">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Circuit traces */}
        {traces.map((trace) => (
          <motion.path
            key={`trace-${trace.id}`}
            d={`M${trace.x1}% ${trace.y1}% Q${trace.midX}% ${trace.y1}% ${trace.midX}% ${trace.y2}% T${trace.x2}% ${trace.y2}%`}
            fill="none"
            stroke="rgba(34, 211, 238, 0.04)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 0.6, 0.3] }}
            transition={{ duration: trace.duration, repeat: Infinity, ease: 'easeInOut', delay: trace.delay }}
            filter="url(#glow-circuit)"
          />
        ))}
        {/* Glowing nodes */}
        {nodes.map((node) => (
          <motion.circle
            key={`cnode-${node.id}`}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r={node.size}
            fill={`rgba(34, 211, 238, ${node.brightness * 0.15})`}
            animate={{
              r: [node.size, node.size * 2, node.size],
              opacity: [0.3, 0.8, 0.3],
              fill: [
                `rgba(34, 211, 238, ${node.brightness * 0.15})`,
                `rgba(59, 130, 246, ${node.brightness * 0.25})`,
                `rgba(34, 211, 238, ${node.brightness * 0.15})`,
              ],
            }}
            transition={{ duration: node.pulseSpeed, repeat: Infinity, ease: 'easeInOut', delay: node.delay }}
          />
        ))}
      </svg>
    </div>
  );
}

/* ============================================================
   FLOATING PARTICLES — Cyber particles that scroll with parallax
   ============================================================ */
function FloatingParticles({ count = 40, speed = 1 }: { count?: number; speed?: number }) {
  const scrollY = useScrollY();
  const particles = useMemo(() => {
    const r = seededRandom(99);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: r() * 100,
      startY: -10 + r() * 120,
      size: 1 + r() * 3,
      speed: (3 + r() * 5) * speed,
      drift: -30 + r() * 60,
      parallax: 0.02 + r() * 0.15,
      hue: r() > 0.6 ? 'cyan' : r() > 0.3 ? 'blue' : 'purple',
      delay: r() * 8,
      opacity: 0.1 + r() * 0.4,
    }));
  }, [count, speed]);

  const colorMap: Record<string, { bg: string; glow: string }> = {
    cyan: { bg: 'rgba(34, 211, 238, 0.6)', glow: '0 0 8px rgba(34, 211, 238, 0.4)' },
    blue: { bg: 'rgba(59, 130, 246, 0.6)', glow: '0 0 8px rgba(59, 130, 246, 0.4)' },
    purple: { bg: 'rgba(168, 85, 247, 0.6)', glow: '0 0 8px rgba(168, 85, 247, 0.4)' },
  };

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={`particle-${p.id}`}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.startY}%`,
            width: p.size,
            height: p.size,
            background: colorMap[p.hue].bg,
            boxShadow: colorMap[p.hue].glow,
            transform: `translateY(${scrollY * p.parallax}px)`,
          }}
          animate={{
            y: [0, -80 * speed, 0],
            x: [0, p.drift, 0],
            opacity: [0, p.opacity, 0],
          }}
          transition={{
            duration: p.speed,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </>
  );
}

/* ============================================================
   DATA STREAM — Scrolling binary/hex data columns
   ============================================================ */
function DataStreams() {
  const scrollY = useScrollY();
  const streams = useMemo(() => {
    const r = seededRandom(42);
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: 3 + i * 8 + r() * 3,
      text: Array.from({ length: 60 }, () =>
        r() > 0.5 ? (r() > 0.5 ? '1' : '0') : (r() > 0.5 ? 'A' : 'F')
      ).join(' '),
      speed: 10 + r() * 12,
      delay: r() * 5,
      parallax: 0.03 + r() * 0.1,
      opacity: 0.03 + r() * 0.04,
    }));
  }, []);

  return (
    <>
      {streams.map((stream) => (
        <motion.div
          key={`dstream-${stream.id}`}
          className="absolute font-mono text-[10px] whitespace-nowrap select-none"
          style={{
            left: `${stream.left}%`,
            top: 0,
            writingMode: 'vertical-lr',
            letterSpacing: '0.25em',
            color: `rgba(34, 211, 238, ${stream.opacity})`,
            transform: `translateY(${scrollY * stream.parallax}px)`,
          }}
          animate={{ y: ['0vh', '-60vh'] }}
          transition={{
            duration: stream.speed,
            repeat: Infinity,
            ease: 'linear',
            delay: stream.delay,
          }}
        >
          {stream.text}
        </motion.div>
      ))}
    </>
  );
}

/* ============================================================
   SCROLLING GRID — Perspective grid that scrolls with depth
   ============================================================ */
function PerspectiveGrid() {
  const scrollY = useScrollY();

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        opacity: 0.025,
        transform: `translateY(${scrollY * 0.02}px) perspective(800px) rotateX(5deg)`,
        transformOrigin: 'center bottom',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(90deg, #22D3EE 1px, transparent 1px),
            linear-gradient(0deg, #22D3EE 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          minHeight: '150vh',
        }}
      />
    </div>
  );
}

/* ============================================================
   3D FLOATING SECURITY ICONS — Shields, Locks on platforms
   ============================================================ */
function FloatingSecurityIcons() {
  const scrollY = useScrollY();
  const icons = useMemo(() => {
    const r = seededRandom(202);
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 10 + r() * 80,
      y: 10 + r() * 80,
      type: i % 3, // 0 = shield, 1 = lock, 2 = fingerprint
      scale: 0.6 + r() * 0.8,
      parallax: 0.05 + r() * 0.2,
      rotDuration: 15 + r() * 25,
      floatDuration: 4 + r() * 3,
    }));
  }, []);

  return (
    <>
      {icons.map((icon) => (
        <motion.div
          key={`sec-icon-${icon.id}`}
          className="absolute"
          style={{
            left: `${icon.x}%`,
            top: `${icon.y}%`,
            transform: `translateY(${scrollY * icon.parallax}px)`,
            perspective: '600px',
          }}
          animate={{
            y: [0, -20, 0],
            rotateY: [0, 360],
          }}
          transition={{
            y: { duration: icon.floatDuration, repeat: Infinity, ease: 'easeInOut' },
            rotateY: { duration: icon.rotDuration, repeat: Infinity, ease: 'linear' },
          }}
        >
          <div style={{ opacity: 0.05, transform: `scale(${icon.scale})` }}>
            {icon.type === 0 && (
              <svg width="80" height="95" viewBox="0 0 24 28" fill="none">
                <path d="M12 2L3 7v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
                  stroke="#22D3EE" strokeWidth="1" fill="rgba(34,211,238,0.05)" />
              </svg>
            )}
            {icon.type === 1 && (
              <svg width="70" height="85" viewBox="0 0 24 30" fill="none">
                <rect x="3" y="14" width="18" height="12" rx="2" stroke="#3B82F6" strokeWidth="1" fill="rgba(59,130,246,0.05)" />
                <path d="M8 14V10a4 4 0 018 0v4" stroke="#22D3EE" strokeWidth="1" fill="none" />
              </svg>
            )}
            {icon.type === 2 && (
              <svg width="70" height="70" viewBox="0 0 24 24" fill="none">
                <path d="M12 10a2 2 0 012 2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2z" stroke="#22D3EE" strokeWidth="1" />
                <path d="M12 2C8 2 4 6 4 10c0 4 3 8 8 12 5-4 8-8 8-12 0-4-4-8-8-8z" stroke="#3B82F6" strokeWidth="0.8" fill="rgba(59,130,246,0.03)" />
              </svg>
            )}
          </div>
        </motion.div>
      ))}
    </>
  );
}

/* ============================================================
   HOLOGRAPHIC OVERLAY — Floating data readouts
   ============================================================ */
function HolographicOverlay() {
  const scrollY = useScrollY();
  const displays = useMemo(() => {
    const r = seededRandom(303);
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      x: r() > 0.5 ? 5 + r() * 20 : 70 + r() * 20,
      y: 15 + r() * 70,
      parallax: 0.04 + r() * 0.12,
      number: Math.floor(r() * 99999999).toString().padStart(8, '0'),
      label: ['ENCRYPTED', 'SECURE', 'VERIFIED', 'ACTIVE'][i],
      pulseSpeed: 3 + r() * 2,
    }));
  }, []);

  return (
    <>
      {displays.map((d) => (
        <motion.div
          key={`holo-${d.id}`}
          className="absolute"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            transform: `translateY(${scrollY * d.parallax}px)`,
          }}
          animate={{
            opacity: [0.03, 0.08, 0.03],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{ duration: d.pulseSpeed, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex flex-col items-end gap-0.5 select-none">
            <span className="font-mono text-[8px] tracking-[0.3em] text-cyan-400/40 uppercase">{d.label}</span>
            <span className="font-mono text-[10px] tracking-[0.15em] text-cyan-300/25">{d.number}</span>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
          </div>
        </motion.div>
      ))}
    </>
  );
}

/* ============================================================
   SCROLLING PULSE WAVES — Concentric rings that scroll
   ============================================================ */
function PulseWaves() {
  const scrollY = useScrollY();

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ transform: `translateY(${scrollY * 0.03}px)` }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={`pulse-wave-${i}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            width: 200 + i * 200,
            height: 200 + i * 200,
            borderColor: `rgba(34, 211, 238, ${0.04 - i * 0.008})`,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.7, 0.3],
            rotateX: [0, 25, 0],
          }}
          transition={{ duration: 5 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   AUTH BACKGROUND — Giant rotating shield + lock matrix + scrolling
   ============================================================ */
function AuthBackground() {
  const scrollY = useScrollY();

  const locks = useMemo(() => {
    const rand = seededRandom(101);
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: 8 + (i % 5) * 20 + rand() * 6,
      top: 5 + Math.floor(i / 5) * 16 + rand() * 4,
      duration1: 6 + (i % 5) * 0.5,
      duration2: 20 + (i % 5) * 2,
      duration3: 4,
      parallax: 0.02 + rand() * 0.15,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <CircuitBoard />
      <DataStreams />
      <PerspectiveGrid />
      <FloatingParticles count={25} />
      <HolographicOverlay />
      <PulseWaves />

      {/* Shield symbol directly behind the sign-in card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) translateY(${scrollY * 0.04}px)` }}>
        <motion.div
          animate={{
            rotateY: [0, 360],
            scale: [1, 1.03, 1],
          }}
          transition={{
            rotateY: { duration: 30, repeat: Infinity, ease: 'linear' },
            scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
        >
          <svg width="320" height="380" viewBox="0 0 24 28" fill="none" className="drop-shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <defs>
              <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.08)" />
                <stop offset="50%" stopColor="rgba(59,130,246,0.06)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.04)" />
              </linearGradient>
            </defs>
            <path
              d="M12 2L3 7v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
              stroke="rgba(34, 211, 238, 0.25)"
              strokeWidth="0.5"
              fill="url(#shield-grad)"
            />
            <path
              d="M12 8a3 3 0 00-3 3v2h6v-2a3 3 0 00-3-3z"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="0.3"
              fill="rgba(59,130,246,0.08)"
            />
          </svg>
        </motion.div>
      </div>

      {/* Giant rotating shield center with scroll parallax */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) translateY(${scrollY * 0.08}px)` }}>
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

      {/* Lock matrix with scroll parallax */}
      {locks.map((lock) => (
        <motion.div
          key={`lock-${lock.id}`}
          className="absolute"
          style={{ left: `${lock.left}%`, top: `${lock.top}%`, transform: `translateY(${scrollY * lock.parallax}px)` }}
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
          style={{ width: 300 + i * 200, height: 300 + i * 200, transform: `translate(-50%, -50%) translateY(${scrollY * 0.05}px)` }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.12, 0.05],
            rotateX: [0, 30, 0],
          }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   LANDING BACKGROUND — 3D globe network with data nodes + scrolling
   ============================================================ */
function LandingBackground() {
  const scrollY = useScrollY();

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
      <CircuitBoard />
      <DataStreams />
      <PerspectiveGrid />
      <FloatingParticles count={35} speed={1.2} />
      <FloatingSecurityIcons />
      <HolographicOverlay />

      {/* 3D Rotating Globe with scroll parallax */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: '1200px', transform: `translate(-50%, -50%) translateY(${scrollY * 0.06}px)` }}>
        <motion.div
          animate={{ rotateY: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
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

      {/* Large corner shields with scroll parallax */}
      <motion.div
        className="absolute -top-20 -left-20 opacity-[0.04]"
        style={{ transform: `translateY(${scrollY * 0.1}px)` }}
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
        style={{ transform: `translateY(${scrollY * 0.15}px)` }}
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
   LOADING BACKGROUND — 3D Radar scanner + scrolling data streams
   ============================================================ */
function LoadingBackground() {
  const scrollY = useScrollY();

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
      <CircuitBoard />
      <DataStreams />
      <PerspectiveGrid />
      <FloatingParticles count={30} speed={1.5} />

      {/* Giant radar scanner center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: '800px', transform: `translate(-50%, -50%) translateY(${scrollY * 0.05}px)` }}>
        <motion.div
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateX: [60, 60] }}
        >
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

      {/* Data streams with scroll parallax */}
      {streams.map((stream) => (
        <motion.div
          key={`stream-${stream.id}`}
          className="absolute font-mono text-xs text-cyber-cyan/[0.07]"
          style={{
            left: `${stream.left}%`,
            top: 0,
            writingMode: 'vertical-lr',
            letterSpacing: '0.3em',
            transform: `translateY(${scrollY * 0.05}px)`,
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
          style={{ transform: `translate(-50%, -50%) translateY(${scrollY * 0.04}px)` }}
          animate={{ scale: [0.5, 3], opacity: [0.4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: i * 1 }}
        />
      ))}

      {/* Floating scan targets with scroll parallax */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`target-${i}`}
          className="absolute"
          style={{ left: `${15 + i * 18}%`, top: `${20 + (i * 13) % 60}%`, transform: `translateY(${scrollY * (0.03 + i * 0.02)}px)` }}
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
   DASHBOARD BACKGROUND — 3D data matrix + scrolling streams
   ============================================================ */
function DashboardBackground() {
  const scrollY = useScrollY();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <CircuitBoard />
      <DataStreams />
      <PerspectiveGrid />
      <FloatingParticles count={30} />
      <FloatingSecurityIcons />
      <HolographicOverlay />

      {/* 3D Rotating data cube with scroll parallax */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: '1000px', transform: `translate(-50%, -50%) translateY(${scrollY * 0.06}px)` }}>
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

      {/* Data flow streams - horizontal with scroll parallax */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`hstream-${i}`}
          className="absolute h-px"
          style={{
            top: `${15 + i * 15}%`,
            left: 0, right: 0,
            background: `linear-gradient(90deg, transparent 0%, rgba(34,211,238,${0.03 + i * 0.01}) 30%, rgba(59,130,246,${0.03 + i * 0.01}) 70%, transparent 100%)`,
            transform: `translateY(${scrollY * (0.02 + i * 0.01)}px)`,
          }}
          animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [0.8, 1, 0.8] }}
          transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        />
      ))}

      {/* Data flow streams - vertical with scroll parallax */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={`vstream-${i}`}
          className="absolute w-px"
          style={{
            left: `${20 + i * 20}%`,
            top: 0, bottom: 0,
            background: `linear-gradient(0deg, transparent 0%, rgba(59,130,246,${0.02 + i * 0.01}) 30%, rgba(34,211,238,${0.02 + i * 0.01}) 70%, transparent 100%)`,
            transform: `translateX(${scrollY * 0.01}px)`,
          }}
          animate={{ opacity: [0.2, 0.6, 0.2], scaleY: [0.8, 1, 0.8] }}
          transition={{ duration: 5 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
        />
      ))}

      {/* Floating data nodes with scroll parallax */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={`dnode-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            left: `${8 + (i * 8) % 85}%`,
            top: `${10 + (i * 12) % 80}%`,
            background: i % 3 === 0 ? 'rgba(34,211,238,0.3)' : i % 3 === 1 ? 'rgba(59,130,246,0.3)' : 'rgba(168,85,247,0.3)',
            boxShadow: `0 0 6px ${i % 3 === 0 ? 'rgba(34,211,238,0.2)' : i % 3 === 1 ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'}`,
            transform: `translateY(${scrollY * (0.03 + (i % 4) * 0.02)}px)`,
          }}
          animate={{ y: [0, -20 + i * 2, 0], x: [0, 10 - i, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 5 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   HISTORY BACKGROUND — 3D archive timeline + scrolling docs
   ============================================================ */
function HistoryBackground() {
  const scrollY = useScrollY();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <CircuitBoard />
      <DataStreams />
      <PerspectiveGrid />
      <FloatingParticles count={20} speed={0.8} />
      <HolographicOverlay />

      {/* 3D Rotating archive cylinder with scroll parallax */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: '1000px', transform: `translate(-50%, -50%) translateY(${scrollY * 0.06}px)` }}>
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
          transform: `translateX(-50%) translateY(${scrollY * 0.02}px)`,
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Timeline dots with scroll parallax */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`timeline-dot-${i}`}
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
          style={{ top: `${10 + i * 11}%`, transform: `translate(-50%, 0) translateY(${scrollY * (0.02 + i * 0.01)}px)` }}
          animate={{
            scale: [1, 1.5, 1],
            boxShadow: ['0 0 4px rgba(34,211,238,0.2)', '0 0 12px rgba(34,211,238,0.5)', '0 0 4px rgba(34,211,238,0.2)'],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        >
          <div className="w-full h-full rounded-full bg-cyber-cyan/20" />
        </motion.div>
      ))}

      {/* Floating document shapes with scroll parallax */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`doc-${i}`}
          className="absolute"
          style={{
            left: `${10 + (i * 15) % 80}%`,
            top: `${10 + (i * 18) % 70}%`,
            transform: `translateY(${scrollY * (0.04 + i * 0.02)}px)`,
          }}
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
