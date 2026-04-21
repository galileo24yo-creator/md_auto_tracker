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
  'A.I.': 'A.I.',
  'ABC': 'ABC',
  'Abyss Actor': '魔界劇団',
  'Adamancipator': 'アダマシア',
  '@Ignister': '＠イグニスター',
  'Advanced Crystal Beast': 'A宝玉獣',
  'Agent': '代行者',
  'Alien': 'エーリアン',
  'Allure Queen': '魅惑の女王',
  'Ally of Justice': 'A・O・J',
  'Altergeist': 'オルターガイスト',
  'Amazement': 'アメイズメント',
  'Amazoness': 'アマゾネス',
  'Amorphage': 'アモルファージ',
  'Ancient Gear': 'アンティーク・ギア',
  'Ancient Warriors': '戦華',
  'Apophis': '王家の神殿＋アポピス',
  'Appliancer': '機塊',
  'Aquaactress': 'アクアアクトレス',
  'Arcana Force': 'アルカナフォース',
  'Archfiend': 'デーモン',
  'Argostars': 'ARG☆S',
  'Armed Dragon': 'アームド・ドラゴン',
  'Aroma': 'アロマ',
  'Artifact': 'アーティファクト',
  'Ashened': '灰滅',
  'Assault Mode': '／バスター',
  'Atlantis': 'アトランティス',
  'Azamina': 'アザミナ',
  'B.E.S.': '巨大戦艦',
  'Barian\'s': 'バリアン',
  'Batteryman': '電池メン',
  'Battleguard': 'バーバリアン',
  'Battlin\' Boxer': 'BK（バーニングナックラー）',
  'Battlewasp': 'B・F',
  'Beetrooper': 'ビートルーパー',
  'Black Luster Soldier': 'カオス・ソルジャー',
  'Blackwing': 'BF',
  'Blitzclique': 'ブリッツ・クリーク',
  'Blue-Eyes': 'ブルーアイズ',
  'Borrel': 'ヴァレル',
  'Branded': '烙印',
  'Bujin': '武神',
  'Burning Abyss': '彼岸',
  'Bystial': 'ビーステッド',
  'Centur-Ion': 'センチュリオン',
  'Chaos': 'カオス',
  'Charmer': '霊使い',
  'Chronomaly': '先史遺産',
  'Cipher': 'サイファー',
  'Cloudian': '雲魔物',
  'Clown Clan': 'クラウン・クラン',
  'Code Talker': 'コード・トーカー',
  'Constellar': 'セイクリッド',
  'Crusadia': 'パラディオン',
  'Crystal Beast': '宝玉獣',
  'Crystron': 'クリストロン',
  'Cyber Dragon': 'サイバー・ドラゴン',
  'Cyber': 'サイバー',
  'Cyberdark': 'サイバー・ダーク',
  'D/D': 'DD（ディーディー）',
  'Danger!': '未界域',
  'Dark Magician': 'ブラック・マジシャン',
  'Dark World': '暗黒界',
  'Darklord': '堕天使',
  'Despia': 'デスピア',
  'Destiny HERO': 'D-HERO',
  'Diabellstar': 'ディアベルスター',
  'Digital Bug': '電子光虫',
  'Dinomorphia': 'ダイノルフィア',
  'Dinowrestler': 'ダイナレスラー',
  'Dogmatika': 'ドラグマ',
  'Doremichord': 'ドレミコード',
  'Dracoslayer': '竜剣士',
  'Dracotail': 'ドラゴンテイル',
  'Dragonmaid': 'ドラゴンメイド',
  'Dragunity': 'ドラグニティ',
  'Drytron': 'ドライトロン',
  'Dual': 'デュアル',
  'Dinamist': 'ダイナミスト',
  'Earthbound': '地縛',
  'Edge Imp': 'エッジインプ',
  'Eldlich': 'エルドリッチ',
  'Elemental HERO': 'E・HERO',
  'Elvennotes': 'エルフェンノーツ',
  'Em': 'Em',
  'EM': 'EM',
  'Endymion': 'エンディミオン',
  'Enneacraft': 'エニアクラフト',
  'Evil Eye': '呪眼',
  'Evil HERO': 'E-HERO',
  'Evil★Twin': 'イビルツイン',
  'Exodia': '封印されしエクゾディア',
  'Exosister': 'エクソシスター',
  'F.A.': 'F.A.',
  'Fabled': '魔轟神',
  'Fairy Tail': '妖精伝姫',
  'Fiendsmith': 'デモンスミス',
  'Fire Fist': '炎星',
  'Fire King': '炎王',
  'Flame Swordsman': '炎の剣士',
  'Floowandereeze': 'ふわんだりぃず',
  'Fluffal': 'ファーニマル',
  'Fortune Lady': 'フォーチュンレディ',
  'Fossil': '化石',
  'Frog': 'ガエル',
  'Fur Hire': '空牙団',
  'Fusion': '融合',
  'Gagaga': 'ガガガ',
  'Galaxy': 'ギャラクシー',
  'Galaxy-Eyes': 'ギャラクシーアイズ',
  'Gem-Knight': 'ジェムナイト',
  'Generaider': 'ジェネレイド',
  'Genex': 'ジェネクス',
  'Ghostrick': 'ゴーストリック',
  'Ghoti': 'ゴーティス',
  'Gimmick Puppet': 'ギミック・パペット',
  'Gishki': 'リチュア',
  'Gladiator Beast': '剣闘獣',
  'Goblin': 'ゴブリン',
  'Gold Pride': 'GP',
  'Gouki': '剛鬼',
  'Gravekeeper\'s': '墓守',
  'Graydle': 'グレイドル',
  'Gusto': 'ガスタ',
  'Harpie': 'ハーピィ',
  'Hazy Flame': '陽炎獣',
  'Hecahands': 'ヘカトンケイル',
  'Heraldic Beast': '紋章獣',
  'Heroic': 'ヒロイック',
  'Hieratic': '聖刻',
  'Hole': '落とし穴',
  'Horus': 'ホルス',
  'Ice Barrier': '氷結界',
  'Icejade': '氷水',
  'Igknight': 'イグナイト',
  'Ignister': '＠イグニスター',
  'Infernoble Knight': '焔聖騎士',
  'Infernity': 'インフェルニティ',
  'Infernoid': 'インフェルノイド',
  'Infinitrack': '無限起動',
  'Invoked': '召喚獣',
  'Inzektor': '甲虫装機',
  'Junk': 'ジャンク',
  'Jurrac': 'ジュラック',
  'Kaiju': '壊獣',
  'Karakuri': 'カラクリ',
  'Kashtira': 'クシャトリラ',
  'Kewl Tune': 'キラーチューン',
  'Knightmare': 'トロイメア',
  'Koa\'ki Meiru': 'コアキメイル',
  'Kozmo': 'Kozmo',
  'Kuriboh': 'クリボー',
  'Labrynth': 'ラビュリンス',
  'Laval': 'ラヴァル',
  'Lightsworn': 'ライトロード',
  'Live☆Twin': 'ライブツイン',
  'Lunalight': 'ムーンライト',
  'Lyrilusc': 'LL',
  'Machina': 'マシンナーズ',
  'Madolche': 'マドルチェ',
  'Magical Musket': '魔弾',
  'Magician': '魔術師',
  'Magician Girl': 'マジシャン・ガール',
  'Magistus': 'マギストス',
  'Magnet Warrior': 'マグネット・ウォリアー',
  'Magnet': 'マグネット・ウォリアー',
  'Majespecter': 'マジェスペクター',
  'M∀LICE': 'M∀LICE',
  'Maliss': 'M∀LICE',
  'Mannadium': 'マナドゥム',
  'Marincess': 'マリンセス',
  'Masked HERO': 'M・HERO',
  'Materiactor': 'マテリアクトル',
  'Mathmech': '斬機',
  'Mayakashi': '魔妖',
  'Mecha Phantom Beast': '幻獣機',
  'Megalith': 'メガリス',
  'Mekk-Knight': 'ジャックナイツ',
  'Melffy': 'メルフィー',
  'Melodious': '幻奏',
  'Memento': 'メメント',
  'Mementotlan': 'メメント',
  'Mermail': '水精鱗',
  'Metalfoes': 'メタルフォーゼ',
  'Metaphys': 'メタファイズ',
  'Mikanko': '御巫',
  'Millennium': '千年',
  'Mirror Force': '聖なるバリア',
  'Mist Valley': '霞の谷（ミスト・バレー）',
  'Mitsurugi': '巳剣',
  'Monarch': '帝王',
  'Morphtronic': 'Ｄ（ディフォーマー）',
  'Myutant': 'ミュートリア',
  'Mythical Beast': '魔導獣',
  'Naturia': 'ナチュル',
  'Nekroz': '影霊衣',
  'Nemleria': 'ネムレリア',
  'Nemeses': 'ネメシス',
  'Nephthys': 'ネフティス',
  'Ninja': '忍者',
  'Noble Knight': '聖騎士',
  'Nouvelles': 'ヌーベルズ',
  'Number': 'Ｎｏ.（ナンバーズ）',
  'Numeron': 'ヌメロン',
  'Odd-Eyes': 'オッドアイズ',
  'Ogdoadic': '溟界',
  'Ojama': 'おジャマ',
  'Orcust': 'オルフェゴール',
  'P.U.N.K.': 'P.U.N.K.',
  'Paleozoic': 'バージェストマ',
  'Parshath': 'パーシアス',
  'Pendulum': 'ペンデュラム',
  'Performage': 'Em',
  'Performapal': 'EM',
  'Phantasm Spiral': '幻煌龍',
  'Phantasm': '幻煌龍',
  'Photon': 'フォトン',
  'Plunder Patroll': '海造賊',
  'Polymerization': '融合',
  'Possessed': '憑依装着',
  'Prank-Kids': 'プランキッズ',
  'Predaplant': '捕食植物',
  'Prediction Princess': '占術姫',
  'Primite': '原石',
  'PSY-Frame': 'PSYフレーム',
  'Purrely': 'ピュアリィ',
  'Qli': 'クリフォート',
  'R-ACE': 'R－ACE',
  'R.B.': 'Ｒ.Ｂ.（リボルボット）',
  'Radiant Typhoon': '絢嵐',
  'Ragnaraika': '蕾禍',
  'Raidraptor': 'RR',
  'Red-Eyes': 'レッドアイズ',
  'Regenesis': 'リジェネシス',
  'Rescue-ACE': 'R－ACE',
  'Resonator': 'リゾネーター',
  'Rikka': '六花',
  'Ritual Beast': '霊獣',
  'Roid': 'ロイド',
  'Rokket': 'ヴァレット',
  'Rose': 'ローズ',
  'Runick': '神碑',
  'Ryu-Ge': '竜華',
  'Ryzeal': 'ライゼオル',
  'Salamangreat': 'サラマングレイト',
  'Scareclaw': 'スケアクロー',
  'Scrap': 'スクラップ',
  'S-Force': 'S－Force',
  'Serket': '王家の神殿＋アポピス',
  'Shaddoll': 'シャドール',
  'Shark': 'シャーク',
  'Shinobird': '霊魂鳥',
  'Shiranui': '不知火',
  'Simorgh': 'シムルグ',
  'Six Samurai': '六武衆',
  'Sky Striker': '閃刀姫',
  'Snake-Eye': 'スネークアイ',
  'Solfachord': 'ドレミコード',
  'Speedroid': 'スピードロイド',
  'Spellbook': '魔導書',
  'Spright': 'スプライト',
  'Springans': 'スプリガンズ',
  'Spyral': 'SPYRAL',
  'Stardust': 'スターダスト',
  'Subterror': 'サブテラー',
  'Sunavalon': 'サンアバロン',
  'Super Quant': '超量',
  'Superheavy Samurai': '超重武者',
  'Supreme King': '覇王',
  'Swordsoul': '相剣',
  'Sylvan': '森羅',
  'Synchro': 'シンクロ',
  'Synchron': 'シンクロン',
  'T.G.': 'TG（テックジーナス）',
  'Tearlaments': 'ティアラメンツ',
  'Tellarknight': 'テラナイト',
  'Temple of the Kings': '王家の神殿＋アポピス',
  'Tenpai Dragon': '天盃龍',
  'Tenyi': '天威',
  'The Phantom Knights': '幻影騎士団',
  'The Weather': '天気',
  'Therion': 'セリオンズ',
  'Thunder Dragon': 'サンダー・ドラゴン',
  'Timelord': '時械神',
  'Time Thief': 'クロノダイバー',
  'Tindangle': 'ティンダングル',
  'Tistina': 'ティスティナ',
  'Toon': 'トゥーン',
  'Train': '列車',
  'Traptrix': '蟲惑魔',
  'Tri-Brigade': 'トライブリゲード',
  'Trickstar': 'トリックスター',
  'True Draco': '真竜',
  'U.A.': 'U.A.',
  'Unchained': '破械',
  'Utopic': '希望皇ホープ',
  'Vaalmonica': 'ヴァルモニカ',
  'Valkyrie': 'ワルキューレ',
  'Vampire': 'ヴァンパイア',
  'Vanquish Soul': 'VS',
  'Vaylantz': 'ヴァリアンツ',
  'Vendread': 'ヴェンデット',
  'Venom': 'ヴェノム',
  'Vernusylph': '春化精',
  'Virtual World': '電脳堺',
  'Vision HERO': 'V・HERO',
  'Voiceless Voice': '粛声',
  'Volcanic': 'ヴォルカニック',
  'Vylon': 'ヴァイロン',
  'White Forest': '白き森',
  'White': '白き森',
  'Wind-Up': 'ゼンマイ',
  'Windwitch': 'WW',
  'Witchcrafter': 'ウィッチクラフト',
  'World Chalice': '星杯',
  'World Legacy': '星遺物',
  'Worm': 'ワーム',
  'X-Saber': 'X－セイバー',
  'Xyz': 'エクシーズ',
  'Yang Zing': '竜星',
  'Yosenju': '妖仙獣',
  'Yubel': 'ユベル',
  'Yummy': 'ヤミー',
  'Zefra': 'セフィラ',
  'Zoodiac': '十二獣',
  'Zubaba': 'ズババ',
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
