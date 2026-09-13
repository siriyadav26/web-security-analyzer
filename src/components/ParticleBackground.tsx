'use client';

import { useSyncExternalStore } from 'react';

// Hook to detect client-side mounting without triggering the lint rule
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},  // subscribe (no-op)
    () => true,       // getSnapshot (client)
    () => false       // getServerSnapshot
  );
}

// Seeded pseudo-random number generator for deterministic values
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Generate deterministic particles so server and client match
const rand = seededRandom(42);
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: rand() * 100,
  size: rand() * 3 + 1,
  duration: rand() * 15 + 10,
  delay: rand() * 10,
  opacity: rand() * 0.4 + 0.1,
}));

export function ParticleBackground() {
  const mounted = useHasMounted();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {mounted && PARTICLES.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      {/* Moving grid lines - static, no hydration issues */}
      <div className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(90deg, #3B82F6 1px, transparent 1px),
            linear-gradient(0deg, #3B82F6 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
