'use client';

import { motion } from 'framer-motion';

interface ScoreCircleProps {
  score: number;
  riskLevel: string;
}

export function ScoreCircle({ score, riskLevel }: ScoreCircleProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 50) return '#FACC15';
    return '#EF4444';
  };

  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 58; // radius = 58
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
      <motion.svg
        className="w-full h-full -rotate-90 score-circle"
        viewBox="0 0 128 128"
      >
        {/* Background circle */}
        <circle
          cx="64"
          cy="64"
          r="58"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        {/* Score arc */}
        <motion.circle
          cx="64"
          cy="64"
          r="58"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
        {/* Glow effect */}
        <motion.circle
          cx="64"
          cy="64"
          r="58"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ filter: 'blur(8px)', opacity: 0.3 }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
      </motion.svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl sm:text-4xl font-bold"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-slate-500 mt-1">/ 100</span>
      </div>
    </div>
  );
}
