const EmptyState = ({ icon = '📭', title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-3">{icon}</div>
    <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300 mb-1">{title}</h3>
    {description && <p className="text-sm text-surface-400 mb-4 max-w-xs">{description}</p>}
    {action && action}
  </div>
);

export default EmptyState;
