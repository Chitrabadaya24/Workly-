import { meetingAPI } from '../../services/apiService';

export default function RequestAttachments({ requestId, attachments = [], canDelete = false, onChange }) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div
          key={att._id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs"
        >
          <span aria-hidden>📎</span>
          <button
            type="button"
            className="text-primary-600 dark:text-primary-400 hover:underline truncate max-w-[140px]"
            onClick={() => meetingAPI.downloadAttachment(requestId, att._id, att.name)}
          >
            {att.name}
          </button>
          {canDelete && (
            <button
              type="button"
              className="text-surface-400 hover:text-red-500 ml-1"
              aria-label={`Remove ${att.name}`}
              onClick={async () => {
                await meetingAPI.deleteAttachment(requestId, att._id);
                onChange?.();
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
