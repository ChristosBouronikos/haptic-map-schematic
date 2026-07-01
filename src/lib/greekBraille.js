const ACCENT = "\u2810";

const GREEK_TO_BRAILLE = {
  α: "\u2801",
  β: "\u2803",
  γ: "\u281b",
  δ: "\u2819",
  ε: "\u2811",
  ζ: "\u2835",
  η: "\u281c",
  θ: "\u2839",
  ι: "\u280a",
  κ: "\u2805",
  λ: "\u2807",
  μ: "\u280d",
  ν: "\u281d",
  ξ: "\u282d",
  ο: "\u2815",
  π: "\u280f",
  ρ: "\u2817",
  σ: "\u280e",
  ς: "\u280e",
  τ: "\u281e",
  υ: "\u283d",
  φ: "\u280b",
  χ: "\u2813",
  ψ: "\u282f",
  ω: "\u281a"
};

const DIGRAPHS = [
  ["αι", "\u2823"],
  ["ει", "\u2829"],
  ["οι", "\u282a"],
  ["υι", "\u283b"],
  ["αυ", "\u2821"],
  ["ευ", "\u2831"],
  ["ηυ", "\u2833"],
  ["ου", "\u2825"]
];

const PUNCTUATION = {
  " ": " ",
  "-": "\u2824",
  ".": "\u2832",
  ",": "\u2802",
  ";": "\u2822",
  ":": "\u2806",
  "?": "\u2822",
  "'": "\u2804",
  "/": "\u280c"
};

const ACCENTED = {
  ά: "α",
  έ: "ε",
  ή: "η",
  ί: "ι",
  ϊ: "ι",
  ΐ: "ι",
  ό: "ο",
  ύ: "υ",
  ϋ: "υ",
  ΰ: "υ",
  ώ: "ω"
};

export function toGreekBraille(value) {
  const normalized = value.normalize("NFC").toLocaleLowerCase("el-GR");
  let result = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const accentBase = ACCENTED[char];
    if (accentBase) {
      result += ACCENT + GREEK_TO_BRAILLE[accentBase];
      continue;
    }

    const pair = normalized.slice(index, index + 2);
    const digraph = DIGRAPHS.find(([letters]) => letters === pair);
    if (digraph) {
      result += digraph[1];
      index += 1;
      continue;
    }

    result += GREEK_TO_BRAILLE[char] ?? PUNCTUATION[char] ?? char;
  }

  return result;
}
