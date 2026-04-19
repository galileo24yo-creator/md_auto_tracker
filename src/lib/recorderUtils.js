// --- Tag Mapping Table ---
export const CARD_TO_TAG_BASE = {
  '増殖するＧ': 'G',
  '灰流うらら': 'うらら',
  '無限泡影': '泡',
  '原始生命態ニビル': 'ニビル',
  'エフェクト・ヴェーラー': 'ヴェーラー',
  'ドロール＆ロックバード': 'ドロバ',
  '墓穴の指名者': '墓穴',
  '抹殺の指名者': '抹殺'
};

// ==========================================
// Text Normalization (Zen-Han conversion)
// ==========================================
export function normalizeCardName(text) {
  if (!text) return '';
  return text
    .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英数記号 -> 半角
    .replace(/－/g, '-') // 全角ハイフン -> 半角
    .replace(/　/g, ' ') // 全角スペース -> 半角
    // ギリシャ文字の誤読対策 (DB側の正規化名と一致させる)
    .replace(/α/g, 'a')
    .replace(/β/g, 'b')
    .replace(/γ/g, 'y')
    .replace(/δ/g, 'd')
    .replace(/ε/g, 'e')
    .replace(/\s+/g, '') // 全てのスペースを除去（検索用）
    .trim();
}

// ==========================================
// Sound Effects (Web Audio API)
// ==========================================
let audioCtx = null;
export const playNotificationSound = (type = 'single') => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'double') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(1200, now + 0.12);
      gain.gain.setValueAtTime(0.1, now + 0.12); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'warning') {
      osc.type = 'square'; osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(330, now + 0.12);
      gain.gain.setValueAtTime(0.05, now + 0.12); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'restore') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(1100, now + 0.05);
      osc.start(now); osc.stop(now + 0.15);
    } else {
      osc.type = 'sine'; osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.2);
    }
  } catch (e) { console.warn("Sound play failed:", e); }
};
