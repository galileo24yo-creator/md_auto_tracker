const fs = require('fs');
const path = require('path');

const MANUAL_FILE = path.join(__dirname, '..', 'public', 'manual_cards.json');

async function syncArchetypes() {
  console.log('🔄 Syncing archetypes in manual_cards.json...');
  
  if (!fs.existsSync(MANUAL_FILE)) {
    console.error('❌ manual_cards.json not found.');
    return;
  }

  const manualCards = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
  
  // 名前ごとのアーキタイプを収集
  const nameToArchetype = new Map();
  
  manualCards.forEach(card => {
    if (card.archetype && card.archetype.trim() !== '') {
      if (nameToArchetype.has(card.name)) {
        const existing = nameToArchetype.get(card.name);
        if (existing !== card.archetype) {
          console.warn(`⚠️ Ambiguous archetype for "${card.name}": "${existing}" and "${card.archetype}"`);
        }
      } else {
        nameToArchetype.set(card.name, card.archetype);
      }
    }
  });

  console.log(`- Found archetype info for ${nameToArchetype.size} unique names.`);

  let updateCount = 0;
  const updatedCards = manualCards.map(card => {
    const knownArchetype = nameToArchetype.get(card.name);
    if (knownArchetype && (!card.archetype || card.archetype.trim() === '')) {
      updateCount++;
      return { ...card, archetype: knownArchetype };
    }
    return card;
  });

  if (updateCount > 0) {
    console.log(`💾 Updating ${updateCount} entries with missing archetypes...`);
    fs.writeFileSync(MANUAL_FILE, JSON.stringify(updatedCards, null, 2));
    console.log('✨ manual_cards.json update complete.');
  } else {
    console.log('ℹ️ No missing archetypes to sync.');
  }
}

syncArchetypes().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
