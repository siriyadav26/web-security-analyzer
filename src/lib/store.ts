import { create } from 'zustand';
import type { AnalysisResult } from '@/lib/analyzer/types';

export type AppView = 'auth' | 'landing' | 'loading' | 'dashboard' | 'history';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const CHAT_MESSAGE_LIMIT = 8; // Max user messages per conversation

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

  // Chatbot — Multi-conversation
  chatOpen: boolean;
  chatConversations: ChatConversation[];
  currentChatId: string | null;
  chatLoading: boolean;
  chatSidebarOpen: boolean;

  // Setters
  setView: (view: AppView) => void;
  setAuthenticated: (auth: boolean, user?: { id: string; email: string; name: string } | null) => void;
  setUrl: (url: string) => void;
  setResult: (result: AnalysisResult | null) => void;
  setHistory: (history: AnalysisResult[]) => void;
  setLoadingStep: (step: number) => void;
  setError: (error: string | null) => void;
  setChatOpen: (open: boolean) => void;
  setChatSidebarOpen: (open: boolean) => void;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  startAnalysis: (url: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  deleteScan: (id: string) => Promise<void>;

  // Chat actions
  createNewChat: () => string;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  renameChat: (id: string, title: string) => void;
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

function generateId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getUserMessageCount(messages: ChatMessage[]): number {
  return messages.filter(m => m.role === 'user').length;
}

function generateTitle(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 37) + '...';
}

// ─── localStorage persistence ───
function saveConversations(conversations: ChatConversation[]) {
  try {
    // Serialize dates to ISO strings for storage
    const serialized = conversations.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messages: c.messages.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    }));
    localStorage.setItem('securebot-conversations', JSON.stringify(serialized));
  } catch {
    // Silently fail — localStorage might be full or unavailable
  }
}

function loadConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem('securebot-conversations');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Deserialize ISO strings back to Date objects
    return parsed.map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      messages: (c.messages || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));
  } catch {
    return [];
  }
}

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
  chatConversations: loadConversations(),
  currentChatId: null,
  chatLoading: false,
  chatSidebarOpen: false,

  setView: (view) => set({ view }),
  setAuthenticated: (auth, user) => set({ isAuthenticated: auth, user: user || null }),
  setUrl: (url) => set({ url }),
  setResult: (result) => set({ result }),
  setHistory: (history) => set({ history }),
  setLoadingStep: (step) => set({ loadingStep: step }),
  setError: (error) => set({ error }),
  setChatOpen: (open) => set({ chatOpen: open }),
  setChatSidebarOpen: (open) => set({ chatSidebarOpen: open }),

  login: async (email: string, password: string) => {
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

    try {
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        console.warn('NextAuth session creation warning:', result.error);
      }
    } catch (e) {
      console.warn('NextAuth session could not be established:', e);
    }

    get().fetchHistory().catch(() => {});
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

    set({
      isAuthenticated: true,
      user: { id: data.id, email: data.email, name: data.name },
      view: 'landing',
      error: null,
    });

    try {
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        console.warn('NextAuth session creation warning:', result.error);
      }
    } catch (e) {
      console.warn('NextAuth session could not be established:', e);
    }

    get().fetchHistory().catch(() => {});
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

      const { fetchHistory } = get();
      fetchHistory().catch(() => {});

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

  // ─── Chat Conversation Actions ───

  createNewChat: () => {
    const id = generateId();
    const now = new Date();
    const newConv: ChatConversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newConv, ...get().chatConversations];
    set({
      chatConversations: updated,
      currentChatId: id,
    });
    saveConversations(updated);
    return id;
  },

  switchChat: (id: string) => {
    set({ currentChatId: id });
  },

  deleteChat: (id: string) => {
    const { chatConversations, currentChatId } = get();
    const updated = chatConversations.filter(c => c.id !== id);
    const newCurrentId = currentChatId === id
      ? (updated.length > 0 ? updated[0].id : null)
      : currentChatId;
    set({
      chatConversations: updated,
      currentChatId: newCurrentId,
    });
    saveConversations(updated);
  },

  renameChat: (id: string, title: string) => {
    const { chatConversations } = get();
    const updated = chatConversations.map(c =>
      c.id === id ? { ...c, title, updatedAt: new Date() } : c
    );
    set({ chatConversations: updated });
    saveConversations(updated);
  },

  sendChatMessage: async (message: string) => {
    const { chatConversations, currentChatId } = get();

    // Auto-create conversation if none exists
    let convId = currentChatId;
    if (!convId) {
      convId = get().createNewChat();
    }

    const conv = get().chatConversations.find(c => c.id === convId);
    if (!conv) return;

    // Check message limit
    if (getUserMessageCount(conv.messages) >= CHAT_MESSAGE_LIMIT) {
      return; // Don't send — limit reached
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    const updatedMessages = [...conv.messages, userMsg];

    // Auto-title on first message
    const isFirstMessage = conv.messages.length === 0;
    const newTitle = isFirstMessage ? generateTitle(message) : conv.title;

    const updatedConvs = get().chatConversations.map(c =>
      c.id === convId
        ? { ...c, messages: updatedMessages, title: newTitle, updatedAt: new Date() }
        : c
    );

    set({
      chatConversations: updatedConvs,
      chatLoading: true,
    });
    saveConversations(updatedConvs);

    try {
      // Send only last N messages to keep API payload reasonable
      const contextMessages = updatedMessages.slice(-16);
      const apiMessages = contextMessages.map(m => ({
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

      const finalConvs = get().chatConversations.map(c =>
        c.id === convId
          ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date() }
          : c
      );

      set({
        chatConversations: finalConvs,
        chatLoading: false,
      });
      saveConversations(finalConvs);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'I\'m experiencing technical difficulties. Please try again.',
        timestamp: new Date(),
      };

      const errorConvs = get().chatConversations.map(c =>
        c.id === convId
          ? { ...c, messages: [...c.messages, errorMsg], updatedAt: new Date() }
          : c
      );

      set({
        chatConversations: errorConvs,
        chatLoading: false,
      });
      saveConversations(errorConvs);
    }
  },

  clearChat: () => {
    const { chatConversations, currentChatId } = get();
    if (!currentChatId) return;

    const updated = chatConversations.map(c =>
      c.id === currentChatId
        ? { ...c, messages: [], title: 'New Chat', updatedAt: new Date() }
        : c
    );
    set({ chatConversations: updated });
    saveConversations(updated);
  },
}));

export { LOADING_STEPS, CHAT_MESSAGE_LIMIT };
