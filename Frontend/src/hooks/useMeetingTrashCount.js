import { useState, useEffect, useCallback } from 'react';
import { meetAPI } from '../services/apiService';
import { getSocket } from '../socket/socket';

export function useMeetingTrashCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    meetAPI.getStats()
      .then(({ data }) => setCount(data.stats?.trashed ?? data.stats?.completed ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return undefined;

    socket.on('meeting_trashed', refresh);
    socket.on('meeting_restored', refresh);
    socket.on('meeting_deleted', refresh);
    socket.on('trash_emptied', refresh);
    socket.on('trash_bulk_deleted', refresh);
    socket.on('new_meeting', refresh);

    return () => {
      socket.off('meeting_trashed', refresh);
      socket.off('meeting_restored', refresh);
      socket.off('meeting_deleted', refresh);
      socket.off('trash_emptied', refresh);
      socket.off('trash_bulk_deleted', refresh);
      socket.off('new_meeting', refresh);
    };
  }, [refresh]);

  return count;
}
