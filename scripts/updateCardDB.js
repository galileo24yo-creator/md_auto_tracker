import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const JA_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?language=ja';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'card_db.json');
const MANUAL_FILE = path.join(process.cwd(), 'public', 'manual_cards.json');

// 全角を半角に変換するなどの正規化処理
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英数記号 -> 半角
    .replace(/－/g, '-') // 全角ハイフン -> 半角
    .replace(/　/g, ' ') // 全角スペース -> 半角
    // ギリシャ文字の誤読対策 (OCRが読みやすいアルファベット等に寄せる)
    .replace(/α/g, 'a')
    .replace(/β/g, 'b')
    .replace(/γ/g, 'y') // ガンマは y や v に誤読されやすいため
    .replace(/δ/g, 'd')
    .replace(/ε/g, 'e')
    .replace(/\s+/g, '') // 全てのスペースを除去（検索用）
    .trim();
}

const ARCHETYPE_MAP = {
  'K9': 'Ｋ９（ケーナイン）',
  'Blackwing': 'ＢＦ（ブラックフェザー）',
  'Blue-Eyes': '青眼',
  'Red-Eyes': '真紅眼',
  'Dark Magician': 'ブラック・マジシャン',
  'Adamancipator': 'アダマシア',
  'Destiny HERO': 'Ｄ－ＨＥＲＯ',
  'Elemental HERO': 'Ｅ・ＨＥＲＯ',
  'Evil HERO': 'Ｅ－ＨＥＲＯ',
  'Masked HERO': 'Ｍ・ＨＥＲＯ',
  'Evil★Twin': 'イビルツイン',
  'Live☆Twin': 'ライブツイン',
  'Sky Striker': '閃刀姫',
  'Tearlaments': 'ティアラメンツ',
  'Kashtira': 'クシャトリラ',
  'Floowandereeze': 'ふわんだりぃず',
  'Labrynth': 'ラビュリンス',
  'Snake-Eye': 'スネークアイ',
  'Purrely': 'ピュアリィ',
  'Mikanko': '御巫',
  'Rescue-ACE': 'Ｒ－ＡＣＥ',
  'Tenpyai Dragon': '天盃龍',
  'Voiceless Voice': '粛声',
  'Kewl Tune': 'キラーチューン',
  'Fiendsmith': 'デモンスミス',
  'Mitsurugi': '巳剣',
  'Maliss': 'M∀LICE',
  'Radiant Typhoon': '絢嵐',
  'Vanquish Soul': 'ＶＳ（ヴァンキッシュ・ソウル）',
  'Temple of the Kings': '王家の神殿',
  'Apophis': 'アポピス',
  'Serket': 'セルケト',
  'Primite': '原石',
  'Dracotail': 'ドラゴンテイル',
  'Solfachord': 'ドレミコード',
  'Yummy': 'ヤミー',
  'R.B.': 'Ｒ.Ｂ.（リボルボット）',
  'Ryzeal': 'ライゼオル',
  'Magnet': 'マグネット・ウォリアー',
  'Branded': '烙印',
  'Despia': 'デスピア',
  'Bystial': 'ビーステッド',
  'Dogmatika': 'ドラグマ',
  'Albaz': 'アルバスの落胤',
  'Icejade': '氷水',
  'Swordsoul': '相剣',
  'Tri-Brigade': '鉄獣戦線',
  'Chimera': 'キマイラ',
  'Springans': 'スプリガンズ',
  'Spright': 'スプライト',
  'Therion': 'セリオンズ',
  'Sinful Spoils': '罪宝',
  'Diabellstar': 'ディアベルスター',
  'Snake-Eye': 'スネークアイ',
  'Azamina': 'アザミナ',
  'White Forest': '白き森',
  'Artmage': 'アルトメギア',
  'DoomZ': 'ドゥームズ',
  'Elfnote': 'エルフェンノーツ',
  'Power Patron': '獄神',
  'Lunalight': '月光（ムーンライト）',
  'Gem-Knight': 'ジェムナイト',
  'Gem-': 'ジェムナイト'
};

async function updateDB() {
  console.log('🔄 Updating database with hybrid merge (All + Japanese)...');

  try {
    // Phase 1: Fetch All Cards (Foundation)
    console.log('Fetching all cards (English context)...');
    const baseResponse = await fetch(BASE_URL);
    if (!baseResponse.ok) throw new Error(`Base API error: ${baseResponse.status}`);
    const baseData = await baseResponse.json();

    // IDをキーにしたマップを作成
    const cardMap = new Map();
    baseData.data.forEach(card => {
      cardMap.set(card.id, {
        id: card.id,
        name: card.name, // 初期値は英語名
        archetype: card.archetype || ''
      });
    });
    console.log(`- Loaded ${cardMap.size} base cards.`);

    // Phase 2: Fetch Japanese Names
    console.log('Fetching Japanese names...');
    let jaData = null;
    const jaResponse = await fetch(JA_URL);
    if (!jaResponse.ok) {
      console.warn('⚠️ Japanese API failed, using English names as fallback.');
    } else {
      jaData = await jaResponse.json();
      jaData.data.forEach(card => {
        if (cardMap.has(card.id)) {
          const existing = cardMap.get(card.id);
          existing.name = card.name; // 日本語名で上書き
          // テーマ名も日本語があればここで置換（APIが対応していれば）
        }
      });
      console.log(`- Patched Japanese names for ${jaData.data.length} cards.`);
    }

    // Final Mapping & Normalization
    const finalCards = Array.from(cardMap.values()).map(card => ({
      ...card,
      normalizedName: normalizeText(card.name),
      archetype: ARCHETYPE_MAP[card.archetype] || card.archetype
    }));

    // Phase 3: Manual Overrides
    const manualIds = new Set();
    if (fs.existsSync(MANUAL_FILE)) {
      console.log('Merging manual card data...');
      const manualData = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
      manualData.forEach(mCard => {
        manualIds.add(Number(mCard.id));
        // マニアルデータは常に最優先
        const idx = finalCards.findIndex(c => c.id === mCard.id);
        const processedMCard = {
          ...mCard,
          normalizedName: normalizeText(mCard.name),
          archetype: ARCHETYPE_MAP[mCard.archetype] || mCard.archetype
        };
        if (idx !== -1) {
          finalCards[idx] = processedMCard;
        } else {
          finalCards.push(processedMCard);
        }
      });
      console.log(`- Merged ${manualData.length} manual entry/entries.`);
    }

    // Detect untranslated cards (excluding ones in manual_cards.json)
    const jaIds = jaData ? new Set(jaData.data.map(c => Number(c.id))) : new Set();
    const untranslatedList = Array.from(cardMap.values())
      .filter(card => !jaIds.has(Number(card.id)) && !manualIds.has(Number(card.id)))
      .map(card => `${card.id}: ${card.name}`)
      .sort((a, b) => a.localeCompare(b))
      .join('\n');
    fs.writeFileSync(path.join(process.cwd(), 'public', 'untranslated_cards.txt'), untranslatedList);
    console.log(`- Generated untranslated_cards.txt with ${untranslatedList ? untranslatedList.split('\n').length : 0} entries.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalCards, null, 2));
    console.log(`✅ Successfully generated card_db.json with ${finalCards.length} cards!`);

  } catch (err) {
    console.error('❌ Failed to update card database:', err);
    process.exit(1);
  }
}

updateDB();
