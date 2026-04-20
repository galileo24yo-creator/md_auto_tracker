import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const JA_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?language=ja';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'card_db.json');
const MANUAL_FILE = path.join(process.cwd(), 'public', 'manual_cards.json');
const INFERRED_LOG = path.join(process.cwd(), 'public', 'inferred_archetypes.txt');

// 全角を半角に変換するなどの正規化処理
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英数記号 -> 半角
    .replace(/－/g, '-') // 全角ハイフン -> 半角
    .replace(/　/g, ' ') // 全角スペース -> 半角
    .replace(/α/g, 'a')
    .replace(/β/g, 'b')
    .replace(/γ/g, 'y')
    .replace(/δ/g, 'd')
    .replace(/ε/g, 'e')
    .replace(/\s+/g, '') // 全てのスペースを除去（検索用）
    .trim();
}

// 万が一タグが混入していた場合の除去処理
function cleanRubyTags(text) {
  if (!text) return '';
  return text
    .replace(/<rt>.*?<\/rt>/g, '') 
    .replace(/<rp>.*?<\/rp>/g, '') 
    .replace(/<\/?ruby>/g, '')    
    .trim();
}

const ARCHETYPE_MAP = {
  'Altergeist': 'オルターガイスト',
  'Aroma': 'アロマ',
  'Artifact': 'アーティファクト',
  'Atlantis': 'アトランティス',
  'Barian\'s': 'バリアン',
  'Battlewasp': 'Ｂ・Ｆ（ビー・フォース）',
  'Beetrooper': 'ビートルーパー',
  'Black Luster Soldier': 'カオス・ソルジャー',
  'Blackwing': 'ＢＦ（ブラックフェザー）',
  'Blue-Eyes': 'ブルーアイズ',
  'Branded': '烙印',
  'Burning Abyss': '彼岸',
  'Bystial': 'ビーステッド',
  'Chaos': 'カオス',
  'Chronomaly': '先史遺産',
  'Cipher': 'サイファー',
  'Constellar': 'セイクリッド',
  'Crusadia': 'パラディオン',
  'Crystron': 'クリストロン',
  'Cyber Dragon': 'サイバー・ドラゴン',
  'Darklord': '堕天使',
  'Dark Magician': 'ブラック・マジシャン',
  'D/D': 'ＤＤ',
  'Despia': 'デスピア',
  'Destiny HERO': 'Ｄ－ＨＥＲＯ',
  'Dinomorphia': 'ダイノルフィア',
  'Dinowrestler': 'ダイノレスラー',
  'Dogmatika': 'ドラグマ',
  'Dracoslayer': '竜剣士',
  'Dragonmaid': 'ドラゴンメイド',
  'Drytron': 'ドライトロン',
  'Dual': 'デュアル',
  'Dinamist': 'ダイナミスト',
  'Earthbound': '地縛',
  'Eldlich': 'エルドリッチ',
  'Elemental HERO': 'Ｅ・ＨＥＲＯ',
  'Endymion': 'エンディミオン',
  'Evil Eye': '呪眼',
  'Evil HERO': 'Ｅ－ＨＥＲＯ',
  'Evil★Twin': 'イビルツイン',
  'Exodia': 'エクゾディア',
  'Exosister': 'エクソシスター',
  'F.A.': 'Ｆ.Ａ.',
  'Fabled': '魔轟神',
  'Fire Fist': '炎星',
  'Fire King': '炎王',
  'Floowandereeze': 'ふわんだりぃず',
  'Fortune Lady': 'フォーチュンレディ',
  'Fossil': '化石',
  'Fur Hire': '空牙団',
  'Galaxy': 'ギャラクシー',
  'Galaxy-Eyes': 'ギャラクシーアイズ',
  'Gem-Knight': 'ジェムナイト',
  'Generaider': 'ジェネレイド',
  'Ghostrick': 'ゴーストリック',
  'Gimmick Puppet': 'ギミック・パペット',
  'Gladiator Beast': '剣闘獣',
  'Gouki': '剛鬼',
  'Graydle': 'グレイドル',
  'Harpie': 'ハーピィ',
  'Hole': '落とし穴',
  'Horus': 'ホルス',
  'Ice Barrier': '氷結界',
  'Icejade': '氷水',
  'Ignister': '＠イグニスター',
  'Infinitrack': '無限起動',
  'Infernoid': 'インフェルノイド',
  'Infernoble Knight': '焔聖騎士',
  'Invoked': '召喚獣',
  'Inzektor': 'インゼクター',
  'Junk': 'ジャンク',
  'Kaiju': '壊獣',
  'Kashtira': 'クシャトリラ',
  'Knightmare': 'トロイメア',
  'Kozmo': 'Ｋｏｚｍｏ',
  'Kuriboh': 'クリボー',
  'Labrynth': 'ラビュリンス',
  'Lightsworn': 'ライトロード',
  'Live☆Twin': 'ライブツイン',
  'Lunalight': 'ムーンライト',
  'Machina': 'マシンナーズ',
  'Madolche': 'マドルチェ',
  'Magical Musket': '魔弾',
  'Majespecter': 'マジェスペクター',
  'Mannadium': 'マナドゥム',
  'Marincess': '海晶乙女',
  'Masked HERO': 'Ｍ・ＨＥＲＯ',
  'Mathmech': '斬機',
  'Mayakashi': '魔妖',
  'Mecha Phantom Beast': '幻獣機',
  'Melffy': 'メルフィー',
  'Metalfoes': 'メタルフォーゼ',
  'Metaphys': 'メタファイズ',
  'Mikanko': '御巫',
  'Mirror Force': '聖なるバリア',
  'Monarch': '帝',
  'Morphtronic': 'Ｄ（ディフォーマー）',
  'Myutant': 'ミュートリア',
  'Mythical Beast': '魔導獣',
  'Nekroz': '影霊衣',
  'Neo-Spacian': 'ネオスペーシアン',
  'Noble Knight': '聖騎士',
  'Number': 'Ｎｏ.（ナンバーズ）',
  'Odd-Eyes': 'オッドアイズ',
  'Orcust': 'オルフェゴール',
  'P.U.N.K.': 'Ｐ.Ｕ.Ｎ.Ｋ.',
  'Paleozoic': 'バージェストマ',
  'Pendulum': 'ペンデュラム',
  'Performapal': 'ＥＭ（エンタメイト）',
  'Performage': 'Ｅｍ（エンタメイジ）',
  'Phantasm Spiral': '幻煌龍',
  'Plunder Patroll': '海造賊',
  'Prank-Kids': 'プランキッズ',
  'Predaplant': '捕食植物',
  'Prophecy': '魔導',
  'Psy-Frame': 'ＰＳＹフレーム',
  'Purrely': 'ピュアリィ',
  'Qli': 'クリフォート',
  'Raidraptor': 'ＲＲ',
  'Rescue-ACE': 'Ｒ－ＡＣＥ',
  'Rikka': '六花',
  'Ritual Beast': '霊獣',
  'Red-Eyes': 'レッドアイズ',
  'Salamangreat': 'サラマングレイト',
  'Scareclaw': 'スケアクロー',
  'Scrap': 'スクラップ',
  'S-Force': 'Ｓ－Ｆｏｒｃｅ',
  'Shaddoll': 'シャドール',
  'Shark': 'シャーク',
  'Shinobird': '霊魂鳥',
  'Shiranui': '不知火',
  'Simorgh': 'シムルグ',
  'Six Samurai': '六武衆',
  'Sky Striker': '閃刀姫',
  'Snake-Eye': 'スネークアイ',
  'Spright': 'スプライト',
  'Subterror': 'サブテラー',
  'Sunavalon': 'サンアバロン',
  'Superheavy Samurai': '超重武者',
  'Supreme King': '覇王',
  'Swordsoul': '相剣',
  'Sylvan': '森羅',
  'Tearlaments': 'ティアラメンツ',
  'Tellarknight': 'テラナイト',
  'Tenpai Dragon': '天盃龍',
  'Tenyi': '天威',
  'The Phantom Knights': '幻影騎士団',
  'The Weather': '天気',
  'Therion': 'セリオンズ',
  'Thunder Dragon': 'サンダー・ドラゴン',
  'Time Thief': 'クロノダイバー',
  'Timelord': '時械神',
  'Tistina': 'ティスティナ',
  'Toon': 'トゥーン',
  'Train': '列車',
  'Traptrix': '蟲惑魔',
  'Trickstar': 'トリックスター',
  'Tri-Brigade': '鉄獣戦線',
  'True Draco': '真竜',
  'U.A.': 'Ｕ.Ａ.',
  'Unchained': '破械',
  'Vaalmonica': 'ヴァルモニカ',
  'Valkyrie': 'ワルキューレ',
  'Vampire': 'ヴァンパイア',
  'Vanquish Soul': 'ＶＳ（ヴァンキッシュ・ソウル）',
  'Vaylantz': 'ヴァリアンツ',
  'Vendread': 'ヴェンデット',
  'Vernusylph': '春化精',
  'Virtual World': '電脳堺',
  'Voiceless Voice': '粛声',
  'Volcanic': 'ヴォルカニック',
  'White Forest': '白き森',
  'Witchcrafter': 'ウィッチクラフト',
  'World Chalice': '星杯',
  'World Legacy': '星遺物',
  'Worm': 'ワーム',
  'Xyz': 'エクシーズ',
  'Yang Zing': '竜星',
  'Yosenju': '妖仙獣',
  'Yubel': 'ユベル',
  'Zefra': 'セフラ',
  'Zoodiac': '十二獣',
  'Zubaba': 'ズババ'
};

