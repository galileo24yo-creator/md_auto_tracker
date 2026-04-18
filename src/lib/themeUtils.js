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
export const normalizeTheme = (name) => {
  if (!name) return "";
  let n = String(name);
  
  // 1. 全角英数記号を半角に変換
  n = n.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
       .replace(/－/g, '-') // 全角ハイフンを半角に
       .replace(/　/g, ' '); // 全角スペースを半角に

  // 2. カッコ内のテキスト（振る仮名など）を削除
  // 全角「（）」および半角「()」に対応
  n = n.replace(/[（\(][^）\)]*[）\)]/g, "");
  
  // 3. 前後の空白を削除
  n = n.trim();
  
  // 4. 既知のエイリアスがあれば変換、なければそのまま返す
  // 大文字小文字の違いを吸収するため、キーチェック時は少し柔軟にする
  const canonical = THEME_ALIASES[n];
  if (canonical) return canonical;
  
  // 英語名が含まれる場合、大文字小文字を無視してチェック
  for (const [alias, canonicalName] of Object.entries(THEME_ALIASES)) {
    if (alias.toLowerCase() === n.toLowerCase()) {
      return canonicalName;
    }
  }
  
  return n;
};

/**
 * 複数のテーマを分割・正規化して結合し直す
 * 例: "転生炎獣, エルド" -> "サラマングレイト + エルドリッチ"
 */
export const normalizeThemeString = (themeStr) => {
  if (!themeStr) return "";
  return String(themeStr)
    .split(/[,、，\+]+/)
    .map(t => normalizeTheme(t))
    .filter(Boolean)
    .sort()
    .join(' + ');
};
