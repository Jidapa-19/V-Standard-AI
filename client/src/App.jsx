import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 1000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SUGGESTIONS = [
  'อบรมวันไหนคะ',
  'เช็คอินกี่โมง',
  'มีข้อเน้นย้ำอะไรบ้าง',
  'ทำอะไรแล้วจะไม่ผ่านการอบรม',
];

let idCounter = 0;
const uid = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function readStoredTheme() {
  try {
    const saved = localStorage.getItem('aia-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'light';
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('copy failed');
}

/* ---------- Icons ---------- */
const Icon = {
  Send: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg>
  ),
  Clip: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  Alert: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
  ),
  Mic: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
  ),
  Sparkle: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></svg>
  ),
  Volume: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
  ),
  VolumeStop: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" x2="17" y1="9" y2="15" /><line x1="17" x2="23" y1="9" y2="15" /></svg>
  ),
};

/* ---------- Message bubble ---------- */
function MessageBubble({ message, isSpeaking, onToggleSpeak }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await copyText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`msg-row ${isUser ? 'from-user' : 'from-ai'}`}>
      {!isUser && <div className="avatar" aria-hidden="true">AI</div>}
      <div className={`bubble ${message.isError ? 'is-error' : ''} ${message.refused ? 'is-refused' : ''}`}>
        {message.images?.length > 0 && (
          <div className="bubble-images">
            {message.images.map((img) => (
              <img key={img.url} src={img.url} alt={`ภาพแนบ ${img.name}`} />
            ))}
          </div>
        )}
        {message.isError && (
          <div className="error-title">
            <Icon.Alert /> เกิดข้อผิดพลาด
          </div>
        )}
        {message.text && <p className="bubble-text">{message.text}</p>}

        {!isUser && message.sources?.length > 0 && (
          <details className="sources">
            <summary>อ้างอิงข้อมูลหลักสูตร ({message.sources.length})</summary>
            <ul>
              {message.sources.map((s) => (
                <li key={s.id}>
                  <span className="source-topic">{s.topic}</span>
                  <span>{s.value}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {!isUser && !message.isError && message.text && (
          <div className="bubble-actions">
            <button
              type="button"
              className={`mini-btn ${isSpeaking ? 'is-speaking' : ''}`}
              onClick={() => onToggleSpeak?.(message.id, message.text)}
              id={`speak-${message.id}`}
              aria-label={isSpeaking ? 'หยุดอ่านออกเสียง' : 'ฟังเสียงอ่านคำตอบ'}
              title={isSpeaking ? 'หยุดอ่าน' : 'ฟังเสียงอ่านคำตอบ (TTS)'}
            >
              {isSpeaking ? <Icon.VolumeStop /> : <Icon.Volume />}
              <span>{isSpeaking ? 'หยุดอ่าน' : 'ฟังเสียง'}</span>
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={handleCopy}
              id={`copy-${message.id}`}
              aria-label="คัดลอกคำตอบ"
            >
              {copied ? <Icon.Check /> : <Icon.Copy />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Voice utilities ---------- */
function findCuteThaiVoice(voicesList) {
  const list = voicesList && voicesList.length ? voicesList : (window.speechSynthesis?.getVoices() || []);
  const thai = list.filter((v) =>
    v.lang === 'th-TH' || v.lang.startsWith('th') || v.name.toLowerCase().includes('thai') || v.name.includes('ไทย')
  );
  if (!thai.length) return null;

  // Best Thai female voices priority:
  // 1. Premwadee (Microsoft Edge / Windows Natural - sweet, soft & natural)
  // 2. Achara (Microsoft Thai female)
  // 3. Kanya (Apple iOS/macOS Thai female)
  // 4. Any voice with 'female' / 'google'
  const keywords = ['premwadee', 'เปรมวดี', 'achara', 'อัจฉรา', 'kanya', 'กัญญา', 'female', 'google'];
  for (const kw of keywords) {
    const match = thai.find((v) => v.name.toLowerCase().includes(kw));
    if (match) return match;
  }
  return thai[0];
}

/* ---------- App ---------- */
export default function App() {
  const [theme, setTheme] = useState(readStoredTheme);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]); // { id, file, url }
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [voices, setVoices] = useState([]);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const listEndRef = useRef(null);
  const abortRef = useRef(null);
  const objectUrlsRef = useRef(new Set());
  const recognitionRef = useRef(null);
  const handsFreeRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const sendRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('aia-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);

  useEffect(() => {
    isLoadingRef.current = loading;
  }, [loading]);

  // Load available speech synthesis voices asynchronously
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis?.getVoices() || [];
      if (v.length) setVoices(v);
    };
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Revoke object URLs and stop audio / recognition on unmount.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      window.speechSynthesis?.cancel();
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Speak text with cute, sweet female voice parameters
  const speakCuteText = useCallback(
    (text, id, onComplete) => {
      if (!window.speechSynthesis) {
        setNotice('เบราว์เซอร์ของคุณยังไม่รองรับระบบอ่านออกเสียงค่ะ');
        onComplete?.();
        return;
      }

      // Temporarily stop microphone so it does not hear the speaker's own output
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setIsListening(false);
      window.speechSynthesis.cancel();

      // Clean markdown, bullet dashes, and numbers for fluid, natural Thai pronunciation
      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/^[-\s*•#\d.]+/gm, '')
        .replace(/อ้างอิงข้อมูลหลักสูตร.*$/gs, '')
        .trim();

      if (!cleanText) {
        onComplete?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'th-TH';
      // Pitch: 1.35 creates a sweet, cheerful, youthful female tone
      utterance.pitch = 1.35;
      // Rate: 1.05 provides natural, lively cadence
      utterance.rate = 1.05;

      const cuteVoice = findCuteThaiVoice(voices);
      if (cuteVoice) utterance.voice = cuteVoice;

      utterance.onstart = () => {
        setSpeakingId(id || 'cute-voice');
        isSpeakingRef.current = true;
      };

      const handleDone = () => {
        setSpeakingId(null);
        isSpeakingRef.current = false;
        onComplete?.();
      };

      utterance.onend = handleDone;
      utterance.onerror = handleDone;

      window.speechSynthesis.speak(utterance);
    },
    [voices],
  );

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'th-TH';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        if (handsFreeRef.current) {
          setNotice('🎙️ โหมดคุยอัตโนมัติ: พูดคำถามได้เลยค่ะ (หยุดพูด 1.3 วิ ระบบจะส่งคำถามให้อัตโนมัติ)');
        } else {
          setNotice('🎙️ กำลังฟังเสียง... พูดคำถามได้เลยค่ะ');
        }
      };

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript;
          } else {
            interimText += res[0].transcript;
          }
        }

        const transcript = (finalText || interimText).trim();
        if (transcript) {
          setInput(transcript);

          // In hands-free mode, auto-send after 1.3 seconds of pause
          if (handsFreeRef.current) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (handsFreeRef.current && !isLoadingRef.current && !isSpeakingRef.current && transcript.length > 0) {
                sendRef.current?.(transcript);
              }
            }, 1300);
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setIsListening(false);
          setHandsFree(false);
          handsFreeRef.current = false;
          setNotice('กรุณากดอนุญาตให้เบราว์เซอร์เข้าถึงไมโครโฟน เพื่อสั่งการด้วยเสียงนะคะ');
        } else if (event.error !== 'no-speech') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // If in hands-free mode and not speaking or waiting for AI, restart listening seamlessly
        if (handsFreeRef.current && !isLoadingRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (handsFreeRef.current && !isLoadingRef.current && !isSpeakingRef.current) {
              startRecognition();
            }
          }, 350);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Recognition start failed:', err);
      setIsListening(false);
    }
  }, []);

  const toggleHandsFree = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice('เบราว์เซอร์นี้ยังไม่รองรับระบบสั่งการด้วยเสียง แนะนำให้เปิดบน Google Chrome หรือ Microsoft Edge ค่ะ');
      return;
    }

    if (handsFree) {
      setHandsFree(false);
      handsFreeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      isSpeakingRef.current = false;
      setIsListening(false);
      setNotice('ปิดโหมดคุยอัตโนมัติแล้วค่ะ (สามารถกดปุ่มไมค์เพื่อพูดทีละคำถามได้)');
    } else {
      setHandsFree(true);
      handsFreeRef.current = true;
      setNotice('✨ เปิดโหมดคุยอัตโนมัติแล้ว! พูดคำถามได้เลยค่ะ ไม่ต้องกดปุ่มใดๆ');
      startRecognition();
    }
  };

  const toggleVoiceInput = () => {
    if (handsFree) {
      toggleHandsFree();
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setIsListening(false);
      return;
    }

    startRecognition();
  };

  const toggleSpeak = (id, text) => {
    if (speakingId === id) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      isSpeakingRef.current = false;
      return;
    }
    speakCuteText(text, id);
  };

  const testCuteVoice = () => {
    if (speakingId === 'test') {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      isSpeakingRef.current = false;
      return;
    }
    const sample = 'สวัสดีค่ะ หนูเป็นผู้ช่วยหลักสูตรมาตรฐานพนักงาน ยินดีที่ได้คุยด้วยนะคะ ถามหนูได้เลยค่ะ~ ✨';
    setNotice('💖 กำลังทดสอบเสียงผู้ช่วยสาวน้อยน่ารัก...');
    speakCuteText(sample, 'test', () => {
      setNotice('');
    });
  };

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(resizeTextarea, [input, resizeTextarea]);

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList ?? []);
      if (!incoming.length) return;
      const errors = [];
      const accepted = [];
      let slots = MAX_FILES - attachments.length;

      for (const file of incoming) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          errors.push(`"${file.name}" ไม่ใช่ไฟล์ JPG, PNG หรือ WEBP`);
        } else if (file.size > MAX_FILE_SIZE) {
          errors.push(`"${file.name}" มีขนาดเกิน 5 MB`);
        } else if (slots <= 0) {
          errors.push(`แนบได้สูงสุด ${MAX_FILES} ภาพ`);
          break;
        } else {
          const url = URL.createObjectURL(file);
          objectUrlsRef.current.add(url);
          accepted.push({ id: uid(), file, url });
          slots -= 1;
        }
      }
      if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
      setNotice(errors.join(' • '));
    },
    [attachments.length],
  );

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        objectUrlsRef.current.delete(target.url);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const send = async (override) => {
    const text = (override ?? input).trim();
    if (loading) return;
    if (!text && attachments.length === 0) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setNotice(`ข้อความยาวเกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`);
      return;
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);

    const files = attachments;
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', text, images: files.map((a) => ({ url: a.url, name: a.file.name })) },
    ]);
    setInput('');
    setAttachments([]);
    setNotice('');
    setLoading(true);
    isLoadingRef.current = true;

    const form = new FormData();
    if (text) form.append('message', text);
    files.forEach((a) => form.append('images', a.file, a.file.name));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: form, signal: controller.signal });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error(data?.error || `เซิร์ฟเวอร์ตอบกลับผิดพลาด (HTTP ${res.status})`);
      }
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          text: data.answer,
          sources: data.sources ?? [],
          refused: Boolean(data.refused),
        },
      ]);

      // If in hands-free mode, auto-read answer in cute voice and then re-open mic!
      if (handsFreeRef.current && data.answer) {
        speakCuteText(data.answer, assistantId, () => {
          if (handsFreeRef.current && !isLoadingRef.current) {
            setTimeout(() => {
              if (handsFreeRef.current && !isLoadingRef.current) {
                startRecognition();
              }
            }, 400);
          }
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      const msg =
        err instanceof TypeError
          ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Backend ทำงานอยู่ค่ะ'
          : err.message;
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', text: msg, isError: true }]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
      isLoadingRef.current = false;
      textareaRef.current?.focus();
    }
  };

  sendRef.current = send;

  const clearHistory = () => {
    if (!messages.length && !attachments.length) return;
    if (!window.confirm('ต้องการล้างประวัติสนทนาทั้งหมดใช่ไหม?')) return;
    abortRef.current?.abort();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    isSpeakingRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current.clear();
    setMessages([]);
    setAttachments([]);
    setNotice('');
    setLoading(false);
    isLoadingRef.current = false;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const onPaste = (e) => {
    const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (images.length) {
      e.preventDefault();
      addFiles(images);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const canSend = !loading && (input.trim().length > 0 || attachments.length > 0);

  return (
    <div
      className={`app ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="bg-glow" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">🎓</div>
          <div>
            <h1>V-Standard AI</h1>
            <p className="brand-sub">หลักสูตร มาตรฐานพนักงาน (V)</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            id="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
          >
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            id="clear-history"
            onClick={clearHistory}
            disabled={!messages.length && !attachments.length}
            aria-label="ล้างประวัติสนทนา"
            title="ล้างประวัติสนทนา"
          >
            <Icon.Trash />
          </button>
        </div>
      </header>

      <main className="chat" aria-live="polite">
        {messages.length === 0 && (
          <section className="welcome">
            <div className="welcome-badge">พร้อมช่วยเหลือ</div>
            <h2>สวัสดีค่ะ มีอะไรให้ช่วยเกี่ยวกับการอบรมไหมคะ</h2>
            <p>
              ถามเรื่องวัน เวลา ข้อเน้นย้ำ หรือแนบภาพประกาศเพื่อตรวจสอบกับข้อมูลหลักสูตรได้เลยค่ะ
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  id={`suggestion-${i}`}
                  onClick={() => send(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isSpeaking={speakingId === m.id}
            onToggleSpeak={toggleSpeak}
          />
        ))}

        {loading && (
          <div className="msg-row from-ai">
            <div className="avatar" aria-hidden="true">AI</div>
            <div className="bubble typing" role="status">
              <span className="dots" aria-hidden="true"><i /><i /><i /></span>
              <span>กำลังประมวลผล...</span>
            </div>
          </div>
        )}
        <div ref={listEndRef} />
      </main>

      <footer className="composer-wrap">
        {notice && (
          <div className="notice" role="alert">
            <Icon.Alert />
            <span>{notice}</span>
            <button type="button" className="notice-close" onClick={() => setNotice('')} aria-label="ปิดข้อความแจ้งเตือน">
              <Icon.Close />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="previews">
            {attachments.map((a) => (
              <figure className="preview" key={a.id}>
                <img src={a.url} alt={`ตัวอย่าง ${a.file.name}`} />
                <button
                  type="button"
                  className="preview-remove"
                  id={`remove-${a.id}`}
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`ลบภาพ ${a.file.name}`}
                >
                  <Icon.Close />
                </button>
              </figure>
            ))}
          </div>
        )}

        <div className="voice-bar">
          <button
            type="button"
            className={`voice-mode-btn ${handsFree ? 'is-active' : ''}`}
            id="hands-free-toggle"
            onClick={toggleHandsFree}
            aria-label={handsFree ? 'ปิดโหมดคุยอัตโนมัติ' : 'เปิดโหมดคุยอัตโนมัติ (พูดได้เลยไม่ต้องกดไมค์)'}
            title={handsFree ? 'คลิกเพื่อปิดโหมดคุยอัตโนมัติ' : 'คลิกเพื่อเปิดโหมดพูดคุยต่อเนื่อง ไม่ต้องกดปุ่มไมค์'}
          >
            <span className={`status-indicator ${handsFree ? 'live' : ''}`} />
            <Icon.Mic />
            <span className="mode-text">
              {handsFree ? 'โหมดคุยอัตโนมัติ: เปิดอยู่ (พูดได้เลย)' : 'โหมดคุยอัตโนมัติ (Hands-Free)'}
            </span>
          </button>
          <button
            type="button"
            className={`test-voice-btn ${speakingId === 'test' ? 'is-playing' : ''}`}
            id="test-voice-btn"
            onClick={testCuteVoice}
            title="ทดสอบเสียงผู้ช่วยสาวน้อยน่ารัก"
          >
            <Icon.Sparkle />
            <span>{speakingId === 'test' ? 'กำลังพูด...' : 'เสียงสาวน้อยน่ารัก 💖'}</span>
          </button>
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            id="file-input"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="icon-btn attach"
            id="attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || attachments.length >= MAX_FILES}
            aria-label="แนบภาพ"
            title="แนบภาพ JPG, PNG, WEBP (สูงสุด 3 ภาพ ภาพละไม่เกิน 5 MB)"
          >
            <Icon.Clip />
          </button>
          <button
            type="button"
            className={`icon-btn mic-btn ${isListening ? 'is-listening' : ''} ${handsFree ? 'is-hands-free' : ''}`}
            id="mic-button"
            onClick={toggleVoiceInput}
            disabled={loading}
            aria-label={handsFree ? 'โหมดคุยอัตโนมัติเปิดอยู่ คลิกเพื่อปิด' : isListening ? 'กำลังฟังเสียง... คลิกเพื่อหยุด' : 'พูดคำถาม (สั่งการด้วยเสียง)'}
            title={handsFree ? 'โหมดคุยอัตโนมัติเปิดอยู่ (คลิกเพื่อปิด)' : isListening ? 'กำลังฟังเสียง... คลิกเพื่อหยุด' : 'พูดคำถามด้วยเสียง (Voice Input)'}
          >
            <Icon.Mic />
          </button>
          <textarea
            ref={textareaRef}
            id="message-input"
            rows={1}
            value={input}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="พิมพ์คำถาม... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            aria-label="ช่องพิมพ์ข้อความ"
          />
          <button type="submit" className="send-btn" id="send-button" disabled={!canSend} aria-label="ส่งข้อความ">
            <Icon.Send />
          </button>
        </form>
        <p className="hint">ตอบจากข้อมูลหลักสูตรเท่านั้น • ภาพไม่ถูกบันทึกบนเซิร์ฟเวอร์</p>
      </footer>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div>วางภาพที่นี่เพื่อแนบ</div>
        </div>
      )}
    </div>
  );
}
