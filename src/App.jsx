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
  const isListeningRef = useRef(false); // 💡Edgeの自動起動判定を100%正確にするためのフラグ

  // 状態の変化を常に隠し変数に同期しておく（Edgeの遅延対策）
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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

    // ✅【固定】：[i][0].transcript の形を完全に固定し、未定義を徹底排除
    rec.onresult = (event) => {
      let interim = ""; 
      let finalized = ""; 

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalized += event.results[i][0].transcript; 
        } else {
          interim += event.results[i][0].transcript; 
        }
      }

      if (finalized) {
        setTextHistory((prev) => [...prev, finalized]);
        setCurrentText(""); 
      } else {
        setCurrentText(interim); 
      }
    };

    // 💡【Edge自動復帰の強化】：Edgeのシステムが完全に静止するのを待ってから安全に叩き起こす
    rec.onend = () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      // ユーザーが手動で停止を押していない（まだONのまま勝手に切れた）場合
      if (isListeningRef.current) {
        // Edgeの終了処理が完全に終わるよう「400ミリ秒」待ってからクリーンに再起動
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              console.log("Edge/Chromeの音声認識を自動で安全に再起動しました");
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
    if (isListening) {
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

  // ⚡【ルールエリア④】：テキストファイルとしてダウンロードするルール
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
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>💻 ロン君のリアルタイム会議文字起こし</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          
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
              fontWeight: 'bold',
            }}
          >
            {isListening ? "⏹️ 会議の録音・文字起こしを停止" : "▶️ 会議の文字起こしを開始"}
          </button>

          <button 
            onClick={downloadTextFile}
            disabled={textHistory.length === 0} 
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#52c41a', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: textHistory.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: textHistory.length === 0 ? 0.5 : 1 
            }}
          >
            📥 テキストをダウンロード
          </button>

        </div>

        {isListening && (
          <div style={{ width: '300px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#666' }}>🎤 マイク音量チェック: {micVolume}%</span>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#e8e8e8', borderRadius: '5px', marginTop: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${micVolume}%`, height: '100%', backgroundColor: micVolume > 50 ? '#ff4d4f' : '#52c41a', transition: 'width 0.1s ease' }} />
            </div>
          </div>
        )}
      </div>

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
        {textHistory.map((sentence, index) => {
          return (
            <p key={index} style={{ margin: '0 0 10px 0', color: '#333' }}>
              {sentence}
            </p>
          );
        })}

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
