import { useState, useEffect } from 'react';
import { meetingAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import MessageThread from '../../components/messages/MessageThread';
import { StatusBadge, UrgencyBadge } from '../../components/common/Badges';
import { formatDistanceToNow } from 'date-fns';

const EmployeeMessagesPage = () => {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    meetingAPI.getMy({ limit: 50 })
      .then(({ data }) => {
        setRequests(data.requests);
        if (data.requests.length > 0) setSelected(data.requests[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <PageHeader title="Meeting discussions" subtitle="Communicate directly about your meeting requests" />

      <div className="flex flex-1 gap-0 card p-0 overflow-hidden min-h-0" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-surface-100 dark:border-surface-800 flex flex-col">
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">My Requests</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center pt-8">
                <div className="w-6 h-6 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-center text-surface-400 text-sm pt-8 px-4">No requests yet</p>
            ) : requests.map(req => (
              <button key={req._id} onClick={() => setSelected(req)}
                className={`w-full text-left px-4 py-3 border-b border-surface-50 dark:border-surface-800 transition-colors ${
                  selected?._id === req._id
                    ? 'bg-primary-50 dark:bg-primary-950/30'
                    : 'hover:bg-surface-50 dark:hover:bg-surface-800'
                }`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate flex-1">{req.title}</p>
                  <UrgencyBadge urgency={req.urgency} />
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge status={req.status} />
                  <span className="text-[10px] text-surface-400">
                    {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <MessageThread requestId={selected._id} requestTitle={selected.title} />
          ) : (
            <div className="flex items-center justify-center h-full text-surface-400">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-sm">Select a request to chat</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeMessagesPage;
