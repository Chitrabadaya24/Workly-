import { useState, useEffect, useRef, useCallback } from 'react';
import { messageAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket/socket';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const MessageThread = ({ requestId, requestTitle }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typerName, setTyperName] = useState('');
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!requestId) return;
    try {
      const { data } = await messageAPI.get(requestId);
      setMessages(data.messages);
    } catch { }
    finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => {
    loadMessages();
    const socket = getSocket();
    if (socket && requestId) {
      socket.emit('join_request_room', requestId);
      socket.on('new_message', (msg) => {
        setMessages(prev => {
          if (prev.find(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      });
      socket.on('user_typing', ({ userName }) => {
        setIsTyping(true);
        setTyperName(userName);
      });
      socket.on('user_stop_typing', () => setIsTyping(false));
      return () => {
        socket.emit('leave_request_room', requestId);
        socket.off('new_message');
        socket.off('user_typing');
        socket.off('user_stop_typing');
      };
    }
  }, [requestId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTyping = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('typing', { requestId });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('stop_typing', { requestId });
      }, 1500);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    const socket = getSocket();
    if (socket) socket.emit('stop_typing', { requestId });
    try {
      await messageAPI.send(requestId, { content: content.trim() });
      setContent('');
    } catch { toast.error('Failed to send message'); }
    finally { setSending(false); }
  };

  if (!requestId) return (
    <div className="flex items-center justify-center h-full text-surface-400 text-sm">
      Select a request to view messages
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      {requestTitle && (
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex-shrink-0">
          <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{requestTitle}</p>
          <p className="text-xs text-surface-500">Meeting thread</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-8">
            <div className="w-6 h-6 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-surface-400 text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
            return (
              <div key={msg._id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                    {msg.sender?.fullName?.charAt(0)}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isMe && (
                    <span className="text-xs text-surface-400 px-1">{msg.sender?.fullName}</span>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-surface-400 px-1">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-xs font-bold">
              {typerName?.charAt(0)}
            </div>
            <div className="bg-surface-100 dark:bg-surface-800 px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex-shrink-0 p-3 border-t border-surface-100 dark:border-surface-800">
        <div className="flex gap-2">
          <input
            className="input flex-1 rounded-xl"
            value={content}
            onChange={e => { setContent(e.target.value); handleTyping(); }}
            placeholder="Type a message..."
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="btn-primary px-3 py-2.5 rounded-xl flex-shrink-0"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageThread;
