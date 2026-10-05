import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/** Scrollable message area height (panel = header + this + input row in provider). */
export const CHAT_MESSAGES_HEIGHT = 340;

function Typewriter({ text, speed = 18 }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span style={{ whiteSpace: 'pre-line' }}>{shown}</span>;
}

export default function ChatBubble({ messages, typing, onClose, onQuickReply, loadingHistory }) {
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current || typing) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="flex flex-col w-full h-full rounded-2xl overflow-hidden bg-white/97 border border-primary-200/70 shadow-[0_4px_28px_rgba(99,102,241,0.14),0_8px_24px_rgba(15,23,42,0.07)] dark:bg-surface-900/95 dark:border-primary-400/30 dark:shadow-[0_0_28px_rgba(34,211,238,0.1),0_8px_32px_rgba(0,0,0,0.45)]"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-primary-100/90 dark:border-surface-600/80 bg-gradient-to-r from-indigo-50 via-primary-50/90 to-cyan-50/50 dark:from-primary-900/50 dark:via-primary-900/40 dark:to-surface-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="status-dot status-available flex-shrink-0" style={{ boxShadow: '0 0 8px #34d399' }} />
          <span className="font-display text-sm font-bold text-surface-900 dark:text-surface-50">Codeo</span>
          <span className="text-[10px] text-primary-700 dark:text-primary-300 truncate">AI Teammate</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 ml-2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 text-lg leading-none"
          aria-label="Close chat"
        >
          ×
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3"
        style={{ height: CHAT_MESSAGES_HEIGHT, maxHeight: CHAT_MESSAGES_HEIGHT }}
      >
        {loadingHistory && messages.length === 0 && (
          <p className="text-center text-xs text-surface-500 dark:text-surface-400 py-8">Loading conversation…</p>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`px-3 py-2 rounded-xl text-sm leading-snug max-w-[88%] break-words ${
                m.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-sm'
                  : 'bg-indigo-50/90 text-surface-800 border border-primary-100 rounded-bl-sm shadow-sm dark:bg-surface-800 dark:text-surface-100 dark:border-surface-600 dark:shadow-none'
              }`}
            >
              {m.role === 'codeo' && m.animate ? (
                <Typewriter text={m.text} />
              ) : (
                <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>
              )}
              {m.role === 'codeo' && Array.isArray(m.quickReplies) && m.quickReplies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.quickReplies.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onQuickReply?.(opt.value)}
                      className="px-2.5 py-1 text-xs rounded-full border border-primary-200 bg-white text-primary-700 shadow-sm hover:bg-primary-50 hover:border-primary-300 dark:border-primary-500/40 dark:bg-primary-500/20 dark:text-primary-200 dark:shadow-none dark:hover:bg-primary-500/35"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-indigo-50/90 border border-primary-100 dark:bg-surface-800 dark:border-surface-600 rounded-xl rounded-bl-sm px-3 py-2.5 flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-300"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
