'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, X, Send, Bot, Trash2, Shield,
  Copy, Check, ChevronDown, Sparkles, Lock,
  Globe, FileCheck, Zap
} from 'lucide-react';
import { useAppStore, ChatMessage } from '@/lib/store';

/* ── Simple Markdown-ish renderer ── */
function renderBotContent(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    // bullet list items
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
    // numbered list items
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
    // code blocks (``` ... ```)
    if (line.startsWith('```')) {
      elements.push(<div key={key++} className="h-1" />); // spacer
      continue;
    }
    // empty line
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }
    // normal paragraph
    elements.push(<p key={key++}>{renderInline(line)}</p>);
  }
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Split on bold (**...**) and inline code (`...`)
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

/* ── Main Component ── */
export function ChatBot() {
  const { chatOpen, setChatOpen, chatMessages, chatLoading, sendChatMessage, clearChat } = useAppStore();
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
  }, [chatMessages, chatLoading, scrollToBottom]);

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [chatOpen]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  const handleSend = async () => {
    if (!input.trim() || chatLoading) return;
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

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if two messages are from same role and close in time
  const isConsecutive = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return false;
    const prev = chatMessages[idx - 1];
    if (prev.role !== msg.role) return false;
    const timeDiff = new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime();
    return timeDiff < 120000; // 2 min
  };

  const shouldShowTime = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = chatMessages[idx - 1];
    const timeDiff = new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime();
    return timeDiff > 300000; // 5 min
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
              {/* Notification dot */}
              {chatMessages.length === 0 && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-cyber-green border-2 border-[#0B0F19] flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-[8px] text-white font-bold">1</span>
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
            className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(11,15,25,0.99) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              boxShadow: '0 0 60px rgba(59, 130, 246, 0.15), 0 0 120px rgba(34, 211, 238, 0.05), 0 25px 50px rgba(0,0,0,0.5)',
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(34, 211, 238, 0.06) 100%)',
                borderBottom: '1px solid rgba(59, 130, 246, 0.12)',
              }}
            >
              {/* Decorative line */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent)' }} />

              <div className="flex items-center gap-3">
                {/* Bot Avatar */}
                <div className="relative">
                  <motion.div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}
                    animate={{ boxShadow: ['0 0 10px rgba(59,130,246,0.3)', '0 0 20px rgba(34,211,238,0.4)', '0 0 10px rgba(59,130,246,0.3)'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Bot className="w-5 h-5 text-white" />
                  </motion.div>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-cyber-green border-2 border-[#0F172A]" style={{ boxShadow: '0 0 6px #22C55E' }} />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white">SecureBot AI</h3>
                    <Sparkles className="w-3 h-3 text-cyber-cyan/60" />
                  </div>
                  <p className="text-[10px] text-emerald-400/70 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: '0 0 4px #22C55E' }} />
                    Online — Cybersecurity assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={clearChat}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
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
              {chatMessages.length === 0 && (
                /* ── Empty State ── */
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
                        className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-white/5 hover:border-cyber-blue/20 text-slate-400 hover:text-slate-200 transition-all group"
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
                    {/* Time separator */}
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
                      {/* Bot avatar */}
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

                      {/* Message bubble */}
                      <div className={`group relative max-w-[82%] ${isUser ? 'chat-bubble-user' : 'chat-bubble-bot'} ${consecutive ? (isUser ? '!rounded-br-sm' : '!rounded-bl-sm') : ''} px-3.5 py-2.5`}>
                        {/* Bot label (first in group) */}
                        {!isUser && !consecutive && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] text-cyber-cyan font-semibold tracking-wide">SecureBot</span>
                          </div>
                        )}

                        {/* Content */}
                        <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                          {isUser ? msg.content : renderBotContent(msg.content)}
                        </div>

                        {/* Timestamp + actions row */}
                        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-between'}`}>
                          <span className={`text-[9px] ${isUser ? 'text-blue-200/40' : 'text-slate-600'}`}>
                            {formatTime(msg.timestamp)}
                          </span>
                          {/* Copy button on hover */}
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

                      {/* User avatar */}
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

              <div ref={messagesEndRef} />
            </div>

            {/* ── Scroll to bottom ── */}
            <AnimatePresence>
              {showScrollBtn && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"
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
              {/* Context hint */}
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Shield className="w-3 h-3 text-cyber-cyan/30" />
                <span className="text-[9px] text-slate-600">Powered by AI — Cybersecurity domain only</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about web security..."
                    disabled={chatLoading}
                    className="w-full px-4 py-3 pr-10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyber-blue/40 disabled:opacity-50 transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                  {/* Character hint */}
                  {input.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600">
                      {input.length}
                    </span>
                  )}
                </div>
                <motion.button
                  onClick={handleSend}
                  disabled={!input.trim() || chatLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-3 rounded-xl transition-all disabled:opacity-20 shrink-0 relative overflow-hidden"
                  style={{
                    background: input.trim()
                      ? 'linear-gradient(135deg, #3B82F6, #06B6D4, #22D3EE)'
                      : 'rgba(255,255,255,0.05)',
                    boxShadow: input.trim() ? '0 4px 15px rgba(59, 130, 246, 0.3)' : 'none',
                  }}
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              </div>
            </div>

            {/* ── Footer accent line ── */}
            <div className="h-[2px] shrink-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), rgba(34,211,238,0.3), transparent)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
