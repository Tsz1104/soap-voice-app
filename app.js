/**
 * 音声入力SOAPノート - メインJavaScript
 * Web Speech API によるリアルタイム音声認識 & キーワードベースSOAP自動分類
 */

// ========================================================
// 定数・キーワード設定
// ========================================================
const SOAP_RULES = {
  S: {
    key: 'S',
    name: 'S（主観的情報）',
    keywords: [
      '痛い', '痛む', '痛み', 'いたい', '痛みます',
      'つらい', '辛い', 'しびれる', '痺れる', '痺れ',
      'だるい', 'ダルい', '重い', '動かしにくい',
      '不安', '眠れない', '眠れません', '不眠',
      '訴え', '言っている', 'おっしゃる', '違和感', 'こわばる',
      '苦しい', '息苦しい', '疲れる', '疲れ', '気分'
    ]
  },
  O: {
    key: 'O',
    name: 'O（客観的情報）',
    keywords: [
      'rom', 'mmt', '度', 'cm', 'kg', 'mmhg', '回', '秒', '分',
      '歩行', '歩行器', '杖', '独歩', '握力', 'バイタル',
      '腫脹', '熱感', '発赤', '浮腫', '血圧', '脈拍', '体温',
      'spo2', '酸素飽和度', '反射', '徒手筋力', '可動域',
      '右', '左', '健側', '患側', '所見', '創部', '打診', '聴診'
    ]
  },
  A: {
    key: 'A',
    name: 'A（評価）',
    keywords: [
      '考えられる', '原因', '問題', '改善', '低下', '制限',
      'リスク', '評価', '疑い', '影響', '要因', '困難',
      '可能性', '考察', '良好', '増悪', '維持', '阻害', '見込み'
    ]
  },
  P: {
    key: 'P',
    name: 'P（計画）',
    keywords: [
      'プログラム', '目標', '実施', '継続', '指導', '週',
      'セット', '退院', '自主トレ', '自主練習', '予定',
      '方針', '処方', '訓練', '介入', 'アプローチ', 'リハビリ',
      '見守り', '介助', '連携', '相談', 'カンファレンス'
    ]
  }
};

// サンプルデータ
const SAMPLE_TEXT = 
`右膝に強い痛みがあると本人の訴えあり。
夜間も疼いて眠れないと不安を話されている。
膝関節ROM屈曲105度、伸展-10度、大腿四頭筋MMT3レベル。
10m歩行テストは18秒、歩行時に右立脚期の短縮と軽度の跛行を認める。
大腿四頭筋の筋力低下と関節可動域制限が歩行障害の主な原因と考えられる。
転倒リスクが高いため立位バランスの再評価が必要である。
週3回の大腿四頭筋筋力増強訓練と可動域拡大アプローチを継続して実施する。
退院に向けて家族へ歩行介助方法の指導および自宅での自主トレメニューを処方する。
本日は血圧測定も実施し安定していた。`;

// ========================================================
// DOM要素
// ========================================================
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const convertBtn = document.getElementById('convertBtn');
const sampleBtn = document.getElementById('sampleBtn');
const clearBtn = document.getElementById('clearBtn');
const copyAllBtn = document.getElementById('copyAllBtn');

const transcriptArea = document.getElementById('transcriptArea');
const interimDisplay = document.getElementById('interimDisplay');
const charCount = document.getElementById('charCount');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const recordingWave = document.getElementById('recordingWave');
const browserWarning = document.getElementById('browserWarning');

const sList = document.getElementById('sList');
const oList = document.getElementById('oList');
const aList = document.getElementById('aList');
const pList = document.getElementById('pList');
const uList = document.getElementById('uList');
const toastEl = document.getElementById('toast');

// ========================================================
// 音声認識（Web Speech API）の状態
// ========================================================
let recognition = null;
let isRecording = false;
let finalAccumulatedText = '';

// Web Speech API のサポートチェック
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  browserWarning.classList.remove('hidden');
  startBtn.disabled = true;
} else {
  initSpeechRecognition();
}

/**
 * 音声認識オブジェクトの初期化
 */
