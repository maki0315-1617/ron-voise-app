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
      console.error("マイク音量の取得に失敗:", err);
    }
  };

  const stopVolumeMeter = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setMicVolume(0);
  };

  // ⚡【ルールエリア③】：ボタンが押されたときの動き
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
      stopVolumeMeter(); 
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
      startVolumeMeter(); 
    }
  };

  // ⚡【ルールエリア④】：【修正済】テキストファイルとしてダウンロードするルール
  const downloadTextFile = () => {
    const fullText = textHistory.join('\n');

    if (!fullText) {
      alert("ダウンロードする文字起こしテキストがありません。");
      return;
    }

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = "gijiroku.txt"; // 最もシンプルな文字列指定に修正しました

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
