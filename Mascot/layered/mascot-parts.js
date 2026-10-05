/** Animation targets for Codeo mascot — generated from Mascot front.svg */
export const MASCOT_VIEWBOX = '0 0 1024 1536';
export const MASCOT_SIZE = { width: 1024, height: 1536 };

export const MASCOT_PARTS = {
  "mascot": "512 768",
  "glow-effects": "512 1400",
  "tail": "160 820",
  "left-leg": "400 1000",
  "right-leg": "624 1000",
  "shoes": "512 1180",
  "hoodie": "512 720",
  "hood": "512 460",
  "hoodie-body": "512 740",
  "strings": "512 660",
  "logo": "512 760",
  "left-arm": "260 700",
  "right-arm": "764 700",
  "left-hand": "200 880",
  "right-hand": "824 880",
  "head": "512 360",
  "left-ear": "330 180",
  "right-ear": "694 180",
  "hair": "512 200",
  "face": "512 380",
  "eyebrows": "512 310",
  "left-eye": "430 370",
  "right-eye": "594 370",
  "nose": "512 430",
  "mouth": "512 480"
};

/** CSS selector helper */
export function mascotPartSelector(part) {
  return `#mascot [data-part="${part}"]`;
}
