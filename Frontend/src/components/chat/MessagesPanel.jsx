import { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { chatAPI } from '../../services/apiService';
import { getSocket } from '../../socket/socket';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const roleColors = {
  admin: 'from-violet-500 to-purple-600',
  ceo: 'from-amber-500 to-orange-600',
  employee: 'from-emerald-500 to-teal-600',
};

const Avatar = ({ user, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeClass} rounded-xl bg-gradient-to-br ${roleColors[user?.role] || 'from-surface-500 to-surface-600'} flex items-center justify-center text-white font-bold`}
      >
        {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-900 ${
          user?.isOnline ? 'bg-emerald-400' : 'bg-surface-400'
        }`}
        title={user?.isOnline ? 'Online' : 'Offline'}
      />
    </div>
  );
};

const formatMsgTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
};

const MessagesPanel = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('list'); // list | chat
  const [unread, setUnread] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const panelRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const searchTimer = useRef(null);

  const myId = String(user?._id || '');

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await chatAPI.getUnreadCount();
      setUnread(data.unreadCount || 0);
    } catch {
      /* ignore */
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await chatAPI.getConversations();
      setConversations(data.conversations || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadContacts = useCallback(async (q = '') => {
    try {
      const { data } = await chatAPI.getContacts({ search: q || undefined });
      setContacts(data.contacts || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshUnread();
    const socket = getSocket();
    if (!socket) return undefined;

    const onPrivateMessage = ({ message, conversationId }) => {
      const cid = String(conversationId);
      if (String(message.receiver?._id || message.receiver) === myId && String(message.sender?._id || message.sender) !== myId) {
        setUnread((n) => n + 1);
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c._id) === cid);
        if (idx === -1) {
          loadConversations();
          return prev;
        }
        const next = [...prev];
        const item = { ...next[idx] };
        item.lastMessage = {
          content: message.content,
          sender: message.sender,
          createdAt: message.createdAt,
        };
        item.updatedAt = message.createdAt;
        if (String(message.receiver?._id || message.receiver) === myId) {
          item.unreadCount = (item.unreadCount || 0) + 1;
        }
        next.splice(idx, 1);
        return [item, ...next];
      });

      setActiveConversation((active) => {
        if (active && String(active._id) === cid) {
          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(message._id))) return prev;
            return [...prev, message];
          });
          if (String(message.receiver?._id || message.receiver) === myId) {
            chatAPI.markRead(cid).then(() => {
              setUnread((n) => Math.max(0, n - 1));
              setConversations((prev) =>
                prev.map((c) => (String(c._id) === cid ? { ...c, unreadCount: 0 } : c))
              );
            }).catch(() => {});
          }
        }
        return active;
      });
    };

    const onPresence = ({ userId, isOnline }) => {
      const id = String(userId);
      setContacts((prev) => prev.map((c) => (String(c._id) === id ? { ...c, isOnline } : c)));
      setConversations((prev) =>
        prev.map((c) =>
          c.otherUser && String(c.otherUser._id) === id
            ? { ...c, otherUser: { ...c.otherUser, isOnline } }
            : c
        )
      );
      setActiveConversation((active) => {
        if (active?.otherUser && String(active.otherUser._id) === id) {
          return { ...active, otherUser: { ...active.otherUser, isOnline } };
        }
        return active;
      });
    };

    const onTyping = ({ conversationId, userId }) => {
      setActiveConversation((active) => {
        if (active && String(active._id) === String(conversationId) && String(userId) !== myId) {
          setPeerTyping(true);
        }
        return active;
      });
    };

    const onStopTyping = ({ conversationId }) => {
      setActiveConversation((active) => {
        if (active && String(active._id) === String(conversationId)) {
          setPeerTyping(false);
        }
        return active;
      });
    };

    const onRead = ({ conversationId, readerId }) => {
      if (String(readerId) === myId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.conversation || conversationId) === String(conversationId) &&
          String(m.sender?._id || m.sender) === myId
            ? { ...m, read: true, readAt: new Date().toISOString() }
            : m
        )
      );
    };

    socket.on('private_message', onPrivateMessage);
    socket.on('user_presence', onPresence);
    socket.on('private_user_typing', onTyping);
    socket.on('private_user_stop_typing', onStopTyping);
    socket.on('private_messages_read', onRead);

    return () => {
      socket.off('private_message', onPrivateMessage);
      socket.off('user_presence', onPresence);
      socket.off('private_user_typing', onTyping);
      socket.off('private_user_stop_typing', onStopTyping);
      socket.off('private_messages_read', onRead);
    };
  }, [myId, loadConversations, refreshUnread]);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadConversations();
    loadContacts(search);
    refreshUnread();
  }, [isOpen, loadConversations, loadContacts, refreshUnread, search]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping, view]);

  const openPanel = () => {
    setIsOpen((o) => !o);
    if (!isOpen) {
      setView('list');
      setActiveConversation(null);
      setMessages([]);
      setDraft('');
      setPeerTyping(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadContacts(value), 250);
  };

  const openConversation = async (conversation) => {
    setView('chat');
    setActiveConversation(conversation);
    setLoadingChat(true);
    setPeerTyping(false);
    try {
      const { data } = await chatAPI.getMessages(conversation._id);
      setMessages(data.messages || []);
      await chatAPI.markRead(conversation._id);
      setConversations((prev) =>
        prev.map((c) => (String(c._id) === String(conversation._id) ? { ...c, unreadCount: 0 } : c))
      );
      refreshUnread();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load messages');
      setView('list');
    } finally {
      setLoadingChat(false);
    }
  };

  const startChatWith = async (contact) => {
    try {
      const { data } = await chatAPI.findOrCreate(contact._id);
      const conversation = {
        ...data.conversation,
        otherUser: data.conversation.otherUser || contact,
        unreadCount: 0,
      };
      await openConversation(conversation);
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start chat');
    }
  };

  const emitTyping = () => {
    const socket = getSocket();
    if (!socket || !activeConversation) return;
    socket.emit('private_typing', { conversationId: activeConversation._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('private_stop_typing', { conversationId: activeConversation._id });
    }, 1200);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeConversation || sending) return;
    setSending(true);
    setDraft('');
    try {
      const { data } = await chatAPI.sendMessage(activeConversation._id, content);
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(data.message._id))) return prev;
        return [...prev, data.message];
      });
      const socket = getSocket();
      socket?.emit('private_stop_typing', { conversationId: activeConversation._id });
      loadConversations();
    } catch (err) {
      setDraft(content);
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const conversationRows = conversations;
  const contactRows = contacts.filter(
    (c) => !conversations.some((conv) => String(conv.otherUser?._id) === String(c._id))
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        className="relative btn-ghost p-2 rounded-xl"
        aria-label="Messages"
        title="Messages"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse-dot">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-[360px] sm:w-[400px] h-[520px] max-h-[70vh] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in flex flex-col">
          {view === 'list' ? (
            <>
              <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex-shrink-0">
                <h3 className="font-display font-semibold text-surface-900 dark:text-white text-sm mb-2">
                  Messages {unread > 0 && <span className="text-primary-600">({unread})</span>}
                </h3>
                <input
                  className="input py-2 text-sm"
                  placeholder="Search employees…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversationRows.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 px-1 mb-1">
                      Conversations
                    </p>
                    {conversationRows.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => openConversation(c)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 text-left transition-colors"
                      >
                        <Avatar user={c.otherUser} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                              {c.otherUser?.fullName}
                            </p>
                            {c.lastMessage?.createdAt && (
                              <span className="text-[10px] text-surface-400 flex-shrink-0">
                                {formatMsgTime(c.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-surface-500 truncate">
                            {c.lastMessage?.content || 'No messages yet'}
                          </p>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="px-3 pt-2 pb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 px-1 mb-1">
                    Employees
                  </p>
                  {contactRows.length === 0 && conversationRows.length === 0 ? (
                    <div className="py-10 text-center text-surface-400 text-sm">
                      No people found
                    </div>
                  ) : contactRows.length === 0 && search ? (
                    <div className="py-6 text-center text-surface-400 text-sm">No matches</div>
                  ) : (
                    contactRows.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => startChatWith(c)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 text-left transition-colors"
                      >
                        <Avatar user={c} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                            {c.fullName}
                          </p>
                          <p className="text-xs text-surface-500 truncate capitalize">
                            {c.role}
                            {c.department ? ` · ${c.department}` : ''}
                            {c.isOnline ? ' · Online' : ' · Offline'}
                          </p>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="px-3 py-2.5 border-b border-surface-100 dark:border-surface-800 flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setView('list');
                    setActiveConversation(null);
                    setMessages([]);
                    setPeerTyping(false);
                    loadConversations();
                    refreshUnread();
                  }}
                  className="btn-ghost p-1.5 rounded-lg"
                  aria-label="Back"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <Avatar user={activeConversation?.otherUser} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                    {activeConversation?.otherUser?.fullName}
                  </p>
                  <p className="text-[10px] text-surface-500">
                    {peerTyping
                      ? 'Typing…'
                      : activeConversation?.otherUser?.isOnline
                        ? 'Online'
                        : 'Offline'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-surface-50/50 dark:bg-surface-950/40">
                {loadingChat ? (
                  <p className="text-center text-sm text-surface-400 py-8">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-surface-400 py-8">
                    Start the conversation
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = String(m.sender?._id || m.sender) === myId;
                    return (
                      <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? 'bg-primary-600 text-white rounded-br-md'
                              : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 border border-surface-200 dark:border-surface-700 rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <div
                            className={`mt-1 flex items-center gap-1.5 text-[10px] ${
                              mine ? 'text-primary-100/90 justify-end' : 'text-surface-400'
                            }`}
                          >
                            <span>{formatMsgTime(m.createdAt)}</span>
                            {mine && (
                              <span title={m.read ? 'Read' : 'Sent'}>
                                {m.read ? 'Read' : 'Sent'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="p-3 border-t border-surface-100 dark:border-surface-800 flex gap-2 flex-shrink-0"
              >
                <input
                  className="input py-2 text-sm flex-1"
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    emitTyping();
                  }}
                  maxLength={4000}
                />
                <button type="submit" className="btn-primary px-3" disabled={sending || !draft.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesPanel;
