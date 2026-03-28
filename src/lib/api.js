const GAS_URL = import.meta.env.VITE_GAS_URL || "";

/**
 * Fetches match records and deck list from the Google Apps Script backend.
 */
export async function fetchData() {
  if (!GAS_URL) {
    console.error("VITE_GAS_URL is not set");
    return { success: false, records: [], decks: [] };
  }

  try {
    const res = await fetch(GAS_URL);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch data:", err);
    return { success: false, records: [], decks: [], error: err.message };
  }
}

/**
 * Posts a new match record to the Google Apps Script backend.
 */
export async function postData(record) {
  if (!GAS_URL) {
    console.error("VITE_GAS_URL is not set");
    return { success: false };
  }

  try {
    const res = await fetch(GAS_URL, {
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
