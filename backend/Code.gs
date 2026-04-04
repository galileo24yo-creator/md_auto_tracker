// ==========================================
// Master Duel Tracker - Google Apps Script
// ==========================================

const SHEET_DATA_NAME = "対戦記録";
const SHEET_SETTINGS_NAME = "設定";

// 初期設定（初回実行時のみ手動で関数「setupSheets」を実行してください）
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 対戦記録シートの作成
  let dataSheet = ss.getSheetByName(SHEET_DATA_NAME);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(SHEET_DATA_NAME);
    dataSheet.appendRow(["日時", "モード", "先攻/後攻", "勝敗", "自分のデッキ", "相手のデッキ", "変動", "要因"]);
    dataSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#d9ead3");
  }

  // 設定用シートの作成
  let settingsSheet = ss.getSheetByName(SHEET_SETTINGS_NAME);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_SETTINGS_NAME);
    settingsSheet.appendRow(["デッキリスト (A列)", "要因リスト (B列)"]);
    settingsSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#fff2cc");
    
    // 初期デッキ
    const defaultDecks = ["スネークアイ", "炎王", "ラビュリンス", "ティアラメンツ", "クシャトリラ", "ピュアリィ", "レスキューエース", "R-ACE", "烙印"];
    defaultDecks.forEach((deck, i) => settingsSheet.getRange(i + 2, 1).setValue(deck));
    
    // 初期要因タグ
    const defaultTags = ["プレミ", "手札誘発", "事故", "後攻不利", "神引き", "接続切れ", "時間切れ", "運ゲー"];
    defaultTags.forEach((tag, i) => settingsSheet.getRange(i + 2, 2).setValue(tag));
  }
}

// GETリクエスト: デッキリストと直近の戦績をフロントエンドに返す
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // デッキリストと要因リストの取得
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS_NAME);
  let decks = [];
  let reasons = [];
  if (settingsSheet) {
    const lastRow = settingsSheet.getLastRow();
    if (lastRow > 1) {
      const settingsData = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
      decks = settingsData.map(row => row[0]).filter(String);
      reasons = settingsData.map(row => row[1]).filter(String);
    }
  }

  // 直近1000件のデータを取得
  const dataSheet = ss.getSheetByName(SHEET_DATA_NAME);
  let records = [];
  if (dataSheet) {
    const lastRow = dataSheet.getLastRow();
    if (lastRow > 1) {
      const getRows = Math.min(lastRow - 1, 1000);
      // getValues を使用して生の文字（∀等）を取得し、日付は別途フォーマットする
      const values = dataSheet.getRange(lastRow - getRows + 1, 1, getRows, 8).getValues();
      records = values.map(row => {
        const d = row[0];
        const dateStr = (d instanceof Date) ? Utilities.formatDate(d, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss") : String(d);
        return {
          date: dateStr,
          mode: row[1],
          turn: row[2],
          result: row[3],
          myDeck: row[4],
          opponentDeck: row[5],
          diff: row[6],
          memo: row[7]
        };
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    decks: decks,
    reasons: reasons,
    records: records
  })).setMimeType(ContentService.MimeType.JSON);
}

// POSTリクエスト: 戦績データをシートに追記または更新する
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // --- アクションの分岐 ---
    
    // 1. 設定（マスタデータ）の更新
    if (payload.action === 'UPDATE_SETTINGS') {
      const settingsSheet = ss.getSheetByName(SHEET_SETTINGS_NAME);
      if (!settingsSheet) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Settings sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      
      settingsSheet.clear();
      settingsSheet.appendRow(["デッキリスト (A列)", "要因リスト (B列)"]);
      settingsSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#fff2cc");
      
      const newDecks = payload.decks || [];
      const newReasons = payload.reasons || [];
      const maxLen = Math.max(newDecks.length, newReasons.length);
      
      if (maxLen > 0) {
        const rows = [];
        for (let i = 0; i < maxLen; i++) {
          rows.push([newDecks[i] || "", newReasons[i] || ""]);
        }
        settingsSheet.getRange(2, 1, rows.length, 2).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Settings updated" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. 記録の削除
    if (payload.action === 'DELETE_RECORD') {
      const dataSheet = ss.getSheetByName(SHEET_DATA_NAME);
      if (!dataSheet) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Data sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      
      const data = dataSheet.getDataRange().getValues();
      const searchId = String(payload.id || "").trim();
      let rowIndex = -1;
      
      for (let i = 1; i < data.length; i++) {
        const sheetId = String(data[i][0] || "").trim();
        if (sheetId === searchId) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex !== -1) {
        dataSheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Record deleted" })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // デバッグ用: シートの最初の数行のIDをエラーに含める
      const sampleIds = data.slice(1, 4).map(r => r[0]).join(", ");
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        error: "Record not found. Searched ID: [" + searchId + "]. Sample IDs in sheet: [" + sampleIds + "]"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 既存の「更新」または「新規追記」ロジック (後続の処理)
    let dataSheet = ss.getSheetByName(SHEET_DATA_NAME);
    
    // 更新モード（payload.id があり、action指定がない場合）
    if (payload.id) {
      const data = dataSheet.getDataRange().getValues();
      let rowIndex = -1;
      const searchId = String(payload.id).trim();
      
      // A列を上から検索して日時が一致するものを探す
      for (let i = 1; i < data.length; i++) {
        const d = data[i][0];
        const sheetTime = (d instanceof Date) ? Utilities.formatDate(d, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss") : String(d).trim();
        if (sheetTime === searchId) {
          rowIndex = i + 1; // 1-indexed
          break;
        }
      }
      
      if (rowIndex !== -1) {
        // 行の更新 (指定されたセル範囲を書き換え)
        const rowData = [
          payload.id, // 日時は絶対に変えない
          payload.mode || "未分類",
          payload.turn || "不明",
          payload.result || "不明",
          payload.myDeck || "",
          payload.opponentDeck || "",
          payload.diff || "",
          payload.memo || ""
        ];
        dataSheet.getRange(rowIndex, 1, 1, 8).setValues([rowData]);
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Data updated successfully"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // IDが指定されているのに見つからなかった場合（重複防止のため新規追記せずエラーにする）
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Original record was not found. Please refresh the dashboard and try again. (ID: " + searchId + ")"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 新規追記モード (payload.id がない場合のみ実行)
    const timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    dataSheet.appendRow([
      timestamp,
      payload.mode || "未分類",
      payload.turn || "不明",
      payload.result || "不明",
      payload.myDeck || "",
      payload.opponentDeck || "",
      payload.diff || "",
      payload.memo || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Data recorded successfully",
      id: timestamp // 追加された日時を返す
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// CORSエラー回避用 (Preflight OPTIONSリクエストへの対応)
function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  return ContentService.createTextOutput("OK")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
