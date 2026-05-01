'use client';

interface RiskBadgeProps {
  riskLevel: string;
}

export function RiskBadge({ riskLevel }: RiskBadgeProps) {
  const getStyles = () => {
    switch (riskLevel) {
      case 'Low Risk':
        return {
          bg: 'bg-green-500/10',
          text: 'text-green-400',
          border: 'border-green-500/20',
          dot: 'bg-green-400',
        };
      case 'Medium Risk':
        return {
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-400',
          border: 'border-yellow-500/20',
          dot: 'bg-yellow-400',
        };
      case 'High Risk':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-500/20',
          dot: 'bg-red-400',
        };
      default:
        return {
          bg: 'bg-slate-500/10',
          text: 'text-slate-400',
          border: 'border-slate-500/20',
          dot: 'bg-slate-400',
        };
    }
  };

  const styles = getStyles();

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${styles.bg} ${styles.text} ${styles.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {riskLevel}
    </span>
  );
}
