import { format } from 'date-fns';

const statusConfig = {
  upcoming: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  live:     { label: '🔴 Live',  cls: 'bg-red-100 text-red-700 animate-pulse', dot: 'bg-red-500' },
  completed:{ label: 'Completed',cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled:{ label: 'Cancelled',cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

const MeetingCard = ({
  meeting,
  onJoin,
  onEdit,
  onDelete,
  onRestore,
  isCEO,
  inTrash = false,
  canDeleteFromTrash = false,
  selectable = false,
  selected = false,
  onSelectChange,
}) => {
  const sc = statusConfig[meeting.status] || statusConfig.upcoming;
  const isLive = meeting.status === 'live';
  const isEnded = meeting.status === 'completed' || meeting.status === 'cancelled';

  return (
    <div className={`card hover:shadow-md transition-all duration-200 ${inTrash ? 'opacity-90' : ''} ${selected ? 'ring-2 ring-primary-500/60 border-primary-300 dark:border-primary-500/40' : ''}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {selectable && (
          <label className="flex items-start pt-1 cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              checked={selected}
              onChange={(e) => onSelectChange?.(meeting._id, e.target.checked)}
              aria-label={`Select ${meeting.title}`}
            />
          </label>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-surface-900 dark:text-white">{meeting.title}</h3>
            <span className={`badge ${sc.cls} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
            {inTrash && (
              <span className="badge bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                🗑 In trash
              </span>
            )}
          </div>
          {meeting.description && (
            <p className="text-sm text-surface-500 mb-2 line-clamp-1">{meeting.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-surface-400 flex-wrap">
            <span>📅 {format(new Date(meeting.date), 'MMM d, yyyy')}</span>
            <span>🕐 {meeting.time}</span>
            <span>⏱ {meeting.duration} min</span>
            <span>👤 {meeting.createdBy?.fullName}</span>
            {inTrash && meeting.trashedAt && (
              <span>🗑 {format(new Date(meeting.trashedAt), 'MMM d, yyyy')}</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {meeting.participants?.slice(0, 4).map((p) => (
              <div key={p._id} title={p.fullName}
                className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 text-[10px] font-bold">
                {p.fullName?.charAt(0)}
              </div>
            ))}
            {meeting.participants?.length > 4 && (
              <span className="text-xs text-surface-400">+{meeting.participants.length - 4} more</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          {!inTrash && (
            <button
              onClick={() => meeting.meetLink && !isEnded && onJoin(meeting.meetLink)}
              disabled={isEnded || !meeting.meetLink}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isEnded || !meeting.meetLink
                  ? 'bg-surface-100 text-surface-400 cursor-not-allowed'
                  : isLive
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {isEnded
                ? '✓ Ended'
                : !meeting.meetLink
                ? '📅 No Link'
                : isLive
                ? '🔴 Join Now'
                : '📹 Join Meeting'}
            </button>
          )}

          {(isCEO || (inTrash && canDeleteFromTrash)) && (
            <div className="flex gap-1">
              {inTrash ? (
                <>
                  {isCEO && onRestore && (
                    <button onClick={() => onRestore(meeting._id)}
                      className="btn-ghost text-xs py-1 px-2 text-emerald-600">↩ Restore</button>
                  )}
                  <button onClick={() => onDelete(meeting._id)}
                    className="btn-ghost text-xs py-1 px-2 text-red-500">Permanent Delete</button>
                </>
              ) : isCEO ? (
                <>
                  <button onClick={() => onEdit(meeting)}
                    className="btn-ghost text-xs py-1 px-2">✏️ Edit</button>
                  <button onClick={() => onDelete(meeting._id)}
                    className="btn-ghost text-xs py-1 px-2 text-red-500" title="Move to trash">🗑</button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {meeting.meetLink && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
          <p className="text-xs text-surface-400 font-mono truncate flex-1 mr-3">{meeting.meetLink}</p>
          {!inTrash && (
            <button
              onClick={() => { navigator.clipboard.writeText(meeting.meetLink); }}
              className="text-xs text-primary-600 hover:text-primary-700 flex-shrink-0"
            >
              📋 Copy Link
            </button>
          )}
        </div>
      )}

      {!meeting.meetLink && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800">
          <p className="text-xs text-surface-400">📅 No meeting link — in-person or other platform</p>
        </div>
      )}
    </div>
  );
};

export default MeetingCard;
