const fs = require('fs');
const path = require('path');

const UNTRANSLATED_FILE = path.join(process.cwd(), 'public', 'untranslated_cards.txt');
const DB_FILE = path.join(process.cwd(), 'public', 'card_db.json');
const MASTER_SCRIPT_FILE = path.join(process.cwd(), 'scripts', 'updateCardDB.js');

function analyze() {
  if (!fs.existsSync(UNTRANSLATED_FILE) || !fs.existsSync(DB_FILE)) {
    console.error('Core files not found');
    return;
  }

  const untranslatedLines = fs.readFileSync(UNTRANSLATED_FILE, 'utf8').split('\n');
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  
  // Extract ARCHETYPE_MAP from master script logic
  let themeMap = {};
  if (fs.existsSync(MASTER_SCRIPT_FILE)) {
    const scriptContent = fs.readFileSync(MASTER_SCRIPT_FILE, 'utf8');
    // Extract the object content between "const ARCHETYPE_MAP = {" and "};"
    const match = scriptContent.match(/const ARCHETYPE_MAP = ({[\s\S]*?});/);
    if (match) {
      try {
        // We use a safe eval-like approach or simple string parsing. 
        // For security in this local utility, we'll convert it to a valid JSON-like string and parse.
        // Or cleaner: just use a function to objectify it since it's JS code.
        const mapStr = match[1]
          .replace(/\'/g, '"') // Replace single quotes with double quotes
          .replace(/(\w+):/g, '"$1":') // Quote keys
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/\/\/.*$/gm, ''); // Remove comments
        themeMap = JSON.parse(mapStr);
      } catch (e) {
        console.warn('Could not parse ARCHETYPE_MAP from script, falling back to empty map.');
      }
    }
  }

  // Create ID -> Card Map for fast lookup
  const cardMap = new Map();
  db.forEach(card => cardMap.set(Number(card.id), card));

  const stats = {}; // archetype -> { count, isMapped, mappedTo }
  const items = [];

  untranslatedLines.forEach(line => {
    const match = line.match(/^(\d+): (.*)$/);
    if (match) {
      const id = Number(match[1]);
      const name = match[2];
      const card = cardMap.get(id);
      const archetype = (card && card.archetype) ? card.archetype : 'None';
      
      if (!stats[archetype]) {
        const mappedTo = themeMap[archetype];
        stats[archetype] = { 
          count: 0, 
          isMapped: !!mappedTo,
          mappedTo: mappedTo || null
        };
      }
      stats[archetype].count++;
      
      items.push({ id, name, archetype, isMapped: stats[archetype].isMapped });
    }
  });

  const sortedStats = Object.entries(stats)
    .sort((a, b) => b[1].count - a[1].count);
  
  console.log('\n--- [UNMAPPED] Top Archetypes Needing Translation ---');
  sortedStats
    .filter(([_, data]) => !data.isMapped && _ !== 'None')
    .slice(0, 30)
    .forEach(([arch, data]) => {
      console.log(`${arch}: ${data.count} cards`);
    });

  console.log('\n--- [MAPPED] Top Archetypes already in Theme Map ---');
  sortedStats
    .filter(([_, data]) => data.isMapped)
    .slice(0, 20)
    .forEach(([arch, data]) => {
      console.log(`${arch} -> ${data.mappedTo}: ${data.count} cards`);
    });

  // Save detailed mapping to a temporary file for the next step
  const summary = {
    stats: sortedStats.map(([name, data]) => ({ name, ...data })),
    items: items
  };
  fs.writeFileSync('untranslated_analysis.json', JSON.stringify(summary, null, 2));
  console.log('\nDetailed analysis saved to untranslated_analysis.json');
}

analyze();
