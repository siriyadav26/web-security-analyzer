import { create } from 'zustand';
import type { AnalysisResult } from '@/lib/analyzer/types';

export type AppView = 'landing' | 'loading' | 'dashboard' | 'history';

interface AppState {
  view: AppView;
  url: string;
  result: AnalysisResult | null;
  history: AnalysisResult[];
  loadingStep: number;
  error: string | null;

  setView: (view: AppView) => void;
  setUrl: (url: string) => void;
  setResult: (result: AnalysisResult | null) => void;
  setHistory: (history: AnalysisResult[]) => void;
  setLoadingStep: (step: number) => void;
  setError: (error: string | null) => void;
  startAnalysis: (url: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  deleteScan: (id: string) => Promise<void>;
}

const LOADING_STEPS = [
  'Resolving DNS...',
  'Checking security headers...',
  'Validating SSL/TLS certificate...',
  'Scanning common ports...',
  'Analyzing vulnerabilities...',
  'Calculating risk score...',
  'Generating recommendations...',
];

export const useAppStore = create<AppState>((set, get) => ({
  view: 'landing',
  url: '',
  result: null,
  history: [],
  loadingStep: 0,
  error: null,

  setView: (view) => set({ view }),
  setUrl: (url) => set({ url }),
  setResult: (result) => set({ result }),
  setHistory: (history) => set({ history }),
  setLoadingStep: (step) => set({ loadingStep: step }),
  setError: (error) => set({ error }),

  startAnalysis: async (url: string) => {
    set({ view: 'loading', url, loadingStep: 0, error: null });

    // Simulate progress steps
    const stepInterval = setInterval(() => {
      const { loadingStep } = get();
      if (loadingStep < LOADING_STEPS.length - 1) {
        set({ loadingStep: loadingStep + 1 });
      }
    }, 800);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const result: AnalysisResult = await response.json();
      set({ result, view: 'dashboard', loadingStep: LOADING_STEPS.length - 1 });
    } catch (error: any) {
      clearInterval(stepInterval);
      set({ error: error.message, view: 'landing' });
    }
  },

  fetchHistory: async () => {
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        set({ history: data });
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  },

  deleteScan: async (id: string) => {
    try {
      const response = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        const { fetchHistory } = get();
        await fetchHistory();
      }
    } catch (error) {
      console.error('Failed to delete scan:', error);
    }
  },
}));

export { LOADING_STEPS };
