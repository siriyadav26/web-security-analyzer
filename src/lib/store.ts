import { create } from 'zustand';
import type { AnalysisResult } from '@/lib/analyzer/types';

export type AppView = 'auth' | 'landing' | 'loading' | 'dashboard' | 'history';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AppState {
  // Navigation
  view: AppView;

  // Auth
  isAuthenticated: boolean;
  user: { id: string; email: string; name: string } | null;

  // Analysis
  url: string;
  result: AnalysisResult | null;
  history: AnalysisResult[];
  loadingStep: number;
  error: string | null;

  // Chatbot
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  // Setters
  setView: (view: AppView) => void;
  setAuthenticated: (auth: boolean, user?: { id: string; email: string; name: string } | null) => void;
  setUrl: (url: string) => void;
  setResult: (result: AnalysisResult | null) => void;
  setHistory: (history: AnalysisResult[]) => void;
  setLoadingStep: (step: number) => void;
  setError: (error: string | null) => void;
  setChatOpen: (open: boolean) => void;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  startAnalysis: (url: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  deleteScan: (id: string) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
  clearChat: () => void;
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
  view: 'auth',
  isAuthenticated: false,
  user: null,
  url: '',
  result: null,
  history: [],
  loadingStep: 0,
  error: null,
  chatOpen: false,
  chatMessages: [],
  chatLoading: false,

  setView: (view) => set({ view }),
  setAuthenticated: (auth, user) => set({ isAuthenticated: auth, user: user || null }),
  setUrl: (url) => set({ url }),
  setResult: (result) => set({ result }),
  setHistory: (history) => set({ history }),
  setLoadingStep: (step) => set({ loadingStep: step }),
  setError: (error) => set({ error }),
  setChatOpen: (open) => set({ chatOpen: open }),

  login: async (email: string, password: string) => {
    // Verify credentials via our custom API
    const verifyRes = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!verifyRes.ok) {
      const verifyData = await verifyRes.json().catch(() => ({ error: 'Invalid email or password' }));
      throw new Error(verifyData.error || 'Invalid email or password');
    }

    const verifyData = await verifyRes.json();

    // Fire-and-forget NextAuth session (don't block on it)
    import('next-auth/react')
      .then(({ signIn }) => signIn('credentials', { email, password, redirect: false }))
      .catch(() => {});

    set({
      isAuthenticated: true,
      user: {
        id: verifyData.user?.id || '',
        email: verifyData.user?.email || email,
        name: verifyData.user?.name || email.split('@')[0],
      },
      view: 'landing',
      error: null,
    });
  },

  signup: async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(data.error || 'Signup failed');
    }

    const data = await res.json();

    // Fire-and-forget NextAuth session
    import('next-auth/react')
      .then(({ signIn }) => signIn('credentials', { email, password, redirect: false }))
      .catch(() => {});

    set({
      isAuthenticated: true,
      user: { id: data.id, email: data.email, name: data.name },
      view: 'landing',
      error: null,
    });
  },

  logout: () => {
    import('next-auth/react').then(({ signOut }) => signOut({ redirect: false }));
    set({
      isAuthenticated: false,
      user: null,
      view: 'auth',
      result: null,
      history: [],
    });
  },

  startAnalysis: async (url: string) => {
    set({ view: 'loading', url, loadingStep: 0, error: null });

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

  sendChatMessage: async (message: string) => {
    const { chatMessages } = get();

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    set({
      chatMessages: [...chatMessages, userMsg],
      chatLoading: true,
    });

    try {
      const apiMessages = [...chatMessages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-reply`,
        role: 'assistant',
        content: data.reply || data.error || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
      };

      set({
        chatMessages: [...get().chatMessages, assistantMsg],
        chatLoading: false,
      });
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'I\'m experiencing technical difficulties. Please try again.',
        timestamp: new Date(),
      };

      set({
        chatMessages: [...get().chatMessages, errorMsg],
        chatLoading: false,
      });
    }
  },

  clearChat: () => set({ chatMessages: [] }),
}));

export { LOADING_STEPS };
