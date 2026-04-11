const STORAGE_KEY = 'md_gas_profiles';
const ACTIVE_PROFILE_KEY = 'md_active_profile_id';

/**
 * Gets all saved profiles.
 */
export function getProfiles() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse profiles:", e);
    return [];
  }
}

/**
 * Gets the active profile.
 */
export function getActiveProfile() {
  const profiles = getProfiles();
  const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
  return profiles.find(p => p.id === activeId) || profiles[0] || null;
}

/**
 * Gets the current GAS URL from the active profile or falls back to the .env value.
 */
export function getGasUrl() {
  // Always prioritize URL parameter for OBS/external direct access
  const query = new URLSearchParams(window.location.search);
  const paramUrl = query.get('gas_url');
  if (paramUrl) return paramUrl;

  const active = getActiveProfile();
  return active ? active.url : (import.meta.env.VITE_GAS_URL || "");
}

/**
 * Saves the profiles and active profile ID.
 */
export function saveProfiles(profiles, activeId) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  if (activeId) localStorage.setItem(ACTIVE_PROFILE_KEY, activeId);
}

/**
 * Fetches match records and deck list from the Google Apps Script backend.
 */
export async function fetchData() {
  const url = getGasUrl();
  if (!url) {
    console.error("GAS URL is not set");
    return { success: false, records: [], decks: [], reasons: [] };
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch data:", err);
    return { success: false, records: [], decks: [], reasons: [], error: err.message };
  }
}

/**
 * Posts data to the Google Apps Script backend.
 */
export async function postData(record) {
  const url = getGasUrl();
  console.log(`[API] Sending POST to: ${url}`);
  console.log(`[API] Payload:`, record);

  if (!url) {
    console.error("[API] GAS URL is not set");
    return { success: false, error: "GAS URL is not set" };
  }

  try {
    // GASのリダイレクトとCORS制約を回避するための設定
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[API] Server responded with error ${res.status}:`, errorText);
      throw new Error(`Server responded with ${res.status}`);
    }

    const data = await res.json();
    console.log(`[API] Success! Response:`, data);
    return data;
  } catch (err) {
    console.error("[API] Failed to post data:", err);
    return { success: false, error: err.message };
  }
}

