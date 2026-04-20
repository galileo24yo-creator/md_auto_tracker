/**
 * テーマ名の表記ゆれを正規化するためのユーティリティ
 */

const THEME_ALIASES = {
  // 通称 -> 正式名 のマッピング
  "転生炎獣": "サラマングレイト",
  "スネークアイ": "スネークアイ",
  "Snake-Eye": "スネークアイ",
  "Snake-Eyes": "スネークアイ",
  "天盃": "天盃龍",
  "天盃龍": "天盃龍",
  "エルド": "エルドリッチ",
  "エルドリッチ": "エルドリッチ",
  "斬機": "斬機",
  "Mathmech": "斬機",
  "閃刀": "閃刀姫",
  "Sky Striker": "閃刀姫",
  "R-ACE": "R－ACE",
  "レスキューエース": "R－ACE",
  "ふわん": "ふわんだりぃず",
  "ふわんだりぃず": "ふわんだりぃず"
};

/**
 * デッキ名・テーマ名を正規化する
 * 1. カッコ内の読み（振る仮名）を削除: "Ｒ.Ｂ.（リボルボット）" -> "Ｒ.Ｂ."
 * 2. 前後の空白を削除
 * 3. 既知のエイリアスを名寄せ
 */
const CASE_INSENSITIVE_ALIASES = Object.keys(THEME_ALIASES).reduce((acc, key) => {
  acc[key.toLowerCase()] = THEME_ALIASES[key];
  return acc;
}, {});

// 計算負荷軽減のためのキャッシュ
const normalizationCache = new Map();

/**
 * デッキ名・テーマ名を正規化する
 */
export const normalizeTheme = (name) => {
  if (!name) return "";
  const originalName = String(name);
  if (normalizationCache.has(originalName)) return normalizationCache.get(originalName);

  let n = originalName;
  
  // 1. 全角英数記号を半角に変換
  n = n.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
       .replace(/－/g, '-') 
       .replace(/　/g, ' '); 

  // 2. カッコ内のテキスト（振る仮名など）を削除
  n = n.replace(/[（\(][^）\)]*[）\)]/g, "");
  
  // 3. 前後の空白を削除
  n = n.trim();
  
  // 4. 既知のエイリアスがあれば変換
  const lowerName = n.toLowerCase();
  const canonical = CASE_INSENSITIVE_ALIASES[lowerName];
  const result = canonical || n;

  // キャッシュに保存
  normalizationCache.set(originalName, result);
  return result;
};

const stringNormalizationCache = new Map();

/**
 * 複数のテーマを分割・正規化して結合し直す
 * 例: "転生炎獣, エルド" -> "サラマングレイト + エルドリッチ"
 */
export const normalizeThemeString = (themeStr) => {
  if (!themeStr) return "";
  const original = String(themeStr);
  if (stringNormalizationCache.has(original)) return stringNormalizationCache.get(original);

  const result = original
    .split(/[,、，\+]+/)
    .map(t => normalizeTheme(t))
    .filter(Boolean)
    .sort()
    .join(' + ');
    
  stringNormalizationCache.set(original, result);
  return result;
};
