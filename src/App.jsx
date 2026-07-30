import { useState, useEffect, useRef } from 'react';

export default function App() {
  // 🌟【データエリア】
  const [textHistory, setTextHistory] = useState([]); // 確定した文章のリスト
  const [currentText, setCurrentText] = useState(""); // 今まさに話している途中の文字
  const [isListening, setIsListening] = useState(false); // マイクがONかどうか

  // ブラウザの音声認識システムを保持するための「隠し変数（Ref）」
  const recognitionRef = useRef(null);

  // ⚡【ルールエリア①】：音声認識の準備
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("お使いのブラウザは音声認識に対応していません。Google Chrome等でお試しください。");
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';         
    rec.continuous = true;     
    rec.interimResults = true; 

    rec.onresult = (event) => {
      let interim = ""; 
      let finalized = ""; 

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalized += event.results[i].transcript; 
        } else {
          interim += event.results[i].transcript; 
        }
      }

      if (finalized) {
        setTextHistory((prev) => [...prev, finalized]);
        setCurrentText(""); 
      } else {
        setCurrentText(interim); 
      }
    };

    rec.onend = () => {
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
  }, [isListening]); 

  // ⚡【ルールエリア②】：ボタンが押されたときの動き
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // 🎨【見た目エリア】：HTMLの組み立て
  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>💻 ロン君のリアルタイム会議文字起こし</h1>
      
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
        {textHistory.map((sentence, index) => {
          return (
            <p key={index} style={{ margin: '0 0 10px 0', color: '#333' }}>
              {sentence}
            </p>
          );
        })}

        {/* 2. 今まさに現在進行形で話している途中の文字 */}
        {currentText && (
          <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>
            {currentText} ...
          </p>
        )}

        {textHistory.length === 0 && !currentText && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '80px' }}>
            開始ボタンを押してマイクに向かって話すと、ここにリアルタイムに文字が表示されます。
          </p>
        )}
      </div>
    </div>
  );
}
