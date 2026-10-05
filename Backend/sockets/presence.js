/** In-memory online presence keyed by userId → Set of socket ids */
const onlineSockets = new Map();

const addOnlineSocket = (userId, socketId) => {
  const key = String(userId);
  if (!onlineSockets.has(key)) onlineSockets.set(key, new Set());
  onlineSockets.get(key).add(socketId);
};

const removeOnlineSocket = (userId, socketId) => {
  const key = String(userId);
  const set = onlineSockets.get(key);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineSockets.delete(key);
    return true; // fully offline
  }
  return false;
};

const isUserOnline = (userId) => onlineSockets.has(String(userId));

const getOnlineUserIds = () => [...onlineSockets.keys()];

module.exports = {
  addOnlineSocket,
  removeOnlineSocket,
  isUserOnline,
  getOnlineUserIds,
};
