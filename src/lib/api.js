const STORAGE_KEY = 'md_gas_url';

/**
 * Gets the current GAS URL from localStorage, or falls back to the .env value.
 */
export function getGasUrl() {
  const savedUrl = localStorage.getItem(STORAGE_KEY);
  return savedUrl || import.meta.env.VITE_GAS_URL || "";
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
 * Posts a new match record to the Google Apps Script backend.
 */
export async function postData(record) {
  const url = getGasUrl();
  if (!url) {
    console.error("GAS URL is not set");
    return { success: false };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(record),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to post data:", err);
    return { success: false, error: err.message };
  }
}

