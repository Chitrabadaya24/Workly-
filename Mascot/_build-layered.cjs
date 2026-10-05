/**
 * Builds Mascot/layered/mascot-front.svg from Mascot front.svg
 * Preserves exact path geometry, fills, and transforms — structure only.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const INPUT = path.join(ROOT, "Mascot front.svg");
const OUT_DIR = path.join(ROOT, "layered");
const OUTPUT = path.join(OUT_DIR, "mascot-front.svg");

const CX = 512;

function parseAttr(attrs, name) {
  const re = new RegExp(`\\s${name}="([^"]*)"`);
  return attrs.match(re)?.[1] ?? null;
}

function parseTranslate(transform) {
  if (!transform) return { x: 0, y: 0 };
  const m = transform.match(/translate\(([^)]+)\)/);
  if (!m) return { x: 0, y: 0 };
  const parts = m[1].split(/[,\s]+/).map(Number);
  return { x: parts[0] || 0, y: parts[1] || 0 };
}

function pathBounds(d) {
  const nums = d.match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 2) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0, w: 0, h: 0 };
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]);
    const y = parseFloat(nums[i + 1]);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0, w: 0, h: 0 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
  };
}

function luminance(hex) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexRgb(hex) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function isCyanish(hex) {
  const { r, g, b } = hexRgb(hex);
  return g > 130 && b > 150 && g >= r && b > r + 20;
}

function isPurpleish(hex) {
  const { r, g, b } = hexRgb(hex);
  return r > 70 && b > 90 && r > g && b > g;
}

function classify(gx, gy, fill, b) {
  const lum = luminance(fill);
  const size = Math.max(b.w, b.h);

  // Bottom ground shadow / ambient glow
  if (gy >= 1260) return "glow-effects";
  if (gy >= 1180 && lum < 90 && gx > 200 && gx < 824) return "glow-effects";

  // Shoes
  if (gy >= 1100 && gy < 1260 && gx > 260 && gx < 764) return "shoes";

  // Legs
  if (gy >= 860 && gy < 1140) {
    if (gx < CX - 42) return "left-leg";
    if (gx > CX + 42) return "right-leg";
  }

  // Tail (side mid-lower body)
  if (gy >= 500 && gy < 1080 && (gx < 200 || gx > 824)) return "tail";

  // Hands at extremities
  if (gy >= 700 && gy < 1040) {
    if (gx < 280) return "left-hand";
    if (gx > 744) return "right-hand";
  }

  // Arms
  if (gy >= 460 && gy < 940) {
    if (gx < 320) return "left-arm";
    if (gx > 704) return "right-arm";
  }

  const inFaceCore =
    gx > CX - 130 && gx < CX + 130 && gy > 260 && gy < 520;

  // Hood fabric ring around head (outside face core)
  if (gy >= 350 && gy < 580 && gx > CX - 230 && gx < CX + 230 && !inFaceCore) {
    return "hood";
  }

  // Head stack (y < 540)
  if (gy < 540) {
    // Ears — top outer
    if (gy < 240) {
      if (gx < CX - 72) return "left-ear";
      if (gx > CX + 72) return "right-ear";
      return "hair";
    }

    // Eyes — bright/cyan patches in face band
    if (gy >= 300 && gy < 440 && size < 100) {
      if (isCyanish(fill) || (lum > 150 && lum < 240)) {
        if (gx < CX - 20) return "left-eye";
        if (gx > CX + 20) return "right-eye";
      }
    }

    // Eyebrows / mask markings
    if (gy >= 250 && gy < 360 && lum < 55 && size < 120) {
      if (gx < CX - 10 || gx > CX + 10) return "eyebrows";
    }

    // Nose center dark
    if (gy >= 390 && gy < 470 && gx > CX - 44 && gx < CX + 44 && lum < 45) return "nose";

    // Mouth center
    if (gy >= 430 && gy < 530 && gx > CX - 100 && gx < CX + 100) {
      if (isPurpleish(fill) || lum < 55 || (lum > 90 && lum < 210)) return "mouth";
    }

    // Outer ears mid-head
    if (gy < 320) {
      if (gx < CX - 60) return "left-ear";
      if (gx > CX + 60) return "right-ear";
    }

    // Face mask zone
    if (inFaceCore || (gx > CX - 160 && gx < CX + 160 && gy > 220)) return "face";

    if (gy < 300) return "hair";
    return "face";
  }

  // Drawstrings
  if (gy >= 540 && gy < 800 && gx > CX - 44 && gx < CX + 44 && size < 50) return "strings";

  // Chest logo / accent
  if (gy >= 600 && gy < 880 && gx > CX - 100 && gx < CX + 100) {
    if (isCyanish(fill) || isPurpleish(fill) || lum > 165) return "logo";
  }

  // Hoodie torso
  if (gy >= 500 && gy < 1000 && gx > CX - 240 && gx < CX + 240) return "hoodie-body";

  // Specular highlights on limbs / hoodie (not face)
  if (lum >= 185 && gy > 520) return "glow-effects";

  if (gx < 300) return "left-arm";
  if (gx > 724) return "right-arm";
  return "hoodie-body";
}

const TREE = {
  mascot: {
    "glow-effects": null,
    tail: null,
    "left-leg": null,
    "right-leg": null,
    shoes: null,
    hoodie: {
      hood: null,
      "hoodie-body": null,
      strings: null,
      logo: null,
    },
    "left-arm": null,
    "right-arm": null,
    "left-hand": null,
    "right-hand": null,
    head: {
      "left-ear": null,
      "right-ear": null,
      hair: null,
      face: null,
      eyebrows: null,
      "left-eye": null,
      "right-eye": null,
      nose: null,
      mouth: null,
    },
  },
};

const TRANSFORM_ORIGINS = {
  mascot: "512 768",
  "glow-effects": "512 1400",
  tail: "160 820",
  "left-leg": "400 1000",
  "right-leg": "624 1000",
  shoes: "512 1180",
  hoodie: "512 720",
  hood: "512 460",
  "hoodie-body": "512 740",
  strings: "512 660",
  logo: "512 760",
  "left-arm": "260 700",
  "right-arm": "764 700",
  "left-hand": "200 880",
  "right-hand": "824 880",
  head: "512 360",
  "left-ear": "330 180",
  "right-ear": "694 180",
  hair: "512 200",
  face: "512 380",
  eyebrows: "512 310",
  "left-eye": "430 370",
  "right-eye": "594 370",
  nose: "512 430",
  mouth: "512 480",
};

const LEAF_PARTS = [
  "glow-effects",
  "tail",
  "left-leg",
  "right-leg",
  "shoes",
  "hood",
  "hoodie-body",
  "strings",
  "logo",
  "left-arm",
  "right-arm",
  "left-hand",
  "right-hand",
  "left-ear",
  "right-ear",
  "hair",
  "face",
  "eyebrows",
  "left-eye",
  "right-eye",
  "nose",
  "mouth",
];

function extractPaths(svgContent) {
  const paths = [];
  const regex = /<path\s+([^>]*)\/>/g;
  let m;
  while ((m = regex.exec(svgContent)) !== null) {
    const attrs = m[1];
    const d = parseAttr(` ${attrs}`, "d");
    if (!d || !d.trim()) continue;

    let fill = parseAttr(` ${attrs}`, "fill");
    if (!fill) {
      // inherit from parent <g fill="..."> — scan backwards
      const before = svgContent.slice(Math.max(0, m.index - 400), m.index);
      const parentFill = before.match(/<g\s+fill="([^"]+)"/g);
      fill = parentFill ? parentFill[parentFill.length - 1].match(/fill="([^"]+)"/)[1] : "#000000";
    }

    const transform = parseAttr(` ${attrs}`, "transform");
    const { x: tx, y: ty } = parseTranslate(transform);
    const bounds = pathBounds(d);
    const gx = tx + bounds.cx;
    const gy = ty + bounds.cy;
    const part = classify(gx, gy, fill, bounds);

    paths.push({ d, fill, transform, part, gy, lum: luminance(fill) });
  }
  return paths;
}

function renderPaths(items) {
  const lines = [];
  let currentFill = null;
  const sorted = [...items].sort((a, b) => a.gy - b.gy || a.lum - b.lum);

  for (const item of sorted) {
    if (item.fill !== currentFill) {
      if (currentFill !== null) lines.push("        </g>");
      currentFill = item.fill;
      lines.push(`        <g fill="${currentFill}">`);
    }
    const t = item.transform ? ` transform="${item.transform}"` : "";
    lines.push(`          <path d="${item.d}"${t}/>`);
  }
  if (currentFill !== null) lines.push("        </g>");
  return lines;
}

function originStyle(id) {
  const raw = TRANSFORM_ORIGINS[id] || "512 768";
  const [ox, oy] = raw.split(" ");
  return `transform-origin: ${ox}px ${oy}px`;
}

function renderGroup(id, items, indent) {
  const pad = " ".repeat(indent);
  const lines = [
    `${pad}<g id="${id}" data-part="${id}" style="${originStyle(id)}">`,
  ];
  if (items.length) lines.push(...renderPaths(items).map((l) => l));
  lines.push(`${pad}</g>`);
  return lines;
}

function buildBuckets(paths) {
  const buckets = Object.fromEntries(LEAF_PARTS.map((p) => [p, []]));
  for (const p of paths) buckets[p.part].push(p);
  return buckets;
}

function main() {
  const content = fs.readFileSync(INPUT, "utf8");
  const paths = extractPaths(content);
  const buckets = buildBuckets(paths);

  const counts = Object.fromEntries(LEAF_PARTS.map((p) => [p, buckets[p].length]));
  console.log("Paths kept:", paths.length);
  console.log("Per part:", counts);

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536"',
  );
  lines.push('  role="img" aria-label="Codeo mascot" data-component="mascot-front">');
  lines.push("  <title>Codeo Mascot Front</title>");
  lines.push(
    "  <desc>Production mascot asset with animation-ready body-part groups for React and Framer Motion.</desc>",
  );
  lines.push("");

  const origin = TRANSFORM_ORIGINS.mascot;
  lines.push(`  <g id="mascot" data-part="mascot" style="${originStyle("mascot")}">`);

  // Back-to-front paint order
  const backParts = ["glow-effects", "tail", "left-leg", "right-leg", "shoes"];
  for (const id of backParts) {
    if (buckets[id].length) lines.push(...renderGroup(id, buckets[id], 4));
  }

  lines.push(`    <g id="hoodie" data-part="hoodie" style="${originStyle("hoodie")}">`);
  for (const id of ["hood", "hoodie-body", "strings", "logo"]) {
    if (buckets[id].length) lines.push(...renderGroup(id, buckets[id], 6));
  }
  lines.push("    </g>");

  for (const id of ["left-arm", "right-arm", "left-hand", "right-hand"]) {
    if (buckets[id].length) lines.push(...renderGroup(id, buckets[id], 4));
  }

  lines.push(`    <g id="head" data-part="head" style="${originStyle("head")}">`);
  for (const id of [
    "left-ear",
    "right-ear",
    "hair",
    "face",
    "eyebrows",
    "left-eye",
    "right-eye",
    "nose",
    "mouth",
  ]) {
    if (buckets[id].length) lines.push(...renderGroup(id, buckets[id], 6));
  }
  lines.push("    </g>");

  lines.push("  </g>");
  lines.push("</svg>");
  lines.push("");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const output = lines.join("\n");
  fs.writeFileSync(OUTPUT, output, "utf8");
  console.log("Written:", OUTPUT);
  console.log("Bytes:", output.length);

  const manifest = {
    viewBox: "0 0 1024 1536",
    width: 1024,
    height: 1536,
    parts: TRANSFORM_ORIGINS,
    counts,
    paintOrder: [
      "glow-effects",
      "tail",
      "left-leg",
      "right-leg",
      "shoes",
      "hoodie",
      "hood",
      "hoodie-body",
      "strings",
      "logo",
      "left-arm",
      "right-arm",
      "left-hand",
      "right-hand",
      "head",
      "left-ear",
      "right-ear",
      "hair",
      "face",
      "eyebrows",
      "left-eye",
      "right-eye",
      "nose",
      "mouth",
    ],
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "mascot-parts.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  const jsLines = [
    "/** Animation targets for Codeo mascot — generated from Mascot front.svg */",
    "export const MASCOT_VIEWBOX = '0 0 1024 1536';",
    "export const MASCOT_SIZE = { width: 1024, height: 1536 };",
    "",
    "export const MASCOT_PARTS = " + JSON.stringify(TRANSFORM_ORIGINS, null, 2) + ";",
    "",
    "/** CSS selector helper */",
    "export function mascotPartSelector(part) {",
    '  return `#mascot [data-part="${part}"]`;',
    "}",
    "",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "mascot-parts.js"), jsLines.join("\n"), "utf8");
}

main();
