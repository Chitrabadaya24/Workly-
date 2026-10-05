/**
 * Codeo brand logo — the "{ }" curly-brace mark framing the raccoon face,
 * from the character sheet's LOGO CONCEPT. Use in the sidebar, login, or
 * loading screens.  <CodeoLogo size={40} withWordmark />
 */
const P = { cyan: '#22d3ee', purple: '#8b5cf6', dark: '#0d1118', white: '#eef2f7', fur: '#1a2129' };

export default function CodeoLogo({ size = 40, withWordmark = false }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-label="Codeo logo">
        <defs>
          <linearGradient id="cl-brace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={P.white} />
            <stop offset="100%" stopColor="#9fb4c8" />
          </linearGradient>
        </defs>
        {/* curly braces */}
        <path d="M 30 14 C 20 14 22 30 14 32 C 22 34 20 50 20 50 C 20 50 22 66 14 68 C 22 70 20 86 30 86"
          fill="none" stroke="url(#cl-brace)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 70 14 C 80 14 78 30 86 32 C 78 34 80 50 80 50 C 80 50 78 66 86 68 C 78 70 80 86 70 86"
          fill="none" stroke="url(#cl-brace)" strokeWidth="6" strokeLinecap="round" />
        {/* raccoon face silhouette */}
        <path d="M 50 30 C 64 30 70 40 70 54 C 70 70 60 78 50 78 C 40 78 30 70 30 54 C 30 40 36 30 50 30 Z" fill={P.fur} />
        {/* mask + glowing eyes */}
        <path d="M 34 46 C 38 40 46 40 50 43 C 54 40 62 40 66 46 C 67 53 62 57 56 57 C 52 57 50 53 50 53 C 50 53 48 57 44 57 C 38 57 33 53 34 46 Z" fill={P.dark} />
        <circle cx="43" cy="49" r="3.4" fill={P.cyan} style={{ filter: `drop-shadow(0 0 3px ${P.cyan})` }} />
        <circle cx="57" cy="49" r="3.4" fill={P.cyan} style={{ filter: `drop-shadow(0 0 3px ${P.cyan})` }} />
        {/* ears */}
        <path d="M 38 32 C 34 22 30 24 33 32 Z" fill={P.fur} />
        <path d="M 62 32 C 66 22 70 24 67 32 Z" fill={P.fur} />
      </svg>
      {withWordmark && (
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: size * 0.5, letterSpacing: '0.04em', color: P.white }}>
          CODE<span style={{ color: P.cyan }}>O</span>
        </span>
      )}
    </div>
  );
}