const INFERENCE_RULES = {
  'ゴーティス': 'ゴーティス',
  'ＶＳ': 'ＶＳ（ヴァンキッシュ・ソウル）'
};

async function updateDB() {
  console.log('🔄 Updating database with hybrid merge (API: All + Japanese)...');

  try {
    // Phase 1: Fetch All Cards (English base)
    console.log('Fetching all cards (English context)...');
    const baseResponse = await fetch(BASE_URL);
    if (!baseResponse.ok) throw new Error(`Base API error: ${baseResponse.status}`);
    const baseData = await baseResponse.json();
    
    const cardMap = new Map();
    baseData.data.forEach(card => {
      cardMap.set(card.id, {
        id: card.id,
        name: card.name,
        archetype: card.archetype || ''
      });
    });
    console.log(`- Loaded ${cardMap.size} base cards.`);

    // Phase 2: Fetch Japanese Names
    console.log('Fetching Japanese names...');
    const jaResponse = await fetch(JA_URL);
    if (jaResponse.ok) {
      const jaData = await jaResponse.json();
      jaData.data.forEach(card => {
        if (cardMap.has(card.id)) {
          const existing = cardMap.get(card.id);
          existing.name = cleanRubyTags(card.name);
        }
      });
      console.log(`- Patched Japanese names for ${jaData.data.length} cards.`);
    } else {
      console.warn('⚠️ Japanese API failed, using English names as fallback.');
    }

    const inferredLog = [];
    
    // Final Mapping & Normalization
    let finalCards = Array.from(cardMap.values()).map(card => {
      let archetype = ARCHETYPE_MAP[card.archetype] || card.archetype;

      // 推論ロジック: 元のアーキタイプが空の場合、名前から推察
      if (!archetype) {
        for (const [keyword, target] of Object.entries(INFERENCE_RULES)) {
          if (card.name.includes(keyword)) {
            archetype = target;
            inferredLog.push(`${card.id}: ${card.name} -> ${target}`);
            break;
          }
        }
      }

      return {
        ...card,
        normalizedName: normalizeText(card.name),
        archetype: archetype
      };
    });

    // Phase 3: Manual Overrides
    if (fs.existsSync(MANUAL_FILE)) {
      console.log('Applying manual card overrides...');
      const manualData = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
      manualData.forEach(mCard => {
        const idx = finalCards.findIndex(c => Number(c.id) === Number(mCard.id));
        const processedMCard = {
          ...mCard,
          name: cleanRubyTags(mCard.name),
          normalizedName: normalizeText(cleanRubyTags(mCard.name)),
          archetype: ARCHETYPE_MAP[mCard.archetype] || mCard.archetype
        };

        if (idx !== -1) {
          // マニュアル側のアーキタイプが空なら、自動判定した結果を維持する
          const existing = finalCards[idx];
          finalCards[idx] = {
            ...existing,
            ...processedMCard,
            archetype: processedMCard.archetype || existing.archetype
          };
        } else {
          finalCards.push(processedMCard);
        }
      });
      console.log(`- Merged ${manualData.length} manual entry/entries.`);
    }

    // Save outputs
    fs.writeFileSync(INFERRED_LOG, inferredLog.sort().join('\n'));
    console.log(`- Generated inferred_archetypes.txt with ${inferredLog.length} entries.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalCards, null, 2));
    console.log(`✅ Successfully generated card_db.json with ${finalCards.length} cards!`);

  } catch (err) {
    console.error('❌ Failed to update card database:', err);
    process.exit(1);
  }
}

updateDB();