function initSpeechRecognition() {
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    updateStatus('recording', '録音中');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    recordingWave.classList.remove('hidden');
  };

  recognition.onresult = (event) => {
    let interimText = '';
    let newlyFinalText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        // 句点が付いていなければ読みやすく補完
        let formatted = text.trim();
        if (!formatted.endsWith('。') && !formatted.endsWith('！') && !formatted.endsWith('？')) {
          formatted += '。';
        }
        newlyFinalText += (newlyFinalText ? '\n' : '') + formatted;
      } else {
        interimText += text;
      }
    }

    if (newlyFinalText) {
      const current = transcriptArea.value.trim();
      transcriptArea.value = current ? current + '\n' + newlyFinalText : newlyFinalText;
      updateCharCount();
    }

    // 暫定テキストのプレビュー表示
    if (interimText) {
      interimDisplay.textContent = '認識中: ' + interimText;
      interimDisplay.classList.remove('hidden');
    } else {
      interimDisplay.classList.add('hidden');
      interimDisplay.textContent = '';
    }

    // スクロールを最下部に
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。');
      stopRecording();
    } else if (event.error === 'no-speech') {
      // 音声が検出されない場合は継続可能
    } else if (event.error === 'network') {
      showToast('ネットワークエラーが発生しました。音声認識サーバーへの接続を確認してください。');
      stopRecording();
    }
  };

  recognition.onend = () => {
    interimDisplay.classList.add('hidden');
    // ユーザーが明示的に停止ボタンを押していない場合は再接続（continuous対策）
    if (isRecording) {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Recognition restart failed:', err);
        stopRecording();
      }
    } else {
      updateStatus('idle', '待機中');
      startBtn.disabled = false;
      stopBtn.disabled = true;
      recordingWave.classList.add('hidden');
    }
  };
}

/**
 * 録音開始
 */
function startRecording() {
  if (!recognition) return;
  try {
    isRecording = true;
    recognition.start();
    showToast('音声認識を開始しました。マイクに向かって話してください。');
  } catch (err) {
    console.error('Failed to start recognition:', err);
    isRecording = false;
    showToast('音声認識の開始に失敗しました。');
  }
}

/**
 * 録音停止
 */
function stopRecording() {
  isRecording = false;
  if (recognition) {
    recognition.stop();
  }
  updateStatus('idle', '待機中');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  recordingWave.classList.add('hidden');
  interimDisplay.classList.add('hidden');
  showToast('音声認識を停止しました。テキストを確認・編集できます。');
}

/**
 * ステータスバッジの更新
 */
function updateStatus(state, label) {
  statusBadge.className = 'status-badge status-' + state;
  statusText.textContent = label;
}

/**
 * 文字数カウントの更新
 */
function updateCharCount() {
  const count = transcriptArea.value.length;
  charCount.textContent = `${count} 文字`;
}

// ========================================================
// 文の分割 & SOAPキーワード分類ロジック
// ========================================================

/**
 * テキストを意味のある文の単位に分割
 */
