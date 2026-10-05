import { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Match CodeoProvider chat panel width */
export const HEAD_ALERT_WIDTH = 340;
const VIEWPORT_PAD = 16;

const TYPE_EMOJI = {
  meeting_approved: '✅',
  meeting_rejected: '❌',
  meeting_pending: '📩',
  meeting_reminder: '⏰',
  new_message: '💬',
  deadline_reminder: '⏰',
  status_update: '📋',
  emergency_request: '🚨',
  token_used: '🎫',
  token_reset: '🎫',
};

const surfaceStyle = {
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

/**
 * Glass cloud popup anchored above Codeo's head — shifts to stay inside the viewport.
 */
export default function MascotHeadAlert({
  alert,
  mascotW = 140,
  isSitting = false,
  chatOpen = false,
  anchorStyle = {},
  onDismiss,
  onOpenChat,
}) {
  const isReminder = alert?.isReminder || alert?.type === 'meeting_reminder';
  const rootRef = useRef(null);
  const [layout, setLayout] = useState({ shiftX: 0, placement: 'above' });

  useLayoutEffect(() => {
    if (!alert || !rootRef.current) {
      setLayout({ shiftX: 0, placement: 'above' });
      return;
    }

    const measure = () => {
      const el = rootRef.current;
      if (!el) return;

      const alertRect = el.getBoundingClientRect();
      const parent = el.offsetParent || el.parentElement;
      if (!parent) return;

      const anchorRect = parent.getBoundingClientRect();
      const mascotCenterX = anchorRect.left + anchorRect.width / 2;
      const alertW = alertRect.width || Math.min(HEAD_ALERT_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);

      let shiftX = 0;
      const idealLeft = mascotCenterX - alertW / 2;
      if (idealLeft < VIEWPORT_PAD) {
        shiftX = VIEWPORT_PAD - idealLeft;
      } else if (idealLeft + alertW > window.innerWidth - VIEWPORT_PAD) {
        shiftX = window.innerWidth - VIEWPORT_PAD - idealLeft - alertW;
      }

      const gap = 8;
      const projectedTop = anchorRect.top - (anchorStyle.bottom || 0) - alertRect.height - gap;
      const placement = projectedTop < VIEWPORT_PAD ? 'below' : 'above';

      setLayout({ shiftX, placement });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [alert, mascotW, isSitting, chatOpen, anchorStyle.bottom]);

  const alertWidth = typeof window !== 'undefined'
    ? Math.min(HEAD_ALERT_WIDTH, window.innerWidth - VIEWPORT_PAD * 2)
    : HEAD_ALERT_WIDTH;
  const widthStyle = {
    width: alertWidth,
    maxWidth: `min(${HEAD_ALERT_WIDTH}px, calc(100vw - ${VIEWPORT_PAD * 2}px))`,
  };

  const positionStyle = layout.placement === 'below'
    ? {
        top: anchorStyle.bottom || 12,
        bottom: 'auto',
        transform: `translateX(calc(-50% + ${layout.shiftX}px))`,
      }
    : {
        bottom: anchorStyle.bottom || 12,
        top: 'auto',
        transform: `translateX(calc(-50% + ${layout.shiftX}px))`,
      };

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          ref={rootRef}
          key={alert.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: layout.placement === 'below' ? -12 : 12, scale: 0.94 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            ...(isReminder ? { boxShadow: ['0 0 0px rgba(34,211,238,0)', '0 0 24px rgba(34,211,238,0.35)', '0 0 0px rgba(34,211,238,0)'] } : {}),
          }}
          exit={{ opacity: 0, y: layout.placement === 'below' ? -8 : 8, scale: 0.98 }}
          transition={
            isReminder
              ? { type: 'spring', stiffness: 280, damping: 22, boxShadow: { duration: 2, repeat: Infinity } }
              : { type: 'spring', stiffness: 320, damping: 26 }
          }
          className="absolute left-1/2 z-[10] pointer-events-auto"
          style={{ ...widthStyle, ...positionStyle }}
        >
          {layout.placement === 'below' && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rotate-45 border-l border-t ${
                isReminder
                  ? 'border-cyan-300/70 bg-white/98 dark:border-cyan-400/40 dark:bg-surface-900/98'
                  : 'border-primary-200/70 bg-white/97 dark:border-primary-400/30 dark:bg-surface-900/95'
              }`}
              aria-hidden
            />
          )}

          <div
            className={`rounded-2xl overflow-hidden border shadow-[0_4px_28px_rgba(99,102,241,0.14),0_8px_24px_rgba(15,23,42,0.07)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${
              isReminder
                ? 'border-cyan-400/60 bg-white/98 dark:bg-surface-900/98 dark:border-cyan-400/40 shadow-[0_0_32px_rgba(34,211,238,0.2)]'
                : 'border-primary-200/70 bg-white/97 dark:bg-surface-900/95 dark:border-primary-400/30 dark:shadow-[0_0_28px_rgba(34,211,238,0.1)]'
            }`}
            style={surfaceStyle}
          >
            <div
              className={`flex items-center justify-between px-4 py-2.5 border-b ${
                isReminder
                  ? 'border-cyan-200/80 bg-gradient-to-r from-cyan-50 via-primary-50/90 to-indigo-50/80 dark:from-cyan-950/40 dark:via-primary-900/40 dark:to-surface-800/80 dark:border-cyan-500/30'
                  : 'border-primary-100/90 bg-gradient-to-r from-indigo-50 via-primary-50/90 to-cyan-50/50 dark:from-primary-900/50 dark:via-primary-900/40 dark:to-surface-800/80 dark:border-surface-600/80'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="status-dot status-available flex-shrink-0"
                  style={{ boxShadow: isReminder ? '0 0 10px #22d3ee' : '0 0 8px #34d399' }}
                />
                <span className="font-display text-sm font-bold text-surface-900 dark:text-surface-50">Codeo</span>
                <span className={`text-[10px] ${isReminder ? 'text-cyan-700 dark:text-cyan-300 font-semibold' : 'text-primary-700 dark:text-primary-300'}`}>
                  {isReminder ? 'Meeting Reminder' : 'Notification'}
                </span>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="flex-shrink-0 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 text-lg leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenChat?.(alert)}
              className="w-full text-left px-4 py-3 hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-colors"
            >
              <div className="flex justify-start">
                <div
                  className={`px-3 py-2 rounded-xl rounded-bl-sm text-sm leading-snug max-w-full border shadow-sm ${
                    isReminder
                      ? 'bg-cyan-50/95 text-surface-800 border-cyan-200/80 dark:bg-surface-800 dark:text-surface-100 dark:border-cyan-500/30'
                      : 'bg-indigo-50/90 text-surface-800 border-primary-100 dark:bg-surface-800 dark:text-surface-100 dark:border-surface-600 dark:shadow-none'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0" aria-hidden>
                      {TYPE_EMOJI[alert.type] || '🔔'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-surface-900 dark:text-surface-50 line-clamp-2">
                        {alert.title}
                      </p>
                      <p className="text-sm leading-snug text-surface-800 dark:text-surface-100 mt-1 line-clamp-5" style={{ whiteSpace: 'pre-line' }}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className={`text-[10px] mt-2 pl-1 ${isReminder ? 'text-cyan-700 dark:text-cyan-300' : 'text-primary-700 dark:text-primary-300'}`}>
                {isReminder ? 'Tap to open Codeo chat' : 'Tap to open chat'}
              </p>
            </button>
          </div>

          {layout.placement === 'above' && (
            <div
              className={`absolute left-1/2 w-3 h-3 rotate-45 border-r border-b ${
                isReminder
                  ? 'border-cyan-300/70 bg-white/98 dark:border-cyan-400/40 dark:bg-surface-900/98'
                  : 'border-primary-200/70 bg-white/97 dark:border-primary-400/30 dark:bg-surface-900/95'
              }`}
              style={{
                transform: `translateX(calc(-50% + ${-layout.shiftX}px))`,
                bottom: -6,
              }}
              aria-hidden
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
