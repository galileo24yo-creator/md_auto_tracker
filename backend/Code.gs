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
    dataSheet.appendRow(["日時", "モード", "先攻/後攻", "勝敗", "自分のデッキ", "相手のデッキ", "変動"]);
    dataSheet.getRange("A1:G1").setFontWeight("bold").setBackground("#d9ead3");
  }

  // 設定用シートの作成
  let settingsSheet = ss.getSheetByName(SHEET_SETTINGS_NAME);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_SETTINGS_NAME);
    settingsSheet.appendRow(["デッキリスト (A列以下に入力)"]);
    settingsSheet.getRange("A1").setFontWeight("bold").setBackground("#fff2cc");
    const defaultDecks = ["スネークアイ", "炎王", "ラビュリンス", "ティアラメンツ", "クシャトリラ", "ピュアリィ", "レスキューエース", "R-ACE", "烙印"];
    defaultDecks.forEach(deck => settingsSheet.appendRow([deck]));
  }
}

// GETリクエスト: デッキリストと直近の戦績をフロントエンドに返す
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // デッキリストの取得
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS_NAME);
  let decks = [];
  if (settingsSheet) {
    const lastRow = settingsSheet.getLastRow();
    if (lastRow > 1) {
      decks = settingsSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(String);
    }
  }

  // 直近100件のデータを取得
  const dataSheet = ss.getSheetByName(SHEET_DATA_NAME);
  let records = [];
  if (dataSheet) {
    const lastRow = dataSheet.getLastRow();
    if (lastRow > 1) {
      const getRows = Math.min(lastRow - 1, 100);
      const values = dataSheet.getRange(lastRow - getRows + 1, 1, getRows, 7).getValues();
      records = values.map(row => ({
        date: row[0],
        mode: row[1],
        turn: row[2],
        result: row[3],
        myDeck: row[4],
        opponentDeck: row[5],
        diff: row[6]
      }));
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    decks: decks,
    records: records
  })).setMimeType(ContentService.MimeType.JSON);
}

// POSTリクエスト: 戦績データをシートに追記する
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let dataSheet = ss.getSheetByName(SHEET_DATA_NAME);
    
    // 日時はサーバー側の現在時刻を使用
    const timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    
    // データの追記
    dataSheet.appendRow([
      timestamp,
      payload.mode || "未分類",
      payload.turn || "不明",
      payload.result || "不明",
      payload.myDeck || "",
      payload.opponentDeck || "",
      payload.diff || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Data recorded successfully"
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
