const LoadingSpinner = ({ fullPage = false, size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const spinner = (
    <div
      className={`${sizes[size]} border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin`}
    />
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface-50 dark:bg-surface-950 z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
