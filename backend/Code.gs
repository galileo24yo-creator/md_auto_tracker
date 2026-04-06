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
    
    // 初期デッキ（遊戯王テーマ・マスターライブラリ：500件超）
    const defaultDecks = [
      "王家の神殿", "赤き竜", "アクアアクトレス", "悪魔嬢", "アザミナ", "アダマシア", "＠イグニスター", "A宝玉獣", "アポピス", "アマゾネス", 
      "アメイズメント", "アモルファージ", "魅惑の女王", "アルカナフォース", "ARG☆S", "アルトメギア", "アルバスの落胤", "アロマ", "暗黒界", "暗黒騎士ガイア", 
      "アンティーク・ギア", "アンブラル", "アーティファクト", "アーマード・エクシーズ", "アームド・ドラゴン", "A・O・J", "イグナイト", "イビルツイン", "甲虫装機", "インフェルニティ", 
      "インフェルノイド", "インヴェルズ", "E-HERO", "ウィッチクラフト", "WW", "ウォークライ", "ウォーター・ドラゴン", "海", "占い魔女", "U.A.", 
      "エクソシスター", "エスプリット", "XYZ", "X－セイバー", "エッジインプ", "糾罪巧", "エルドリッチ", "エルフェンノーツ", "エレキ", "E・HERO", 
      "E・HERO ネオス", "エレメントセイバー", "炎王", "エンシェント・フェアリー・ドラゴン", "炎星", "焔聖騎士", "Em", "EM", "エンディミオン", "エヴォル", 
      "ABC", "エーリアン", "オシリスの天空竜", "おジャマ", "オッドアイズ", "オノマト", "オベリスクの巨神兵", "オルターガイスト", "オルフェゴール", "先史遺産", 
      "海皇", "壊獣", "灰滅", "カオス・ソルジャー", "影六武衆", "化合獣", "化石", "カラクリ", "花札衛", "ガエル", 
      "ガガガ", "ガジェット", "ガスタ", "ガーディアン", "機塊", "機巧", "機皇", "希望皇ホープ", "極星", "巨大戦艦", 
      "キラーチューン", "禁じられた", "ギアギア", "ギミック・パペット", "ギャラクシー", "空牙団", "クシャトリラ", "雲魔物", "道化の一座", "クリアー・ワールド", 
      "クリストロン", "クリフォート", "クリボー", "黒蠍", "クロノダイバー", "クローラー", "剣闘獣", "グレイドル", "軍貫", "絢嵐", 
      "K９", "幻煌龍", "幻獣", "幻獣機", "原石", "現世と冥界の逆転", "幻奏", "幻魔", "幻魔皇ラビエル", "ゲート・ガーディアン", 
      "コアキメイル", "コアラ", "降雷皇ハモン", "C（コクーン）", "Kozmo", "蟲惑魔", "混沌幻魔アーミタイル", "コードブレイカー", "コード・トーカー", "剛鬼", 
      "獄神", "ゴゴゴ", "ゴブリン", "ゴブリンライダー", "ゴヨウ", "ゴーストリック", "ゴーティス", "GP", "PSYフレーム", "サイバネット", 
      "サイバー", "サイバー・エンジェル", "サイバー・ダーク", "サイバー・ドラゴン", "サイファー", "サイレント・ソードマン", "サイレント・マジシャン", "音響戦士", "サクリファイス", "サブテラー", 
      "サラマングレイト", "サンアバロン", "サンダー・ドラゴン", "斬機", "シムルグ", "シャドール", "シャーク", "粛声", "守護神官", "守護竜", 
      "召喚獣", "不知火", "白き森", "Sin", "神炎皇ウリア", "深海", "シンクロン", "森羅", "真竜", "シー・ステルス", 
      "ジェネクス", "ジェネレイド", "ジェムナイト", "時械神", "地縛", "地縛神", "邪神アバター", "邪神イレイザー", "邪神ドレッド・ルート", "ジャックナイツ", 
      "ジャンク", "十二獣", "呪眼", "ジュラック", "人造人間", "Gゴーレム", "スクラップ", "スケアクロー", "スターダスト", "スネークアイ", 
      "素早い", "SPYRAL", "スピードロイド", "スプライト", "スプリガンズ", "スマイル", "／バスター", "SDロボ", "ズババ", "星遺物", 
      "聖騎士", "セイクリッド", "聖刻", "星杯", "征竜", "セイヴァー", "S－Force", "セフィラ", "七皇", "セリオンズ", 
      "戦華", "占術姫", "センチュリオン", "閃刀姫", "千年", "ゼアル", "ZW（ゼアル・ウェポン）", "ゼンマイ", "相剣", "双天", 
      "タキオン", "竹光", "代行者", "ダイナミスト", "ダイナレスラー", "ダイノルフィア", "ダストン", "堕天使", "DT", "C（チェーン）", 
      "超越竜", "超重武者", "超量", "ティアラメンツ", "ティスティナ", "ティンダングル", "帝王", "TG（テックジーナス）", "テラナイト", "天威", 
      "天気", "天盃龍", "天魔神", "ディアベル", "ディアベルスター", "Ｄ（ディフォーマー）", "DD（ディーディー）", "電子光虫", "D-HERO", "デストーイ", 
      "デスピア", "魔神儀", "デモンスミス", "電池メン", "電脳堺", "デーモン", "トイ", "トゥーン", "トポロジック", "トライアングル－O", 
      "トライブリゲード", "トラミッド", "トリックスター", "トロイメア", "ドゥームズ", "ドドド", "ドミナス", "ドライトロン", "ドラグニティ", "ドラグマ", 
      "ドラゴンテイル", "ドラゴンメイド", "ドレミコード", "ナチュル", "No.", "ニトロ", "忍者", "ヌメロニアス", "ヌメロン", "ヌーベルズ", 
      "N（ネオスペーシアン）", "影霊衣", "ネフティス", "ネムレリア", "ネメシス", "覇王眷竜", "覇王龍ズァーク", "破械", "破壊剣", "墓守", 
      "ハネクリボー", "春化精", "ハングリーバーガー", "ハーピィ", "バウンサー", "バスター・ブレイダー", "バルバロス", "バージェストマ", "BK（バーニングナックラー）", "バーバリアン", 
      "パペット", "パラディオン", "P.U.N.K.", "パーシアス", "光の黄金櫃", "彼岸", "氷水", "憑依装着", "氷結界", "ヒロイック", 
      "ビーステッド", "ビートルーパー", "B・F", "ピュアリィ", "ファイアウォール", "幻影騎士団", "ファーニマル", "封印されしエクゾディア", "妖精伝姫", "フォトン", 
      "フォーチュンレディ", "F.A.", "フレムベル", "ふわんだりぃず", "武神", "BF", "ブラック・マジシャン", "ブルーアイズ", "ブンボーグ", "プランキッズ", 
      "海造賊", "聖月の皇太子レグルス", "プリンセス・コロン", "捕食植物", "陽炎獣", "ヘカトンケイル", "ベアルクティ", "ペンギン", "方界", "宝玉獣", 
      "炎の剣士", "ホルス", "ホルスの黒炎竜", "白闘気", "ホーリーナイツ", "光天使", "ポータン", "魔界劇団", "マギストス", "マグネット・ウォリアー", 
      "魔鍵", "魔轟神", "マシンナーズ", "マジェスペクター", "マジシャン・ガール", "魔導獣", "魔術師", "M・HERO", "魔装戦士", "魔弾", 
      "マテリアクトル", "魔導書", "マドルチェ", "マナドゥム", "魔妖", "M∀LICE", "マリスボラス", "マリンセス", "水精鱗", "未界域", 
      "御巫", "霞の谷（ミスト・バレー）", "巳剣", "ミミグル", "ミュートリア", "未来皇ホープ", "無限起動", "ムーンライト", "溟界", "メガリス", 
      "メタファイズ", "メタル化", "メタルフォーゼ", "メメント", "メルフィー", "もけもけ", "森の聖獣", "森の聖霊", "モルガナイト", "紋章獣", 
      "ヤミー", "勇者", "有翼幻獣キマイラ", "ユベル", "夢魔鏡", "妖仙獣", "蕾禍", "ライゼオル", "ライトロード", "烙印", 
      "らくがきじゅう", "ラビュリンス", "RUM", "ラヴァル", "ラーの翼神竜", "リジェネシス", "リゾネーター", "リチュア", "六花", "リビングデッドの呼び声", 
      "リブロマンサー", "竜騎士ガイア", "竜剣士", "竜華", "竜星", "LL", "神碑", "霊神", "霊獣", "霊使い", 
      "RR", "R－ACE", "列車", "レッドアイズ", "レッド・デーモン", "レプティレス", "ロイド", "六武衆", "ローズ・ドラゴン", "ワイト", 
      "ワルキューレ", "ワーム", "ヴァイロン", "ヴァリアンツ", "ヴァルモニカ", "ヴァレット", "ヴァレル", "VS", "ヴァンパイア", "ヴィサス＝スタフロスト", 
      "V・HERO", "VWXYZ", "ヴェノム", "ヴェルズ", "ヴェンデット", "ヴェーダ", "ヴォルカニック", "メタビート"
    ];

    // 高速一括書き込み
    const deckValues = defaultDecks.map(deck => [deck]);
    settingsSheet.getRange(2, 1, deckValues.length, 1).setValues(deckValues);
    
    // 初期要因タグ（分析に役立つ詳細なリスト）
    const defaultTags = [
      // --- 敗因：プレイヤースキル・判断 ---
      "プレミ", "読み負け", "リソース管理ミス", "時間切れ", "集中力切れ",
      
      // --- 敗因：運・確率・構築 ---
      "事故（手札事故）", "誘発欠損", "捲り札欠損", "デッキ相性最悪", "運負け",
      
      // --- 敗因：システム・不可抗力 ---
      "通信切断", "先行ワンキル", "わからん殺し", "コイントス負け",
      
      // --- 勝因：ポジティブな要素 ---
      "理想展開", "誘発貫通", "捲り成功", "読み勝ち", "トップ解決",
      
      // --- その他状況 ---
      "サレンダー", "泥仕合", "後攻捲り", "詰めろ"
    ];
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
