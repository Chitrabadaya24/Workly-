/** Sit / stand icons for the Codeo mascot pose toggle */

const S = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
};

export function SitDownIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="6.2" r="2.5" {...S} />
      <path
        d="M12 8.8c-3.2 0-5.5 2.4-5.5 5.5 0 1.1.3 2.1.9 2.8M12 8.8c3.2 0 5.5 2.4 5.5 5.5 0 1.1-.3 2.1-.9 2.8"
        {...S}
      />
      <path d="M8.2 17.1h7.6" {...S} />
      <ellipse cx="9.5" cy="18.6" rx="2.2" ry="1.15" fill="currentColor" />
      <ellipse cx="14.5" cy="18.6" rx="2.2" ry="1.15" fill="currentColor" />
    </svg>
  );
}

export function StandUpIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.8v2M9.5 5.2 12 2.8l2.5 2.4" {...S} />
      <circle cx="12" cy="8.8" r="2.5" {...S} />
      <path d="M12 11.4v5.8" {...S} />
      <path d="M8.5 20.2 10 14.8l2 1.6 2-1.6 1.5 5.4" {...S} />
      <path d="M8.8 14h6.4" {...S} />
    </svg>
  );
}
