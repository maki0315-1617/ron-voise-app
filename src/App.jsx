import { useState, useEffect, useRef } from 'react';

export default function App() {
  // 🌟【データエリア】
  const [textHistory, setTextHistory] = useState([]); 
  const [currentText, setCurrentText] = useState(""); 
  const [isListening, setIsListening] = useState(false); 
  const [micVolume, setMicVolume] = useState(0); // 💡【追加】マイクの音量を記憶するメモ（0〜100）

  // 隠し変数（Ref）の準備
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null); // 💡【追加】音の分析器を入れる箱
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

  // ⚡【ルールエリア②】：💡【追加】マイクの音量をメーターに反映する仕組み
  const startVolumeMeter = async () => {
    try {
      // 1. マイクの生音を捕まえる
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. 音を分析するシステム（AudioContext）を立ち上げる
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioContext;

      // 3. 画面の更新に合わせて、何度も音量を計算し直すループ処理
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        // 平均値を計算して 0〜100 の数値に変換
        const average = total / bufferLength;
        setMicVolume(Math.min(100, Math.floor(average * 2))); 

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.error("マイク音量の取得に失敗:", err);
    }
  };

  // 💡【追加】音量メーターを止める処理
  const stopVolumeMeter = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setMicVolume(0);
  };

  // ⚡【ルールエリア③】：ボタンが押されたときの動き（音量メーターと連動）
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
      stopVolumeMeter(); // 💡音量メーターも止める
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
      startVolumeMeter(); // 💡音量メーターも動かす
    }
  };

  // アプリを閉じたときに音量の処理を完全に消去する（安全対策）
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // 🎨【見た目エリア】：HTMLの組み立て
  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>💻 ロン君の文字起こし</h1>
      
      <div style={{ marginBottom: '20px' }}>
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
            display: 'block',
            margin: '0 auto 15px auto'
          }}
        >
          {isListening ? "⏹️ 会議の録音・文字起こしを停止" : "▶️ 会議の文字起こしを開始"}
        </button>

        {/* 💡【追加した見た目】マイク音量メーター */}
        {isListening && (
          <div style={{ maxWidth: '300px', margin: '0 auto', textAlign: 'center' }}>
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