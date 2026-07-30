import { useState, useEffect, useRef } from 'react';

function RealTimeTranscriber() {
  // 🌟【データエリア】：画面内で変化するメモ
  const [textHistory, setTextHistory] = useState([]); // 確定した文章のリスト（過去の発言）
  const [currentText, setCurrentText] = useState(""); // 今まさに話している途中の文字
  const [isListening, setIsListening] = useState(false); // マイクがONかどうか

  // ブラウザの音声認識システムを保持するための「隠し変数（Ref）」
  const recognitionRef = useRef(null);

  // ⚡【ルールエリア①】：アプリが起動したときに、ブラウザの「耳」を準備する
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("お使いのブラウザは音声認識に対応していません。Google Chrome等でお試しください。");
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';         // 日本語を聴き取る
    rec.continuous = true;     // 💡【強化】言葉が途切れても自動終了しない
    rec.interimResults = true; // 💡【強化】話している途中の未確定の文字もリアルタイムで受け取る

    // 音声を聞き取って、文字に変換されたときのルール
    rec.onresult = (event) => {
      let interim = ""; // 話している途中の文字を入れる箱
      let finalized = ""; // 話し終わって「確定」した文字を入れる箱

      // 聞き取ったデータ（結果）を1つずつチェックする
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalized += event.results[i][0].transcript; // 確定した文章
        } else {
          interim += event.results[i][0].transcript; // 途中の文章
        }
      }

      // 話し終わった文章があれば、過去の歴史（配列）に追加する
      if (finalized) {
        setTextHistory((prev) => [...prev, finalized]);
        setCurrentText(""); // 途中の文字はリセット
      } else {
        setCurrentText(interim); // 今まさに話している文字を画面に映す
      }
    };

    // 💡【強化】無音などが原因でブラウザの耳が勝手に閉じたら、自動で叩き起こすルール
    rec.onend = () => {
      // プログラマーが意図して「停止ボタン」を押したわけではないなら、再起動する
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.start();
          console.log("音声認識を自動で再スタートしました");
        } catch (e) {
          console.error("再起動に失敗しました:", e);
        }
      }
    };

    recognitionRef.current = rec;
  }, [isListening]); // マイクの状態が変わったらルールを再調整する

  // ⚡【ルールエリア②】：ボタンが押されたときの動き
  const toggleListening = () => {
    if (isListening) {
      // 停止する
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      // 開始する
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // 🎨【見た目エリア】：HTMLの組み立て
  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>💻 ロン君のリアルタイム会議文字起こし</h1>
      
      {/* ボタンの見た目。状態（ON/OFF）で色と文字を変える */}
      <button 
        onClick={toggleListening} 
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: isListening ? '#ff4d4f' : '#1890ff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isListening ? "⏹️ 会議の録音・文字起こしを停止" : "▶️ 会議の文字起こしを開始"}
      </button>

      {/* 文字起こし結果の表示スペース */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        border: '2px solid #e8e8e8', 
        borderRadius: '8px',
        backgroundColor: '#fafafa',
        minHeight: '200px',
        textAlign: 'left',
        lineHeight: '1.6'
      }}>
        {/* 1. 過去に話し終わって「確定」した文章を一行ずつ表示 */}
        {textHistory.map((sentence, index) => (
          <p key={index} style={{ margin: '0 0 10px 0', color: '#333' }}>
            {sentence}
          </p>
        ))}

        {/* 2. 今まさに現在進行形で話している途中の文字（少し薄い色でパラパラ動く） */}
        {currentText && (
          <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>
            {currentText} ...
          </p>
        ))}

        {textHistory.length === 0 && !currentText && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '80px' }}>
            開始ボタンを押してマイクに向かって話すと、ここにリアルタイムに文字が表示されます。
          </p>
        )}
      </div>
    </div>
  );
}

export default RealTimeTranscriber;
