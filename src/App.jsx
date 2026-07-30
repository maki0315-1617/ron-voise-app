import { useState, useEffect, useRef } from 'react';

export default function App() {
  // 🌟【データエリア】
  const [textHistory, setTextHistory] = useState([]); 
  const [currentText, setCurrentText] = useState(""); 
  const [isListening, setIsListening] = useState(false); 
  const [micVolume, setMicVolume] = useState(0); 

  // 隠し変数の準備
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null); 
  const animationFrameRef = useRef(null);
  const restartTimerRef = useRef(null); 
  const isListeningRef = useRef(false); 
  const scrollContainerRef = useRef(null); 

  // 状態の変化を常に隠し変数に同期しておく
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // 新しい文字が追加されたら、テキストエリアを自動で一番下までスクロールさせるルール
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [textHistory, currentText]);

  // ⚡【ルールエリア①】：音声認識の準備
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("お使いのブラウザは音声認識に対応していません。Google ChromeやEdgeでお試しください。");
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';         
    rec.continuous = true;     
    rec.interimResults = true; 

    // ✅【先祖返り完全防止】：.item(0) 構文を完全に維持し、未定義エラーを永久に防ぎます
    rec.onresult = (event) => {
      let interim = ""; 
      let finalized = ""; 

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const resultItem = event.results.item(i);
        if (resultItem) {
          const alternative = resultItem.item(0);
          if (alternative) {
            if (resultItem.isFinal) {
              finalized += alternative.transcript;
            } else {
              interim += alternative.transcript;
            }
          }
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
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      if (isListeningRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              console.log("音声認識を自動で安全に再起動しました");
            } catch (e) {
              console.error("再起動に失敗しました（稼働中の衝突）:", e);
            }
          }
        }, 400); 
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []); 

  // ⚡【ルールエリア②】：マイクの音量をメーターに反映する仕組み
  const startVolumeMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioContext;

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const average = total / bufferLength;
        setMicVolume(Math.min(100, Math.floor(average * 2))); 

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.error("マイク音量を処理できませんでした:", err);
    }
  };

  const stopVolumeMeter = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setMicVolume(0);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current); 
  };

  // ⚡【ルールエリア③】：ボタンが押されたときの動き
  const toggleListening = () => {
    if (isListeningRef.current) {
      setIsListening(false);
      recognitionRef.current?.stop();
      stopVolumeMeter(); 
    } else {
      setIsListening(true);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognitionRef.current?.start();
      startVolumeMeter(); 
    }
  };

  // ⚡【ルールエリア④】：文字起こしクリアのルール
  const clearTextHistory = () => {
    if (window.confirm("文字起こしされたテキストをすべて消去してもよろしいですか？")) {
      setTextHistory([]);
      setCurrentText("");
    }
  };

  // ⚡【ルールエリア⑤】：テキストファイルとしてダウンロードするルール
  const downloadTextFile = () => {
    const fullText = textHistory.join('\n');

    if (!fullText) {
      alert("ダウンロードする文字起こしテキストがありません。");
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; 
    const date = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    const m = month < 10 ? '0' + month : month;
    const d = date < 10 ? '0' + date : date;
    const h = hours < 10 ? '0' + hours : hours;
    const min = minutes < 10 ? '0' + minutes : minutes;

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = year + "年" + m + "月" + d + "日_" + h + "時" + min + "分.txt"; 

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []);
  // 🎨【見た目エリア】：HTMLの組み立て
  return (
    <div style={{ padding: '20px 15px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      <div style={{ flex: 1 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '24px', margin: '10px 0 20px 0', textAlign: 'center' }}>
          <img src="/ron.png" alt="Ron" style={{ width: '35px', height: '35px', objectFit: 'contain' }} />
          ロン君の音声簡易文字起こし
        </h1>
        
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
            
            <button 
              onClick={toggleListening} 
              style={{
                padding: '12px 20px',
                fontSize: '15px',
                backgroundColor: isListening ? '#ff4d4f' : '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                flex: '1 1 auto', 
                minWidth: '140px'
              }}
            >
              {isListening ? "⏹️ 停止" : "▶️ 開始"}
            </button>

            <button 
              onClick={downloadTextFile}
              disabled={textHistory.length === 0} 
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                backgroundColor: '#52c41a', 
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: textHistory.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: textHistory.length === 0 ? 0.5 : 1,
                flex: '1 1 auto',
                minWidth: '140px'
              }}
            >
              📥 保存
            </button>

            <button 
              onClick={clearTextHistory}
              disabled={textHistory.length === 0 && !currentText} 
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                backgroundColor: '#faad14', 
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (textHistory.length === 0 && !currentText) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: (textHistory.length === 0 && !currentText) ? 0.5 : 1,
                flex: '1 1 auto',
                minWidth: '140px'
              }}
            >
              🗑️ クリア
            </button>

          </div>

          {isListening && (
            <div style={{ width: '100%', maxWidth: '300px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#666' }}>🎤 マイク音量チェック: {micVolume}%</span>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#e8e8e8', borderRadius: '5px', marginTop: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${micVolume}%`, height: '100%', backgroundColor: micVolume > 50 ? '#ff4d4f' : '#52c41a', transition: 'width 0.1s ease' }} />
              </div>
            </div>
          )}
        </div>

        <div 
          ref={scrollContainerRef}
          style={{ 
            marginTop: '20px', 
            padding: '15px', 
            border: '2px solid #e8e8e8', 
            borderRadius: '8px',
            backgroundColor: '#fafafa',
            height: '350px', 
            overflowY: 'auto', 
            textAlign: 'left',
            lineHeight: '1.6',
            boxSizing: 'border-box'
          }}
        >
          {textHistory.map((sentence, index) => {
            return (
              <p key={index} style={{ margin: '0 0 10px 0', color: '#333', fontSize: '15px', wordBreak: 'break-all' }}>
                {sentence}
              </p>
            );
          })}

          {currentText && (
            <p style={{ margin: 0, color: '#999', fontStyle: 'italic', fontSize: '15px', wordBreak: 'break-all' }}>
              {currentText} ...
            </p>
          )}

          {textHistory.length === 0 && !currentText && (
            <p style={{ color: '#aaa', textAlign: 'center', marginTop: '130px', fontSize: '14px' }}>
              開始ボタンを押してマイクに向かって話すと、ここにリアルタイムに文字が表示されます。
            </p>
          )}
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '20px 0 10px 0', fontSize: '13px', color: '#888', borderTop: '1px solid #eee', marginTop: '20px' }}>
        <p>&copy; {new Date().getFullYear()} ron. All rights reserved.</p>
      </footer>

    </div>
  );
}
