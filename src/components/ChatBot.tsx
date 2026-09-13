'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, X, Send, Bot, Trash2, Shield,
  Copy, Check, ChevronDown, Sparkles, Lock,
  Globe, FileCheck, Zap, Plus, PanelLeftClose,
  PanelLeft, Clock, MessageCircle, AlertCircle
} from 'lucide-react';
import { useAppStore, ChatMessage, ChatConversation, CHAT_MESSAGE_LIMIT } from '@/lib/store';

/* ── Simple Markdown-ish renderer ── */
function renderBotContent(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.match(/^\s*[-*•]\s+/)) {
      const content = line.replace(/^\s*[-*•]\s+/, '');
      elements.push(
        <div key={key++} className="flex gap-2 items-start ml-1">
          <span className="text-cyber-cyan/60 mt-0.5 shrink-0">•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      continue;
    }
    if (line.match(/^\s*\d+[.)]\s+/)) {
      const content = line.replace(/^\s*\d+[.)]\s+/, '');
      const num = line.trim().match(/^(\d+)/)?.[1] || '1';
      elements.push(
        <div key={key++} className="flex gap-2 items-start ml-1">
          <span className="text-cyber-blue/60 font-mono text-xs mt-0.5 shrink-0">{num}.</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      continue;
    }
    if (line.startsWith('```')) {
      elements.push(<div key={key++} className="h-1" />);
      continue;
    }
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }
    elements.push(<p key={key++}>{renderInline(line)}</p>);
  }
  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded text-[11px] font-mono text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/20">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/* ── Typing dots animation ── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-cyber-cyan/70"
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ── Copy button ── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
      title="Copy message"
    >
      {copied ? <Check className="w-3 h-3 text-cyber-green" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ── Suggestion chips data ── */
const SUGGESTIONS = [
  { icon: <Lock className="w-3.5 h-3.5" />, text: 'How does HTTPS protect my website?', color: 'from-blue-500/20 to-blue-600/20' },
  { icon: <Globe className="w-3.5 h-3.5" />, text: 'What are the most important security headers?', color: 'from-cyan-500/20 to-cyan-600/20' },
  { icon: <FileCheck className="w-3.5 h-3.5" />, text: 'How to prevent XSS attacks?', color: 'from-emerald-500/20 to-emerald-600/20' },
  { icon: <Zap className="w-3.5 h-3.5" />, text: 'What is CSRF and how to mitigate it?', color: 'from-amber-500/20 to-amber-600/20' },
];

/* ── Relative time formatter ── */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ── Conversation sidebar item ── */
function ConversationItem({
  conv,
  isActive,
  onClick,
  onDelete,
}: {
  conv: ChatConversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const msgCount = conv.messages.filter(m => m.role === 'user').length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive
          ? 'bg-cyber-blue/10 border border-cyber-blue/20'
          : 'hover:bg-white/[0.03] border border-transparent'
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isActive
          ? 'bg-gradient-to-br from-cyber-blue/30 to-cyber-cyan/20'
          : 'bg-white/[0.04]'
      }`}>
        <MessageCircle className={`w-3.5 h-3.5 ${isActive ? 'text-cyber-cyan' : 'text-slate-500'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
          {conv.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-slate-600 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(conv.updatedAt)}
          </span>
          <span className="text-[9px] text-slate-600">
            {msgCount}/{CHAT_MESSAGE_LIMIT} msgs
          </span>
        </div>
      </div>

      {/* Delete button */}
      <AnimatePresence>
        {hovering && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="shrink-0 p-1 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Delete conversation"
          >
            <Trash2 className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Component ── */
export function ChatBot() {
  const {
    chatOpen, setChatOpen,
    chatConversations, currentChatId,
    chatLoading, chatSidebarOpen, setChatSidebarOpen,
    createNewChat, switchChat, deleteChat,
    sendChatMessage, clearChat,
  } = useAppStore();

  // Derive current conversation messages
  const currentConv = chatConversations.find(c => c.id === currentChatId);
  const chatMessages = currentConv?.messages || [];
  const userMsgCount = chatMessages.filter(m => m.role === 'user').length;
  const isLimitReached = userMsgCount >= CHAT_MESSAGE_LIMIT;

  const [input, setInput] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, chatLoading, scrollToBottom]);

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [chatOpen, currentChatId]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  const handleSend = async () => {
    if (!input.trim() || chatLoading || isLimitReached) return;
    const msg = input.trim();
    setInput('');
    await sendChatMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleNewChat = () => {
    createNewChat();
    setInput('');
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isConsecutive = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return false;
    const prev = chatMessages[idx - 1];
    if (prev.role !== msg.role) return false;
    const timeDiff = new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime();
    return timeDiff < 120000;
  };

  const shouldShowTime = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = chatMessages[idx - 1];
    const timeDiff = new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime();
    return timeDiff > 300000;
  };

  return (
    <>
      {/* ── Floating Chat Button ── */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.div className="fixed bottom-6 right-6 z-50">
            {/* Pulse rings */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(59, 130, 246, 0.3)' }}
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(34, 211, 238, 0.2)' }}
              animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
            />

            <motion.button
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setChatOpen(true)}
              className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #06B6D4, #22D3EE)',
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.4), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <MessageSquare className="w-7 h-7 text-white" />
              {/* Conversation count badge */}
              {chatConversations.length > 0 && (
                <motion.div
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-cyber-cyan/90 border-2 border-[#0B0F19] flex items-center justify-center px-1"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <span className="text-[9px] text-[#0B0F19] font-bold">{chatConversations.length}</span>
                </motion.div>
              )}
            </motion.button>

            {/* Label */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -top-8 right-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] text-slate-400 font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              AI Security Chat
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 flex overflow-hidden rounded-2xl"
            style={{
              width: chatSidebarOpen ? '680px' : '420px',
              maxWidth: 'calc(100vw - 2rem)',
              height: '580px',
              maxHeight: 'calc(100vh - 4rem)',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(11,15,25,0.99) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              boxShadow: '0 0 60px rgba(59, 130, 246, 0.15), 0 0 120px rgba(34, 211, 238, 0.05), 0 25px 50px rgba(0,0,0,0.5)',
              transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* ══════════════════════════════════════════════
                SIDEBAR — Conversation History
                ══════════════════════════════════════════════ */}
            <AnimatePresence>
              {chatSidebarOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 250, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="shrink-0 flex flex-col overflow-hidden border-r"
                  style={{ borderColor: 'rgba(59, 130, 246, 0.1)' }}
                >
                  {/* Sidebar Header */}
                  <div
                    className="px-3 py-3 flex items-center justify-between shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(34, 211, 238, 0.04) 100%)',
                      borderBottom: '1px solid rgba(59, 130, 246, 0.08)',
                    }}
                  >
                    <h3 className="text-xs font-bold text-white">History</h3>
                    <button
                      onClick={() => setChatSidebarOpen(false)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* New Chat Button */}
                  <div className="px-3 pt-3 pb-1 shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleNewChat}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-white transition-all"
                      style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(34, 211, 238, 0.1))',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 text-cyber-cyan" />
                      New Chat
                    </motion.button>
                  </div>

                  {/* Conversation List */}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                    {chatConversations.length === 0 && (
                      <div className="text-center py-8 px-3">
                        <MessageCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-600">No conversations yet</p>
                        <p className="text-[9px] text-slate-700 mt-1">Start a new chat to begin</p>
                      </div>
                    )}

                    {chatConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === currentChatId}
                        onClick={() => switchChat(conv.id)}
                        onDelete={() => deleteChat(conv.id)}
                      />
                    ))}
                  </div>

                  {/* Sidebar Footer */}
                  <div className="px-3 py-2 shrink-0 border-t" style={{ borderColor: 'rgba(59, 130, 246, 0.08)' }}>
                    <p className="text-[9px] text-slate-600 text-center">
                      {chatConversations.length} conversation{chatConversations.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ══════════════════════════════════════════════
                MAIN CHAT AREA
                ══════════════════════════════════════════════ */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* ── Header ── */}
              <div
                className="flex items-center justify-between px-4 py-3 shrink-0 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(34, 211, 238, 0.06) 100%)',
                  borderBottom: '1px solid rgba(59, 130, 246, 0.12)',
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent)' }} />

                <div className="flex items-center gap-3">
                  {/* Toggle Sidebar */}
                  {!chatSidebarOpen && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setChatSidebarOpen(true)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                      title="Chat history"
                    >
                      <PanelLeft className="w-4 h-4" />
                    </motion.button>
                  )}

                  {/* Bot Avatar */}
                  <div className="relative">
                    <motion.div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}
                      animate={{ boxShadow: ['0 0 10px rgba(59,130,246,0.3)', '0 0 20px rgba(34,211,238,0.4)', '0 0 10px rgba(59,130,246,0.3)'] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Bot className="w-4.5 h-4.5 text-white" />
                    </motion.div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-cyber-green border-2 border-[#0F172A]" style={{ boxShadow: '0 0 6px #22C55E' }} />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white">SecureBot AI</h3>
                      <Sparkles className="w-3 h-3 text-cyber-cyan/60" />
                    </div>
                    <p className="text-[10px] text-emerald-400/70 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: '0 0 4px #22C55E' }} />
                      Online
                    </p>
                  </div>
                </div>

                {/* Message limit indicator + actions */}
                <div className="flex items-center gap-2">
                  {/* Limit badge */}
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold ${
                      isLimitReached
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        : userMsgCount >= 6
                          ? 'bg-orange-500/10 text-orange-400/70 border border-orange-500/15'
                          : 'bg-white/[0.03] text-slate-500 border border-white/5'
                    }`}
                  >
                    {isLimitReached && <AlertCircle className="w-3 h-3" />}
                    {userMsgCount}/{CHAT_MESSAGE_LIMIT}
                  </div>

                  <button
                    onClick={handleNewChat}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-all"
                    title="New chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={clearChat}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Clear chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Messages ── */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
              >
                {/* No conversation selected or empty */}
                {(!currentChatId || chatMessages.length === 0) && !chatLoading && (
                  <div className="text-center py-6">
                    {/* Animated Shield */}
                    <div className="relative inline-block mb-4">
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative"
                      >
                        <motion.div
                          animate={{
                            filter: [
                              'drop-shadow(0 0 10px rgba(34, 211, 238, 0.2))',
                              'drop-shadow(0 0 25px rgba(34, 211, 238, 0.5))',
                              'drop-shadow(0 0 10px rgba(34, 211, 238, 0.2))',
                            ],
                          }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          <Shield className="w-14 h-14 text-cyber-cyan/60" />
                        </motion.div>
                      </motion.div>

                      {/* Orbiting dot */}
                      <motion.div
                        className="absolute inset-0"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                      >
                        <div
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyber-cyan"
                          style={{ boxShadow: '0 0 8px #22D3EE' }}
                        />
                      </motion.div>
                    </div>

                    <h4 className="text-lg font-bold gradient-text mb-1">SecureBot AI</h4>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto mb-5">
                      Your personal cybersecurity expert. Ask about web security, SSL, vulnerabilities, and more.
                    </p>

                    {/* Limit info */}
                    <div className="flex items-center justify-center gap-1.5 mb-5 px-4">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.03] border border-white/5">
                        <MessageCircle className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-500">{CHAT_MESSAGE_LIMIT} questions per chat</span>
                      </div>
                    </div>

                    {/* Feature chips */}
                    <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                      {['SSL/TLS', 'XSS Prevention', 'Security Headers', 'Port Scanning', 'OWASP Top 10'].map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[9px] font-medium text-cyber-cyan/70 border border-cyber-cyan/15 bg-cyber-cyan/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Suggestion cards */}
                    <div className="space-y-2 px-2">
                      {SUGGESTIONS.map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.08 }}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSuggestion(s.text)}
                          disabled={isLimitReached}
                          className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-white/5 hover:border-cyber-blue/20 text-slate-400 hover:text-slate-200 transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                        >
                          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${s.color} text-slate-400 group-hover:text-cyber-cyan transition-colors`}>
                            {s.icon}
                          </div>
                          <span className="text-xs leading-snug">{s.text}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Message list ── */}
                {chatMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const consecutive = isConsecutive(msg, idx);
                  const showTime = shouldShowTime(msg, idx);

                  return (
                    <div key={msg.id}>
                      {showTime && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-white/5" />
                          <span className="text-[9px] text-slate-600 font-medium">{formatTime(msg.timestamp)}</span>
                          <div className="flex-1 h-px bg-white/5" />
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${consecutive ? 'mt-0.5' : 'mt-2.5'}`}
                        onMouseEnter={() => setHoveredMsg(msg.id)}
                        onMouseLeave={() => setHoveredMsg(null)}
                      >
                        {!isUser && !consecutive && (
                          <div className="shrink-0 mr-2 mt-1">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}
                            >
                              <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        )}
                        {!isUser && consecutive && <div className="w-7 mr-2 shrink-0" />}

                        <div className={`group relative max-w-[82%] ${isUser ? 'chat-bubble-user' : 'chat-bubble-bot'} ${consecutive ? (isUser ? '!rounded-br-sm' : '!rounded-bl-sm') : ''} px-3.5 py-2.5`}>
                          {!isUser && !consecutive && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-[10px] text-cyber-cyan font-semibold tracking-wide">SecureBot</span>
                            </div>
                          )}

                          <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                            {isUser ? msg.content : renderBotContent(msg.content)}
                          </div>

                          <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-between'}`}>
                            <span className={`text-[9px] ${isUser ? 'text-blue-200/40' : 'text-slate-600'}`}>
                              {formatTime(msg.timestamp)}
                            </span>
                            <AnimatePresence>
                              {hoveredMsg === msg.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <CopyButton text={msg.content} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {isUser && !consecutive && (
                          <div className="shrink-0 ml-2 mt-1">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-white"
                              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
                            >
                              U
                            </div>
                          </div>
                        )}
                        {isUser && consecutive && <div className="w-7 ml-2 shrink-0" />}
                      </motion.div>
                    </div>
                  );
                })}

                {/* ── Typing indicator ── */}
                {chatLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start mt-2.5"
                  >
                    <div className="shrink-0 mr-2 mt-1">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}
                      >
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    <div className="chat-bubble-bot px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <TypingDots />
                        <span className="text-[10px] text-slate-600">Analyzing...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Limit reached banner ── */}
                {isLimitReached && !chatLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 mx-auto max-w-[90%]"
                  >
                    <div className="flex flex-col items-center gap-3 px-4 py-4 rounded-xl border border-amber-500/15 bg-amber-500/5">
                      <div className="flex items-center gap-2 text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-semibold">Chat limit reached</span>
                      </div>
                      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                        You&apos;ve used all {CHAT_MESSAGE_LIMIT} questions in this conversation. Start a new chat to continue.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleNewChat}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                        style={{
                          background: 'linear-gradient(135deg, #3B82F6, #06B6D4, #22D3EE)',
                          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Chat
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Scroll to bottom ── */}
              <AnimatePresence>
                {showScrollBtn && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10"
                  >
                    <button
                      onClick={() => scrollToBottom()}
                      className="p-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                      style={{ backdropFilter: 'blur(8px)' }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Input Area ── */}
              <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(59, 130, 246, 0.08)' }}>
                {/* Progress bar for message limit */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: isLimitReached
                          ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                          : userMsgCount >= 6
                            ? 'linear-gradient(90deg, #F59E0B, #FB923C)'
                            : 'linear-gradient(90deg, #3B82F6, #22D3EE)',
                      }}
                      animate={{ width: `${(userMsgCount / CHAT_MESSAGE_LIMIT) * 100}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[8px] text-slate-600 shrink-0">
                    {userMsgCount}/{CHAT_MESSAGE_LIMIT}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isLimitReached ? 'Limit reached — start a new chat' : 'Ask about web security...'}
                      disabled={chatLoading || isLimitReached}
                      className="w-full px-4 py-3 pr-10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyber-blue/40 disabled:opacity-40 transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    />
                  </div>
                  <motion.button
                    onClick={isLimitReached ? handleNewChat : handleSend}
                    disabled={!isLimitReached && (!input.trim() || chatLoading)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-3 rounded-xl transition-all disabled:opacity-20 shrink-0 relative overflow-hidden"
                    style={{
                      background: isLimitReached
                        ? 'linear-gradient(135deg, #3B82F6, #06B6D4, #22D3EE)'
                        : input.trim()
                          ? 'linear-gradient(135deg, #3B82F6, #06B6D4, #22D3EE)'
                          : 'rgba(255,255,255,0.05)',
                      boxShadow: (isLimitReached || input.trim()) ? '0 4px 15px rgba(59, 130, 246, 0.3)' : 'none',
                    }}
                    title={isLimitReached ? 'Start new chat' : 'Send message'}
                  >
                    {isLimitReached ? <Plus className="w-4 h-4 text-white" /> : <Send className="w-4 h-4 text-white" />}
                  </motion.button>
                </div>
              </div>

              {/* ── Footer accent line ── */}
              <div className="h-[2px] shrink-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), rgba(34,211,238,0.3), transparent)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
