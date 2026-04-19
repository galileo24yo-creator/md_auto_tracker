const fs = require('fs');
const path = require('path');
const readline = require('readline');

const UNTRANSLATED_FILE = path.join(__dirname, '..', 'public', 'untranslated_cards.txt');
const CARDS_JSON_FILE = path.join(__dirname, '..', 'public', 'cards.json');
const MANUAL_FILE = path.join(__dirname, '..', 'public', 'manual_cards.json');

async function extractTranslations() {
  console.log('📖 Reading untranslated cards list...');
  const untranslatedContent = fs.readFileSync(UNTRANSLATED_FILE, 'utf8');
  const idsToFind = new Set();
  
  untranslatedContent.split('\n').forEach(line => {
    const match = line.match(/^(\d+):/);
    if (match) {
      idsToFind.add(Number(match[1]));
    }
  });
  
  console.log(`- Found ${idsToFind.size} IDs to look for.`);

  console.log('📂 Loading existing manual cards...');
  let manualCards = [];
  if (fs.existsSync(MANUAL_FILE)) {
    manualCards = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
  }
  const manualCardMap = new Map(manualCards.map(c => [Number(c.id), c]));

  console.log('🔍 Processing cards.json (streaming)...');
  const fileStream = fs.createReadStream(CARDS_JSON_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentCard = null;
  let inNameBlock = false;
  let foundCount = 0;

  for await (const line of rl) {
    // 巨大なファイルなので、可能な限り軽量な文字列マッチングで済ませる
    if (line.includes('"password":')) {
      const match = line.match(/"password":\s*(\d+)/);
      if (match) {
        const id = Number(match[1]);
        if (idsToFind.has(id)) {
          currentCard = { id };
        } else {
          currentCard = null;
        }
      }
    } else if (currentCard && line.includes('"name": {')) {
      inNameBlock = true;
    } else if (inNameBlock && line.includes('"ja":')) {
      const match = line.match(/"ja":\s*"(.*)"/);
      if (match) {
        let nameJa = match[1];
        // Remove ruby tags: <ruby>漢<rt>かん</rt></ruby> -> 漢
        nameJa = nameJa.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');
        // 他のタグ（もしあれば）も一応検討するが、基本これで十分なはず
        
        currentCard.name = nameJa;
        
        // archetype (series) は今回は対応しないという要件だが、
        // 既存の manual_cards.json にある場合は維持する
        const existing = manualCardMap.get(currentCard.id);
        const entry = {
          id: currentCard.id,
          name: nameJa,
          archetype: existing ? existing.archetype : ""
        };
        
        manualCardMap.set(currentCard.id, entry);
        foundCount++;
        currentCard = null; // このカードの処理終了
        inNameBlock = false;
      }
    } else if (line.includes('},')) {
      // オブジェクトあるいはブロックの終わり
      if (inNameBlock) inNameBlock = false;
      // currentCard は password の後に name が来るはずなので一応維持
    }
  }

  console.log(`✅ Extraction complete. Found ${foundCount} translations.`);

  const finalManualCards = Array.from(manualCardMap.values())
    .sort((a, b) => a.id - b.id);

  console.log(`💾 Writing ${finalManualCards.length} entries to manual_cards.json...`);
  fs.writeFileSync(MANUAL_FILE, JSON.stringify(finalManualCards, null, 2));
  console.log('✨ Done!');
}

extractTranslations().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
