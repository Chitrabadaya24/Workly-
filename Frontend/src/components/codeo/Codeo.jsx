import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * Codeo — "The Guardian of Code"
 * Standing: official mascot.svg. Sitting: official Mascot seat.svg.
 * Hover / wave: right paw only (body stays still).
 */

const MASCOT_STAND_SRC = '/mascot/mascot.svg';
const MASCOT_SEAT_SRC = '/mascot/mascot-seat.svg';
const ARIA_LABEL = 'Codeo, the Guardian of Code';
/** Landscape mascot assets (1536×1024) */
const IMG_ASPECT = 1024 / 1536;

const P = {
  cyan: '#22d3ee',
  purple: '#8b5cf6',
};

const CELEBRATE_SPARKS = [
  [0.12, 0.22],
  [0.88, 0.24],
  [0.15, 0.48],
  [0.85, 0.5],
];

/** Right paw clip + pivot — tuned for landscape mascot.svg / mascot-seat.svg */
const HAND_POSE = {
  stand: {
    handClip: 'polygon(70% 6%, 99% 2%, 100% 40%, 82% 46%, 66% 34%)',
    bodyClip:
      'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 70% 6%, 66% 34%, 82% 46%, 100% 40%, 99% 2%, 70% 6%)',
    origin: '74% 18%',
  },
  sit: {
    handClip: 'polygon(68% 14%, 98% 10%, 100% 48%, 80% 54%, 64% 42%)',
    bodyClip:
      'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 68% 14%, 64% 42%, 80% 54%, 100% 48%, 98% 10%, 68% 14%)',
    origin: '72% 24%',
  },
};

function CelebrateSparkles() {
  return CELEBRATE_SPARKS.map(([x, y], i) => (
    <motion.div
      key={i}
      className="pointer-events-none absolute rounded-full"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: 5,
        height: 5,
        background: i % 2 ? P.purple : P.cyan,
        zIndex: 2,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
    />
  ));
}

function MascotArtwork({ src, w, imgScale, imgOrigin, handActive, waving, isSitting }) {
  const boxH = w * IMG_ASPECT;
  const pose = HAND_POSE[isSitting ? 'sit' : 'stand'];
  const imgStyle = {
    display: 'block',
    width: w,
    height: boxH,
    objectFit: 'fill',
  };

  const waveRotate = waving
    ? [0, 18, -14, 16, -10, 6, 0]
    : [0, 14, -10, 12, -8, 0];

  return (
    <div
      style={{
        width: w,
        height: boxH,
        transform: `scale(${imgScale})`,
        transformOrigin: imgOrigin,
        position: 'relative',
      }}
    >
      <img
        src={src}
        alt={ARIA_LABEL}
        draggable={false}
        style={{
          ...imgStyle,
          clipPath: handActive ? pose.bodyClip : undefined,
        }}
      />
      {handActive && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            clipPath: pose.handClip,
            transformOrigin: pose.origin,
          }}
          animate={{ rotate: waveRotate }}
          transition={
            waving
              ? { duration: 0.7, ease: 'easeInOut' }
              : { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <img src={src} alt="" aria-hidden draggable={false} style={imgStyle} />
        </motion.div>
      )}
    </div>
  );
}

export default function Codeo({ mood = 'idle', size = 120, onClick, chatOpen = false, isSitting = false }) {
  const w = size;
  const h = size * (330 / 160);
  const bob = mood === 'celebrate'
    ? [0, -22, 0, -18, 0]
    : mood === 'thinking'
    ? [0, -2, 0]
    : [0, -4, 0];

  const [headTilt, setHeadTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [waving, setWaving] = useState(false);
  const handActive = (isHovering || waving) && !chatOpen;

  const SIT_SCALE = 1.02;
  const SIT_IMG_SCALE = 1.28;
  const STAND_IMG_SCALE = 1.28;
  const sitCompact = isSitting && !chatOpen;
  const imgScale = isSitting ? SIT_IMG_SCALE : STAND_IMG_SCALE;
  const imgOrigin = isSitting ? '50% 88%' : '50% 92%';
  const src = isSitting ? MASCOT_SEAT_SRC : MASCOT_STAND_SRC;

  useEffect(() => {
    if (chatOpen) {
      setIsHovering(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[aria-label="${ARIA_LABEL}"]`);
      if (el?.matches(':hover')) setIsHovering(true);
    });
    return () => cancelAnimationFrame(id);
  }, [chatOpen]);

  const doWave = useCallback(() => {
    setWaving(true);
    window.setTimeout(() => setWaving(false), 700);
  }, []);

  useEffect(() => {
    window.__codeoWave = doWave;
    return () => { delete window.__codeoWave; };
  }, [doWave]);

  const handleClick = () => {
    if (!onClick) return;
    doWave();
    onClick();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isSitting) return;
      const el = document.querySelector(`[aria-label="${ARIA_LABEL}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.3;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const maxOffset = Math.max(4, size * 0.05);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const factor = Math.min(1, distance / 300);
      setHeadTilt({
        x: (dx / (distance || 1)) * maxOffset * factor,
        y: (dy / (distance || 1)) * maxOffset * factor,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isSitting, size]);

  useEffect(() => {
    if (isSitting) setHeadTilt({ x: 0, y: 0 });
  }, [isSitting]);

  const bodyAnimate = sitCompact
    ? { y: 8, rotate: 0, scale: SIT_SCALE }
    : { y: bob, rotate: 0, scale: 1 };

  const bodyTransition = isSitting
    ? { duration: 0.38, ease: 'easeInOut' }
    : {
        y: { duration: mood === 'celebrate' ? 0.9 : 3, repeat: Infinity, ease: mood === 'celebrate' ? 'easeOut' : 'easeInOut' },
        scale: { duration: 0.38, ease: 'easeInOut' },
      };

  return (
    <motion.div
      onClick={onClick ? handleClick : undefined}
      onMouseEnter={() => { if (!chatOpen) setIsHovering(true); }}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        width: w,
        height: h,
        cursor: 'pointer',
        transformOrigin: sitCompact ? '50% 95%' : '50% 92%',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      animate={bodyAnimate}
      transition={bodyTransition}
      whileTap={onClick ? { scale: 0.95 } : undefined}
    >
      <motion.div
        animate={{ x: headTilt.x, y: headTilt.y }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <MascotArtwork
          src={src}
          w={w}
          imgScale={imgScale}
          imgOrigin={imgOrigin}
          handActive={handActive}
          waving={waving}
          isSitting={isSitting}
        />
      </motion.div>
      {mood === 'celebrate' && <CelebrateSparkles />}
    </motion.div>
  );
}
