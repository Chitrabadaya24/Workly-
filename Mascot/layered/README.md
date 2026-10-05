# Codeo Mascot — Layered Front Asset

Production-ready SVG derived from `../Mascot front.svg`. Visual appearance is unchanged; only structure, naming, and animation hooks were added.

## Files

| File | Purpose |
|------|---------|
| `mascot-front.svg` | Layered SVG with `id` + `data-part` on every animatable group |
| `mascot-parts.json` | Part IDs, transform origins, path counts |
| `mascot-parts.js` | ES module constants for React / Framer Motion |

## Layer hierarchy

```
mascot
├── glow-effects
├── tail
├── left-leg / right-leg
├── shoes
├── hoodie
│   ├── hood
│   ├── hoodie-body
│   ├── strings
│   └── logo
├── left-arm / right-arm
├── left-hand / right-hand
└── head
    ├── left-ear / right-ear
    ├── hair
    ├── face
    ├── eyebrows
    ├── left-eye / right-eye
    ├── nose
    └── mouth
```

## React + Framer Motion

```jsx
import { motion } from 'framer-motion';
import { MASCOT_PARTS } from '../../../Mascot/layered/mascot-parts.js';

// Inline SVG (import as React component via SVGR, or fetch and dangerouslySetInnerHTML)
const [originX, originY] = MASCOT_PARTS['left-arm'].split(' ');

<motion.g
  id="left-arm"
  data-part="left-arm"
  style={{ transformOrigin: `${originX}px ${originY}px` }}
  animate={{ rotate: [0, 12, -8, 0] }}
  transition={{ duration: 0.6 }}
/>
```

## Targeting parts

```js
document.querySelector('#mascot [data-part="left-eye"]');
document.querySelector('#mascot [data-part="tail"]');
```

## Regenerate

```bash
node ../_build-layered.cjs
```

## Notes

- Source artwork is raster-traced (~6.4k paths). Parts are grouped by spatial heuristics, not hand-traced Béziers.
- For expression switching (eyes/mouth), hide/show or overlay vector groups in `left-eye`, `right-eye`, `mouth`.
- `Mascot front.svg` in the parent folder is the source file and is not overwritten by the build script.
