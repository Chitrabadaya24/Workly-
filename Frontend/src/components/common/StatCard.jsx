const StatCard = ({ title, value, subtitle, icon, color = 'primary', trend }) => {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-violet-600',
  };

  return (
    <div className="card flex items-start gap-4">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">{title}</p>
        <div className="flex items-end gap-2 mt-0.5">
          <p className="text-2xl font-display font-bold text-surface-900 dark:text-white leading-none">
            {value}
          </p>
          {trend !== undefined && (
            <span className={`text-xs font-semibold mb-0.5 ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default StatCard;
