import { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import Codeo from './Codeo';
import ChatBubble, { CHAT_MESSAGES_HEIGHT } from './ChatBubble';
import MascotHeadAlert from './MascotHeadAlert';
import { SitDownIcon, StandUpIcon } from './MascotPoseIcon';
import { codeoAPI } from '../../services/apiService';
import { getSocket } from '../../socket/socket';
import { useAuth } from '../../context/AuthContext';

const ROLE_GREETINGS = {
  ceo: "Hi, I'm Codeo ⚡ CEO mode — approve requests, schedule meetings, create tasks (I'll ask first), assign tasks, or set your status. Type \"help\" anytime.",
  admin: "Hi, I'm Codeo ⚡ Admin mode — create users (username + profile), analytics, meetings. Say \"create user\" or type \"help\".",
  employee: "Hi, I'm Codeo ⚡ I can file leave & meeting requests, create tasks (I'll ask before saving), and show your tasks. Type \"help\" anytime.",
};

function buildQuickReplies(data) {
  const action = data?.action;
  if (!action) return null;

  if (action.kind === 'flow_collecting' && action.currentField === 'status') {
    return [
      { label: 'Available', value: 'available' },
      { label: 'In Meeting', value: 'in meeting' },
      { label: 'Deep Work', value: 'deep work' },
      { label: 'Emergency Only', value: 'emergency only' },
      { label: 'Offline', value: 'offline' },
    ];
  }

  if (action.kind === 'flow_collecting' && action.currentField === 'urgency') {
    return [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
    ];
  }

  if (action.kind === 'flow_confirm') {
    const isTask = action.type === 'create_task' || action.type === 'assign_task';
    return [
      { label: isTask ? 'Yes, create task' : 'Yes, proceed', value: 'yes' },
      { label: 'Cancel', value: 'no' },
    ];
  }

  if (action.kind === 'flow_collecting' && action.currentField === 'role') {
    return [
      { label: 'Employee', value: 'employee' },
      { label: 'CEO', value: 'ceo' },
      { label: 'Admin', value: 'admin' },
    ];
  }

  const pickList = action.requests;
  if (pickList?.length && (action.kind === 'list_pending_requests' || action.needsPick)) {
    return pickList.slice(0, 4).flatMap((r) => {
      const n = r.index ?? pickList.indexOf(r) + 1;
      const title = (r.title || 'Request').slice(0, 16);
      return [
        { label: `✓ #${n} ${title}`, value: `approve ${n}` },
        { label: `✗ #${n}`, value: `reject ${n}` },
      ];
    });
  }

  return null;
}

const CodeoContext = createContext(null);
export const useCodeo = () => useContext(CodeoContext);

const PAD = 16;
const MASCOT_ASPECT = 330 / 160;
const MASCOT_MIN_W = 118;
const MASCOT_MAX_W = 240;
const CHAT_W = 340;
const CHAT_GAP = 8;
const DRAG_THRESHOLD = 6;
const CHAT_HEADER_HEIGHT = 44;
const CHAT_INPUT_HEIGHT = 52;
const CHAT_BUBBLE_HEIGHT = CHAT_HEADER_HEIGHT + CHAT_MESSAGES_HEIGHT;
/** Fixed panel: bubble + input row + gap */
const CHAT_PANEL_HEIGHT = CHAT_BUBBLE_HEIGHT + CHAT_INPUT_HEIGHT + 8;
const EST_CHAT_H = CHAT_PANEL_HEIGHT;
/** Match Codeo.jsx landscape artwork scale */
const MASCOT_IMG_ASPECT = 1024 / 1536;
const MASCOT_IMG_SCALE = 1.28;

function mascotArtHeight(mascotW) {
  return mascotW * MASCOT_IMG_ASPECT * MASCOT_IMG_SCALE;
}

function sitButtonStyle(mascotW) {
  const artH = mascotArtHeight(mascotW);
  return {
    left: Math.round(mascotW * 0.02),
    bottom: Math.round(artH * 0.56),
  };
}

/** Speech-bubble anchor — sits just above the visible mascot head, not the empty layout box. */
export function headAlertAnchorStyle(mascotW, isSitting) {
  const artH = mascotArtHeight(mascotW);
  const sitLift = isSitting ? 8 : 0;
  const gap = 12;
  return { bottom: Math.round(artH + sitLift + gap) };
}

let msgSeq = 0;
const nextMsgId = (prefix) => `${prefix}-${Date.now()}-${++msgSeq}`;

function mapHistoryToMessages(apiMessages = []) {
  return apiMessages.map((m, i) => ({
    id: m.createdAt ? `hist-${new Date(m.createdAt).getTime()}-${i}` : `hist-${i}`,
    role: m.role,
    text: m.text,
    animate: false,
    quickReplies: null,
  }));
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function computeMascotDimensions(vw = 1024, vh = 768) {
  const base = Math.min(vw, vh);
  const w = clamp(Math.round(base * 0.192), MASCOT_MIN_W, MASCOT_MAX_W);
  const h = Math.round(w * MASCOT_ASPECT);
  return { w, h };
}

function defaultDockPos(mascotW, mascotH, chatOpen) {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  const dockW = chatOpen ? CHAT_W + CHAT_GAP + mascotW : mascotW;
  const dockH = chatOpen ? Math.max(CHAT_PANEL_HEIGHT, mascotH) : mascotH;
  return {
    x: window.innerWidth - dockW - PAD,
    y: window.innerHeight - dockH - PAD,
  };
}

function clampDockPos(x, y, mascotW, mascotH, chatOpen) {
  if (typeof window === 'undefined') return { x, y };
  const dockW = chatOpen ? CHAT_W + CHAT_GAP + mascotW : mascotW;
  const dockH = chatOpen ? Math.max(CHAT_PANEL_HEIGHT, mascotH) : mascotH;
  return {
    x: clamp(x, PAD, window.innerWidth - dockW - PAD),
    y: clamp(y, PAD, window.innerHeight - dockH - PAD),
  };
}

/** When chat opens, keep mascot screen position and grow dock to the left. */
function dockPosForChatOpen(prev, mascotW, mascotH) {
  const dockW = CHAT_W + CHAT_GAP + mascotW;
  const dockH = Math.max(CHAT_PANEL_HEIGHT, mascotH);
  const mascotScreenX = prev.x;
  const mascotScreenY = prev.y;
  let x = mascotScreenX - CHAT_W - CHAT_GAP;
  let y = mascotScreenY + mascotH - dockH;
  return clampDockPos(x, y, mascotW, mascotH, true);
}

/** When chat closes, collapse dock so mascot stays in place. */
function dockPosForChatClose(prev, mascotW, mascotH) {
  const dockH = Math.max(CHAT_PANEL_HEIGHT, mascotH);
  const x = prev.x + CHAT_W + CHAT_GAP;
  const y = prev.y + dockH - mascotH;
  return clampDockPos(x, y, mascotW, mascotH, false);
}

export function CodeoProvider({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [mascotSize, setMascotSize] = useState(() => (
    typeof window !== 'undefined'
      ? computeMascotDimensions(window.innerWidth, window.innerHeight)
      : { w: MASCOT_MIN_W, h: Math.round(MASCOT_MIN_W * MASCOT_ASPECT) }
  ));
  const [dockPos, setDockPos] = useState(() => {
    const size = typeof window !== 'undefined'
      ? computeMascotDimensions(window.innerWidth, window.innerHeight)
      : { w: MASCOT_MIN_W, h: Math.round(MASCOT_MIN_W * MASCOT_ASPECT) };
    return defaultDockPos(size.w, size.h, false);
  });
  const [isSitting, setIsSitting] = useState(false);
  const [mascotHovered, setMascotHovered] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [headAlert, setHeadAlert] = useState(null);
  const historyFetchedRef = useRef(false);

  const dismissTimer = useRef(null);
  const headAlertTimer = useRef(null);
  const inputRef = useRef(null);
  const chatPanelRef = useRef(null);
  const dragControls = useDragControls();
  const pointerRef = useRef({ active: false, startX: 0, startY: 0, dragged: false });
  const prevOpenRef = useRef(false);

  const pushCodeo = useCallback((text, animate = true, options = {}) => {
    setMessages((prev) => [...prev, {
      id: nextMsgId('codeo'),
      role: 'codeo',
      text,
      animate,
      ...options,
    }]);
  }, []);

  const loadChatHistory = useCallback(async () => {
    if (!user?.id) return [];
    setHistoryLoading(true);
    try {
      const { data } = await codeoAPI.history();
      const mapped = mapHistoryToMessages(data.messages || []);
      setMessages(mapped);
      return mapped;
    } catch {
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  const scheduleDismiss = useCallback(() => {
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setOpen(false);
      setMood('idle');
    }, 12000);
  }, []);

  const pauseDismiss = useCallback(() => {
    clearTimeout(dismissTimer.current);
  }, []);

  const dismissHeadAlert = useCallback(() => {
    clearTimeout(headAlertTimer.current);
    setHeadAlert(null);
  }, []);

  const showHeadAlert = useCallback((notification) => {
    if (!notification) return;
    const isReminder = notification.type === 'meeting_reminder';
    const item = {
      id: notification._id || nextMsgId('alert'),
      title: notification.title || 'New notification',
      message: notification.message || '',
      type: notification.type,
      isReminder,
    };
    setHeadAlert(item);
    const urgent = notification.type === 'emergency_request';
    if (isReminder) {
      setIsSitting(false);
      setMood('focused');
    } else {
      setMood(urgent ? 'surprised' : 'happy');
    }
    if (typeof window !== 'undefined') window.__codeoWave?.();
    clearTimeout(headAlertTimer.current);
    headAlertTimer.current = setTimeout(() => {
      setHeadAlert(null);
      if (!open) setMood('idle');
    }, isReminder ? 14000 : 7000);
  }, [open]);

  const send = useCallback(async (text) => {
    const message = (text || '').trim();
    if (!message) return;
    const isGreeting = /^\s*(hi|hey|hello|yo|sup|hola|namaste|good (morning|afternoon|evening))\b/i.test(message);
    setOpen(true);
    setMessages((prev) => [...prev, { id: nextMsgId('user'), role: 'user', text: message, animate: false }]);
    setInput('');
    setTyping(true);
    setMood('thinking');
    try {
      const { data } = await codeoAPI.send(message);
      setTyping(false);
      setMood(data.mood || 'happy');
      if (isGreeting) window.__codeoWave?.();
      pushCodeo(data.reply, true, { quickReplies: buildQuickReplies(data) });
      if (data.action?.kind === 'create_task' || data.action?.kind === 'assign_task') {
        if (data.mood === 'celebrate') window.__codeoWave?.();
      }
      setTimeout(() => setMood('listening'), 2500);
      scheduleDismiss();
      return data;
    } catch (e) {
      setTyping(false);
      setMood('thinking');
      pushCodeo("I hit a snag doing that. Mind trying again?");
      scheduleDismiss();
    }
  }, [pushCodeo, scheduleDismiss]);

  const standUp = useCallback(() => setIsSitting(false), []);

  const toggleChat = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      if (next) {
        standUp();
        setMood('listening');
        scheduleDismiss();
      } else {
        setMood('idle');
      }
      return next;
    });
  }, [scheduleDismiss, standUp]);

  const openChatFromAlert = useCallback((alert) => {
    dismissHeadAlert();
    standUp();
    setOpen(true);
    setMood('listening');
    const text = [alert.title, alert.message].filter(Boolean).join('\n');
    pushCodeo(`🔔 ${text}`, false);
    scheduleDismiss();
  }, [dismissHeadAlert, standUp, pushCodeo, scheduleDismiss]);

  const api = {
    open: () => { standUp(); setOpen(true); setMood('listening'); scheduleDismiss(); },
    close: () => setOpen(false),
    say: (text) => { standUp(); setOpen(true); pushCodeo(text); scheduleDismiss(); },
    send,
    react: (m) => { setMood(m); setTimeout(() => setMood('idle'), 2500); },
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAction = (payload) => {
      setMood(payload.mood || 'happy');
      setTimeout(() => setMood('idle'), 2500);
    };
    socket.on('codeo_action', onAction);
    return () => socket.off('codeo_action', onAction);
  }, []);

  // Popup cloud above mascot — meeting reminders use highlighted styling.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNotification = (notification) => showHeadAlert(notification);
    socket.on('new_notification', onNotification);
    return () => {
      socket.off('new_notification', onNotification);
      clearTimeout(headAlertTimer.current);
    };
  }, [showHeadAlert]);

  useEffect(() => {
    if (open) return;
    const drift = setInterval(() => {
      const calmMoods = ['idle', 'idle', 'idle', 'focused', 'happy', 'sleepy'];
      setMood(calmMoods[Math.floor(Math.random() * calmMoods.length)]);
    }, 8000);
    return () => clearInterval(drift);
  }, [open]);

  useEffect(() => {
    if (!user?.id) {
      historyFetchedRef.current = false;
      setMessages([]);
      return;
    }
  }, [user?.id]);

  // Load full conversation history once per login; keep in state when chat closes.
  useEffect(() => {
    if (!user?.id || historyFetchedRef.current) return;
    historyFetchedRef.current = true;
    let cancelled = false;

    (async () => {
      const history = await loadChatHistory();
      if (cancelled) return;

      if (history.length > 0) {
        sessionStorage.setItem('codeo_greeted', '1');
        return;
      }

      const greeted = sessionStorage.getItem('codeo_greeted');
      if (!greeted) {
        sessionStorage.setItem('codeo_greeted', '1');
        setTimeout(() => {
          if (cancelled) return;
          standUp();
          setOpen(true);
          setMood('happy');
          const role = user?.role || 'employee';
          pushCodeo(ROLE_GREETINGS[role] || ROLE_GREETINGS.employee, false);
          scheduleDismiss();
        }, 1200);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, loadChatHistory, pushCodeo, scheduleDismiss, standUp]);

  useLayoutEffect(() => {
    const { w, h } = mascotSize;
    if (open && !prevOpenRef.current) {
      setDockPos((prev) => dockPosForChatOpen(prev, w, h));
    } else if (!open && prevOpenRef.current) {
      setDockPos((prev) => dockPosForChatClose(prev, w, h));
    }
    prevOpenRef.current = open;
  }, [open, mascotSize.w, mascotSize.h]);

  useEffect(() => {
    const onResize = () => {
      const nextSize = computeMascotDimensions(window.innerWidth, window.innerHeight);
      setMascotSize((prev) => (
        prev.w === nextSize.w && prev.h === nextSize.h ? prev : nextSize
      ));
      setDockPos((prev) => clampDockPos(prev.x, prev.y, nextSize.w, nextSize.h, open));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const handleDragEnd = useCallback((_, info) => {
    const moved = Math.hypot(info.offset.x, info.offset.y) > DRAG_THRESHOLD;
    if (moved) {
      setDockPos((prev) => clampDockPos(
        prev.x + info.offset.x,
        prev.y + info.offset.y,
        mascotSize.w,
        mascotSize.h,
        open,
      ));
      pointerRef.current.suppressClick = true;
      window.setTimeout(() => { pointerRef.current.suppressClick = false; }, 350);
    }
    pointerRef.current.dragged = false;
    pointerRef.current.active = false;
  }, [open, mascotSize]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    pointerRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      dragged: false,
      suppressClick: false,
    };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!pointerRef.current.active) return;
    const dx = e.clientX - pointerRef.current.startX;
    const dy = e.clientY - pointerRef.current.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      pointerRef.current.dragged = true;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!pointerRef.current.active) return;
    const { dragged, suppressClick } = pointerRef.current;
    pointerRef.current.active = false;

    if (!dragged && !suppressClick) {
      window.__codeoWave?.();
      toggleChat();
    }
  }, [toggleChat]);

  return (
    <CodeoContext.Provider value={api}>
      {children}

      {/* Chat + mascot docked together — drag moves both as one unit */}
      <motion.div
        className={`fixed touch-none select-none flex items-end overflow-visible ${headAlert ? 'z-[160]' : 'z-[102]'}`}
        style={{ left: 0, top: 0, x: dockPos.x, y: dockPos.y, gap: CHAT_GAP }}
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        dragListener={false}
        onDrag={(_, info) => {
          if (Math.hypot(info.offset.x, info.offset.y) > DRAG_THRESHOLD) {
            pointerRef.current.dragged = true;
          }
        }}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setMascotHovered(true)}
        onMouseLeave={() => setMascotHovered(false)}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              ref={chatPanelRef}
              key="codeo-chat"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 flex flex-col gap-2 pointer-events-auto overflow-hidden"
              style={{
                width: CHAT_W,
                maxWidth: `min(${CHAT_W}px, calc(100vw - ${PAD * 2}px))`,
                height: CHAT_PANEL_HEIGHT,
                maxHeight: `min(${CHAT_PANEL_HEIGHT}px, calc(100vh - ${PAD * 2}px))`,
              }}
            >
              <div className="flex-shrink-0 w-full" style={{ height: CHAT_BUBBLE_HEIGHT }}>
                <ChatBubble
                  messages={messages}
                  typing={typing}
                  loadingHistory={historyLoading}
                  onClose={() => { setOpen(false); setMood('idle'); }}
                  onQuickReply={(value) => send(value)}
                />
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 w-full rounded-full px-3 py-2 bg-white/98 backdrop-blur-xl border border-primary-200/80 shadow-[0_4px_20px_rgba(99,102,241,0.12),0_2px_8px_rgba(15,23,42,0.04)] dark:bg-surface-800/95 dark:border-surface-600 dark:shadow-[0_0_20px_rgba(34,211,238,0.08)]">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    scheduleDismiss();
                  }}
                  onFocus={pauseDismiss}
                  onBlur={scheduleDismiss}
                  onKeyDown={(e) => e.key === 'Enter' && send(input)}
                  placeholder="Ask Codeo to do something…"
                  className="flex-1 bg-transparent outline-none text-sm text-surface-900 dark:text-surface-100 placeholder-surface-500 dark:placeholder-surface-500 caret-primary-700 dark:caret-primary-300"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 shadow-sm dark:bg-primary-500/25 dark:text-primary-200 dark:hover:bg-primary-500/40 dark:shadow-none"
                  aria-label="Send"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex-shrink-0 cursor-grab active:cursor-grabbing overflow-visible">
          <MascotHeadAlert
            alert={headAlert}
            mascotW={mascotSize.w}
            isSitting={isSitting}
            chatOpen={open}
            anchorStyle={headAlertAnchorStyle(mascotSize.w, isSitting)}
            onDismiss={dismissHeadAlert}
            onOpenChat={openChatFromAlert}
          />

          <AnimatePresence>
            {mascotHovered && !open && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                className="absolute z-[103] flex h-8 w-8 items-center justify-center rounded-full border border-primary-300/60 bg-white/96 text-primary-600 shadow-[0_2px_12px_rgba(99,102,241,0.25)] backdrop-blur-sm transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200 dark:shadow-[0_2px_12px_rgba(34,211,238,0.12)] dark:hover:border-primary-500/50 dark:hover:bg-primary-500/20 dark:hover:text-primary-100 pointer-events-auto cursor-pointer"
                style={sitButtonStyle(mascotSize.w)}
                aria-label={isSitting ? 'Stand up' : 'Sit down'}
                title={isSitting ? 'Stand up' : 'Sit down'}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsSitting((s) => !s);
                }}
              >
                {isSitting ? <StandUpIcon size={16} /> : <SitDownIcon size={16} />}
              </motion.button>
            )}
          </AnimatePresence>

          <div
            className="relative z-[1]"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              dragControls.start(e);
              handlePointerDown(e);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <Codeo mood={mood} size={mascotSize.w} chatOpen={open} isSitting={isSitting} />
          </div>
        </div>
      </motion.div>
    </CodeoContext.Provider>
  );
}

export default CodeoProvider;