function splitIntoSentences(text) {
  if (!text || !text.trim()) return [];

  // 改行、句点（。！？!?）、セミコロン等で区切る
  const rawParts = text
    .split(/[\n\r]+/)
    .flatMap(line => {
      // 句点や感嘆符でさらに分割
      return line.split(/(?<=[。！？!?])/g);
    });

  return rawParts
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * 1つの文をSOAPカテゴリに分類
 * @returns { category: 'S'|'O'|'A'|'P'|'U', matches: string[] }
 */
function classifySentence(sentence) {
  const normalized = sentence.toLowerCase();

  const scores = {
    S: { count: 0, matchedKeywords: [] },
    O: { count: 0, matchedKeywords: [] },
    A: { count: 0, matchedKeywords: [] },
    P: { count: 0, matchedKeywords: [] }
  };

  // 各カテゴリごとにキーワードマッチを検査
  for (const [key, rule] of Object.entries(SOAP_RULES)) {
    for (const kw of rule.keywords) {
      const lowerKw = kw.toLowerCase();
      // 単語の出現をチェック
      if (normalized.includes(lowerKw)) {
        scores[key].count += 1;
        if (!scores[key].matchedKeywords.includes(kw)) {
          scores[key].matchedKeywords.push(kw);
        }
      }
    }
  }

  // 最もスコア（該当キーワード数）が高いカテゴリを選定
  let bestCategory = 'U'; // Unclassified (未分類)
  let maxScore = 0;

  // 優先順位: S -> O -> A -> P
  const categories = ['S', 'O', 'A', 'P'];
  for (const cat of categories) {
    if (scores[cat].count > maxScore) {
      maxScore = scores[cat].count;
      bestCategory = cat;
    }
  }

  return {
    sentence: sentence,
    category: bestCategory,
    matches: bestCategory !== 'U' ? scores[bestCategory].matchedKeywords : []
  };
}

/**
 * SOAP変換の実行
 */
function convertToSOAP() {
  const text = transcriptArea.value.trim();
  if (!text) {
    showToast('分類するテキストがありません。音声を録音するかテキストを入力してください。');
    return;
  }

  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    showToast('有効な文章が見つかりませんでした。');
    return;
  }

  const results = {
    S: [],
    O: [],
    A: [],
    P: [],
    U: []
  };

  sentences.forEach(sentence => {
    const classification = classifySentence(sentence);
    results[classification.category].push(classification);
  });

  // UIに反映
  renderSOAPResults(results);
  showToast(`SOAP形式に変換しました（合計 ${sentences.length} 文）`);

  // SOAPセクションへスムーズスクロール
  const soapSection = document.getElementById('soapSection');
  if (soapSection) {
    soapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * 分類結果をDOMに描画
 */
function renderSOAPResults(results) {
  renderList(sList, results.S);
  renderList(oList, results.O);
  renderList(aList, results.A);
  renderList(pList, results.P);
  renderList(uList, results.U);
}

/**
 * 個別カードのリストを描画
 */
function renderList(listEl, items) {
  listEl.innerHTML = '';

  if (!items || items.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = '該当する文はありません';
    listEl.appendChild(emptyLi);
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'sentence-item';

    const textDiv = document.createElement('div');
    textDiv.className = 'sentence-text';
    textDiv.textContent = item.sentence;
    li.appendChild(textDiv);

    if (item.matches && item.matches.length > 0) {
      const badgeDiv = document.createElement('div');
      badgeDiv.className = 'keyword-badges';
      item.matches.forEach(kw => {
        const badge = document.createElement('span');
        badge.className = 'matched-badge';
        badge.textContent = '🏷️ ' + kw;
        badgeDiv.appendChild(badge);
      });
      li.appendChild(badgeDiv);
    }

    listEl.appendChild(li);
  });
}

// ========================================================
// コピー機能
// ========================================================

/**
 * SOAP全体のテキストを整形してクリップボードにコピー
 */
function copyAllSOAP() {
  const getSectionTexts = (listId) => {
    const el = document.getElementById(listId);
    if (!el) return [];
    const items = el.querySelectorAll('.sentence-text');
    return Array.from(items).map(item => item.textContent);
  };

  const sTexts = getSectionTexts('sList');
  const oTexts = getSectionTexts('oList');
  const aTexts = getSectionTexts('aList');
  const pTexts = getSectionTexts('pList');
  const uTexts = getSectionTexts('uList');

  const formatSection = (label, arr) => {
    return `【${label}】\n` + (arr.length > 0 ? arr.map(t => '・' + t).join('\n') : '（該当なし）');
  };

  let formatted = [
    formatSection('S: 主観的情報', sTexts),
    formatSection('O: 客観的情報', oTexts),
    formatSection('A: 評価', aTexts),
    formatSection('P: 計画', pTexts)
  ].join('\n\n');

  if (uTexts.length > 0) {
    formatted += '\n\n' + formatSection('未分類', uTexts);
  }

  navigator.clipboard.writeText(formatted).then(() => {
    showToast('SOAP全文をクリップボードにコピーしました！');
  }).catch(err => {
    console.error('Copy failed:', err);
    showToast('コピーに失敗しました。');
  });
}

/**
 * 特定のセクションのみをクリップボードにコピー
 */
function copySection(listId) {
  const el = document.getElementById(listId);
  if (!el) return;
  const items = el.querySelectorAll('.sentence-text');
  const texts = Array.from(items).map(item => item.textContent);

  if (texts.length === 0) {
    showToast('コピーする内容がありません');
    return;
  }

  const content = texts.join('\n');
  navigator.clipboard.writeText(content).then(() => {
    showToast('セクションの内容をコピーしました');
  }).catch(() => {
    showToast('コピーに失敗しました');
  });
}

// ========================================================
// ユーティリティ機能
// ========================================================

/**
 * トーストメッセージ表示
 */
let toastTimer = null;
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

// ========================================================
// イベントリスナー設定
// ========================================================
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
convertBtn.addEventListener('click', convertToSOAP);

sampleBtn.addEventListener('click', () => {
  transcriptArea.value = SAMPLE_TEXT;
  updateCharCount();
  showToast('サンプル文章を読み込みました。「SOAP変換」を押してください。');
});

clearBtn.addEventListener('click', () => {
  if (transcriptArea.value.trim() && !confirm('入力テキストをクリアしますか？')) {
    return;
  }
  transcriptArea.value = '';
  updateCharCount();
  renderSOAPResults({ S: [], O: [], A: [], P: [], U: [] });
  showToast('テキストをクリアしました');
});

transcriptArea.addEventListener('input', updateCharCount);

copyAllBtn.addEventListener('click', copyAllSOAP);

// 各セクションの個別コピーボタン
document.querySelectorAll('.copy-section-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    copySection(targetId);
  });
});
