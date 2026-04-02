import React, { useState } from 'react';
import { FileText, Copy, Check, ExternalLink, X, Settings2, Database, Globe, Play } from 'lucide-react';

export default function SetupGuide({ onClose }) {
  const [copied, setCopied] = useState(false);

  const gasCode = `// ==========================================
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
      // getDisplayValues を使用して表示文字列のまま取得
      const values = dataSheet.getRange(lastRow - getRows + 1, 1, getRows, 8).getDisplayValues();
      records = values.map(row => ({
        date: row[0],
        mode: row[1],
        turn: row[2],
        result: row[3],
        myDeck: row[4],
        opponentDeck: row[5],
        diff: row[6],
        memo: row[7]
      }));
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
      
      const data = dataSheet.getDataRange().getDisplayValues();
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
      const data = dataSheet.getDataRange().getDisplayValues();
      let rowIndex = -1;
      const searchId = String(payload.id).trim();
      
      // A列を上から検索して日時が一致するものを探す
      for (let i = 1; i < data.length; i++) {
        const sheetTime = String(data[i][0]).trim();
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
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(gasCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/95 animate-in fade-in duration-300">
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-indigo-600/10 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-xl text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">GAS Setup Guide</h2>
              <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest">Connect to Your Spreadsheet</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Step 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm">1</div>
              <h3 className="text-lg font-bold">スプレッドシートの準備</h3>
            </div>
            <div className="ml-11 space-y-3 text-zinc-400 text-sm leading-relaxed">
              <p>新しいGoogleスプレッドシートを作成し、名前を「MD_Tracker」などに設定します。</p>
              <p className="flex items-center gap-2 text-amber-400/80 italic text-xs">
                <ExternalLink className="w-3 h-3" /> <a href="https://sheets.new" target="_blank" rel="noreferrer" className="underline hover:text-amber-300">sheets.new</a> を開くと早いです
              </p>
            </div>
          </section>

          {/* Step 2 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm">2</div>
              <h3 className="text-lg font-bold">Apps Script を開く</h3>
            </div>
            <div className="ml-11 space-y-3 text-zinc-400 text-sm leading-relaxed">
              <p>上部メニューの <b>「拡張機能」 → 「Apps Script」</b> をクリックします。</p>
            </div>
          </section>

          {/* Step 3 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm">3</div>
              <h3 className="text-lg font-bold">コードを貼り付ける</h3>
            </div>
            <div className="ml-11 space-y-4">
              <p className="text-zinc-400 text-sm">既存のコード（myFunction等）をすべて消去し、以下のコードを貼り付けてください。</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden relative group">
                <div className="absolute right-4 top-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg border border-zinc-700 transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
                <pre className="p-5 text-[11px] font-mono text-indigo-300/80 overflow-x-auto max-h-[300px] leading-relaxed">
                  {gasCode}
                </pre>
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm">4</div>
              <h3 className="text-lg font-bold">初期セットアップの実行</h3>
            </div>
            <div className="ml-11 space-y-3 text-zinc-400 text-sm leading-relaxed">
              <p>保存（Ctrl+S）後、上部の実行関数リストから <b>「setupSheets」</b> を選択し、<b>「実行」</b> をクリックします。</p>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
                <div className="mt-0.5"><Check className="w-4 h-4 text-indigo-400" /></div>
                <p className="text-xs text-indigo-300">「承認が必要です」と表示された場合は、<b>「権限を確認」 → アカウント選択 → 「詳細」 → 「MD_Tracker（安全ではない）」へ移動</b> を許可してください。</p>
              </div>
            </div>
          </section>

          {/* Step 5 */}
          <section className="space-y-4 pb-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm">5</div>
              <h3 className="text-lg font-bold">デプロイとURLの取得</h3>
            </div>
            <div className="ml-11 space-y-4 text-zinc-400 text-sm leading-relaxed">
              <ol className="list-decimal list-inside space-y-2">
                <li>右上の <b>「デプロイ」 → 「新しいデプロイ」</b> を選択。</li>
                <li>種類を <b>「ウェブアプリ」</b> に設定。</li>
                <li>アクセスできるユーザーを <b>「全員 (Anyone)」</b> に設定します（最重要！）。</li>
                <li>「デプロイ」ボタンを押し、発行された <b>「ウェブアプリのURL」</b> をコピーしてください。</li>
              </ol>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mt-6">
                <p className="text-xs text-emerald-400 font-bold mb-1 uppercase">Next Step</p>
                <p className="text-xs text-emerald-300/80">取得したURLを本アプリの「Settings」に貼り付けて「Save」すれば完了です！</p>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950/20 text-center">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition shadow-lg"
          >
            I've set it up!
          </button>
        </div>
      </div>
    </div>
  );
}
