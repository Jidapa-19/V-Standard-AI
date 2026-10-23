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
  Shield: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
  ),
  Scan: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /><path d="M12 9v1" /><path d="M12 14v1" /></svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
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

function createInitialGreeting() {
  return {
    id: 'welcome-greeting',
    role: 'assistant',
    text: 'สวัสดีค่ะ ยินดีต้อนรับพี่ๆ น้องๆ ผู้เข้าอบรมหลักสูตร "มาตรฐานพนักงาน (V)" ทุกท่านนะคะ! 🎓✨\n\nหนูเป็นผู้ช่วย AI ประจำหลักสูตร พร้อมให้ข้อมูลและตอบทุกข้อสงสัยเกี่ยวกับวันเวลาอบรม การเช็คอิน การแต่งกาย สถานที่ และข้อเน้นย้ำต่างๆ ค่ะ สอบถามหนูได้เลยนะคะ~',
    sources: [
      { id: 'course_name', category: 'ข้อมูลทั่วไป', topic: 'ชื่อหลักสูตร', value: 'มาตรฐานพนักงาน (V)' },
      { id: 'greeting', category: 'ข้อมูลทั่วไป', topic: 'การทักทายต้อนรับผู้เข้าอบรม', value: 'ยินดีต้อนรับผู้เข้าอบรมหลักสูตรมาตรฐานพนักงาน (V)' },
    ],
  };
}

/* ---------- Admin Knowledge Management Modal ---------- */
const CATEGORY_OPTIONS = [
  'ข้อมูลทั่วไป',
  'ข้อเน้นย้ำ',
  'ข้อควรระวังที่จะทำให้ไม่ผ่าน',
];

function AdminModal({ isOpen, onClose, onCourseUpdated }) {
  // Auth state: 'credentials' | 'face_scan' | 'authenticated'
  const [token, setToken] = useState(() => sessionStorage.getItem('aia_admin_token') || '');
  const [authStep, setAuthStep] = useState(() => (sessionStorage.getItem('aia_admin_token') ? 'authenticated' : 'credentials'));

  // Step 1: Credentials
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [userProfile, setUserProfile] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('aia_admin_user') || 'null');
    } catch {
      return null;
    }
  });

  // Step 2: Camera & Face Scan
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Course Data & Editor state
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('facts'); // 'facts' | 'general'
  const [categoryFilter, setCategoryFilter] = useState('ทั้งหมด');
  const [search, setSearch] = useState('');

  // Fact Editor state
  const [editingFactId, setEditingFactId] = useState(null);
  const [factForm, setFactForm] = useState({ id: '', category: 'ข้อเน้นย้ำ', topic: '', value: '' });
  const [isAdding, setIsAdding] = useState(false);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  // Start camera stream for Face Scan
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError('');
    setCameraLoading(true);
    setScanMessage('กำลังเปิดกล้องเว็บแคมเพื่อสแกนใบหน้า...');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับการเปิดกล้องเว็บแคมค่ะ');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setScanMessage('กล้องพร้อมแล้ว! กรุณามองตรงที่กล้องและกด "สแกนใบหน้า"');
    } catch (err) {
      console.warn('Camera access issue:', err);
      setCameraError('ไม่สามารถเปิดกล้องได้ (เบราว์เซอร์บล็อก หรือไม่มีอุปกรณ์กล้อง)');
      setScanMessage('สามารถเลือกใช้ "โหมดจำลองสแกนใบหน้า" ด้านล่างเพื่อทดสอบได้ค่ะ');
    } finally {
      setCameraLoading(false);
    }
  }, [stopCamera]);

  // Clean up camera when leaving face_scan step or closing modal
  useEffect(() => {
    if (isOpen && authStep === 'face_scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, authStep, startCamera, stopCamera]);

  // Fetch course data when authenticated and open
  const loadData = useCallback(async (currentToken) => {
    const activeToken = currentToken || token;
    if (!activeToken) return;
    setLoading(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/course', {
        headers: {
          'x-admin-token': activeToken,
          'x-admin-pin': activeToken,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('aia_admin_token');
          sessionStorage.removeItem('aia_admin_user');
          setToken('');
          setAuthStep('credentials');
          setAuthError('เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบใหม่ค่ะ');
          return;
        }
        throw new Error('ไม่สามารถโหลดข้อมูลหลักสูตรได้');
      }
      const data = await res.json();
      setCourseData(data);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && authStep === 'authenticated') {
      loadData(token);
    }
  }, [isOpen, authStep, loadData, token]);

  if (!isOpen) return null;

  // Step 1: Verify Username & Password
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError('กรุณากรอกทั้งชื่อผู้ใช้และรหัสผ่านค่ะ');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องค่ะ');
      }
      setChallengeToken(data.challengeToken);
      setAuthStep('face_scan');
      setScanSuccess(false);
      setIsScanning(false);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2: Capture snapshot & Verify Face Biometric
  const handleVerifyFace = async (isDemo = false) => {
    if (isScanning || scanSuccess) return;
    setIsScanning(true);
    setScanMessage('กำลังสแกนวิเคราะห์โครงหน้าชีวมิติ...');
    setAuthError('');

    let faceImage = null;
    if (!isDemo && videoRef.current && canvasRef.current) {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        faceImage = canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.warn('Snapshot capture failed:', e);
      }
    }

    try {
      // Smooth biometric scanning pause
      await new Promise((r) => setTimeout(r, 700));

      const res = await fetch('/api/admin/verify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken,
          faceImage,
          isDemo: isDemo || !faceImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ยืนยันใบหน้าไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ');
      }

      setScanSuccess(true);
      setScanMessage('✅ ตรวจพบใบหน้าฝ่ายฝึกอบรมถูกต้อง! กำลังเข้าสู่ระบบ...');
      sessionStorage.setItem('aia_admin_token', data.sessionToken);
      sessionStorage.setItem('aia_admin_user', JSON.stringify(data.user));
      setToken(data.sessionToken);
      setUserProfile(data.user);
      setPassword('');

      setTimeout(() => {
        stopCamera();
        setAuthStep('authenticated');
        loadData(data.sessionToken);
      }, 900);
    } catch (err) {
      setIsScanning(false);
      setScanMessage(err.message);
      setAuthError(err.message);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': token },
      });
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem('aia_admin_token');
    sessionStorage.removeItem('aia_admin_user');
    setToken('');
    setUserProfile(null);
    setAuthStep('credentials');
    setCourseData(null);
    setNotice('');
    setPassword('');
    stopCamera();
  };

  const handleSaveCourse = async () => {
    if (!courseData) return;
    setSaving(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/course', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          'x-admin-pin': token,
        },
        body: JSON.stringify(courseData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จค่ะ');
      }
      setNotice('✅ บันทึกข้อมูลหลักสูตรเรียบร้อยแล้ว! ระบบ AI อัปเดตข้อมูลทันที');
      onCourseUpdated?.(courseData);
    } catch (err) {
      setNotice(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const startEditFact = (fact) => {
    setIsAdding(false);
    setEditingFactId(fact.id);
    setFactForm({ ...fact });
  };

  const startAddFact = () => {
    setEditingFactId(null);
    setIsAdding(true);
    setFactForm({
      id: `fact_${Date.now().toString(36)}`,
      category: categoryFilter !== 'ทั้งหมด' ? categoryFilter : 'ข้อเน้นย้ำ',
      topic: '',
      value: '',
    });
  };

  const cancelFactForm = () => {
    setEditingFactId(null);
    setIsAdding(false);
    setFactForm({ id: '', category: 'ข้อเน้นย้ำ', topic: '', value: '' });
  };

  const saveFactItem = (e) => {
    e.preventDefault();
    if (!factForm.topic.trim() || !factForm.value.trim()) {
      setNotice('กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วนค่ะ');
      return;
    }
    const cleanId = factForm.id.trim() || `fact_${Date.now().toString(36)}`;

    setCourseData((prev) => {
      if (!prev) return prev;
      let newFacts;
      if (editingFactId) {
        newFacts = prev.facts.map((f) => (f.id === editingFactId ? { ...factForm, id: cleanId } : f));
      } else {
        newFacts = [{ ...factForm, id: cleanId }, ...prev.facts];
      }
      return { ...prev, facts: newFacts };
    });

    cancelFactForm();
    setNotice('💡 รายการได้รับการแก้ไขในแบบร่าง อย่าลืมกด "บันทึกข้อมูลหลักสูตร" ด้านล่างนะคะ');
  };

  const deleteFact = (id) => {
    if (!window.confirm('ต้องการลบข้อมูลรายการนี้ใช่ไหม?')) return;
    setCourseData((prev) => {
      if (!prev) return prev;
      return { ...prev, facts: prev.facts.filter((f) => f.id !== id) };
    });
    setNotice('💡 ลบรายการในแบบร่างแล้ว อย่าลืมกด "บันทึกข้อมูลหลักสูตร" ด้านล่างนะคะ');
  };

  const filteredFacts = (courseData?.facts || []).filter((f) => {
    const matchCategory = categoryFilter === 'ทั้งหมด' || f.category === categoryFilter;
    const matchSearch =
      !search ||
      f.topic.toLowerCase().includes(search.toLowerCase()) ||
      f.value.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <div className="admin-modal">
        {authStep === 'credentials' ? (
          /* Step 1: Username & Password Login Screen */
          <div className="admin-auth-box">
            <div className="admin-auth-icon" aria-hidden="true">
              <Icon.Lock />
            </div>
            <h2 id="admin-title">เข้าสู่ระบบฝ่ายฝึกอบรม (Admin Login)</h2>
            <p className="admin-auth-desc">
              ขั้นตอนที่ 1/2: กรุณากรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานระบบ
            </p>

            <form onSubmit={handleLoginSubmit} className="admin-auth-form">
              <div className="auth-field">
                <label htmlFor="admin-username-input">ชื่อผู้ใช้งาน (Username):</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><Icon.User /></span>
                  <input
                    type="text"
                    id="admin-username-input"
                    placeholder="ชื่อผู้ใช้งาน (เริ่มต้น: admin)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="admin-password-input">รหัสผ่าน (Password):</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><Icon.Lock /></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="admin-password-input"
                    placeholder="รหัสผ่าน (เริ่มต้น: admin1234)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                  </button>
                </div>
              </div>

              {authError && <div className="admin-error">{authError}</div>}

              <div className="admin-pin-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary" disabled={authLoading}>
                  {authLoading ? 'กำลังตรวจสอบ...' : 'ถัดไป: สแกนใบหน้า ➡️'}
                </button>
              </div>
            </form>
          </div>
        ) : authStep === 'face_scan' ? (
          /* Step 2: Biometric Face Scan Verification Screen */
          <div className="admin-auth-box face-scan-box">
            <div className="admin-auth-icon scan-icon" aria-hidden="true">
              <Icon.Scan />
            </div>
            <h2 id="admin-title">สแกนใบหน้าเพื่อยืนยันตัวตน (Face Scan)</h2>
            <p className="admin-auth-desc">
              ขั้นตอนที่ 2/2: กรุณามองตรงที่กล้องเว็บแคมเพื่อตรวจจับโครงหน้าผู้ดูแลระบบ
            </p>

            <div className="scanner-container">
              <div className={`scanner-viewport ${cameraActive ? 'is-active' : ''} ${isScanning ? 'is-scanning' : ''} ${scanSuccess ? 'is-success' : ''}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="scanner-video"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Face Targeting Overlay */}
                <div className="scanner-hud" aria-hidden="true">
                  <div className="scanner-bracket top-left" />
                  <div className="scanner-bracket top-right" />
                  <div className="scanner-bracket bottom-left" />
                  <div className="scanner-bracket bottom-right" />
                  {isScanning && <div className="scanner-laser" />}
                  {scanSuccess && <div className="scanner-check-badge">✓</div>}
                </div>

                {cameraLoading && (
                  <div className="scanner-overlay-msg">กำลังเชื่อมต่อกล้อง...</div>
                )}
                {cameraError && (
                  <div className="scanner-overlay-msg error">{cameraError}</div>
                )}
              </div>

              <div className="scanner-status" role="status">
                <span className={`status-dot ${cameraActive ? 'online' : 'offline'}`} />
                <span>{scanMessage}</span>
              </div>
            </div>

            {authError && <div className="admin-error">{authError}</div>}

            <div className="admin-face-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  stopCamera();
                  setAuthStep('credentials');
                }}
                disabled={isScanning}
              >
                ย้อนกลับ
              </button>

              <button
                type="button"
                className="btn-primary btn-scan-now"
                id="btn-scan-face"
                onClick={() => handleVerifyFace(false)}
                disabled={isScanning || scanSuccess || (!cameraActive && !cameraError)}
              >
                <Icon.Camera />
                <span>{isScanning ? 'กำลังวิเคราะห์...' : scanSuccess ? 'ยืนยันสำเร็จ' : '📸 สแกนใบหน้าเพื่อเข้าสู่ระบบ'}</span>
              </button>
            </div>

            {/* Fallback demo button for environments without camera */}
            <div className="scanner-demo-row">
              <button
                type="button"
                className="btn-demo-scan"
                id="btn-demo-scan"
                onClick={() => handleVerifyFace(true)}
                disabled={isScanning || scanSuccess}
              >
                ✨ ทดสอบผ่านโหมดจำลองสแกนใบหน้า (Demo Biometric Verification)
              </button>
            </div>
          </div>
        ) : (
          /* Main Admin Knowledge Management Dashboard */
          <>
            <header className="admin-header">
              <div className="admin-brand">
                <div className="admin-badge-icon" aria-hidden="true"><Icon.Shield /></div>
                <div>
                  <div className="admin-title-row">
                    <h2 id="admin-title">จัดการข้อมูลหลักสูตร (Admin Knowledge)</h2>
                    <span className="admin-user-pill">
                      <Icon.User />
                      <span>{userProfile?.username || 'admin'} • สแกนใบหน้าแล้ว ✅</span>
                    </span>
                  </div>
                  <p className="admin-sub">วิทยากรและฝ่ายฝึกอบรม • แก้ไขข้อมูลและส่งผลต่อ AI ทันที</p>
                </div>
              </div>
              <button type="button" className="admin-close" onClick={onClose} aria-label="ปิดหน้าต่างแอดมิน">
                <Icon.Close />
              </button>
            </header>

            <nav className="admin-nav">
              <button
                type="button"
                className={`admin-nav-btn ${activeTab === 'facts' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('facts')}
              >
                📚 ข้อเท็จจริงหลักสูตร ({courseData?.facts?.length || 0})
              </button>
              <button
                type="button"
                className={`admin-nav-btn ${activeTab === 'general' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                ⚙️ ข้อมูลทั่วไป & คำปฏิเสธ
              </button>
            </nav>

            <div className="admin-body">
              {notice && <div className="admin-notice" role="alert">{notice}</div>}

              {loading ? (
                <div className="admin-loading">กำลังโหลดข้อมูลหลักสูตร...</div>
              ) : activeTab === 'general' ? (
                /* General Settings Tab */
                <div className="admin-section">
                  <div className="admin-field">
                    <label htmlFor="course-name-input">ชื่อหลักสูตร (Course Name):</label>
                    <input
                      id="course-name-input"
                      type="text"
                      value={courseData?.courseName || ''}
                      onChange={(e) =>
                        setCourseData((prev) => prev ? { ...prev, courseName: e.target.value } : prev)
                      }
                      placeholder="เช่น มาตรฐานพนักงาน (V)"
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="refusal-msg-input">ข้อความตอบปฏิเสธเมื่ออยู่นอกหลักสูตร (Refusal Message):</label>
                    <textarea
                      id="refusal-msg-input"
                      rows={3}
                      value={courseData?.refusalMessage || ''}
                      onChange={(e) =>
                        setCourseData((prev) => prev ? { ...prev, refusalMessage: e.target.value } : prev)
                      }
                      placeholder="ข้อความที่ AI จะใช้ตอบปฏิเสธอย่างสุภาพเมื่อผู้ใช้ถามเรื่องนอกหลักสูตร"
                    />
                  </div>
                </div>
              ) : (
                /* Facts Management Tab */
                <div className="admin-facts-tab">
                  {/* Toolbar */}
                  <div className="admin-toolbar">
                    <div className="admin-filters">
                      {['ทั้งหมด', ...CATEGORY_OPTIONS].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`cat-pill ${categoryFilter === cat ? 'is-active' : ''}`}
                          onClick={() => setCategoryFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="admin-toolbar-right">
                      <input
                        type="text"
                        className="admin-search"
                        placeholder="🔍 ค้นหาหัวข้อ / เนื้อหา..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {!isAdding && !editingFactId && (
                        <button type="button" className="btn-add-fact" onClick={startAddFact}>
                          <Icon.Plus />
                          <span>เพิ่มข้อมูลใหม่</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fact Add / Edit Form */}
                  {(isAdding || editingFactId) && (
                    <form onSubmit={saveFactItem} className="fact-editor-card">
                      <h3>{editingFactId ? '✏️ แก้ไขข้อมูล' : '✨ เพิ่มข้อมูลหลักสูตรใหม่'}</h3>
                      <div className="editor-grid">
                        <div className="admin-field">
                          <label>หมวดหมู่:</label>
                          <select
                            value={factForm.category}
                            onChange={(e) => setFactForm({ ...factForm, category: e.target.value })}
                          >
                            {CATEGORY_OPTIONS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="admin-field">
                          <label>รหัสอ้างอิง (ID):</label>
                          <input
                            type="text"
                            value={factForm.id}
                            onChange={(e) => setFactForm({ ...factForm, id: e.target.value })}
                            placeholder="เช่น checkin_time"
                            required
                          />
                        </div>
                        <div className="admin-field full">
                          <label>หัวข้อ (Topic):</label>
                          <input
                            type="text"
                            value={factForm.topic}
                            onChange={(e) => setFactForm({ ...factForm, topic: e.target.value })}
                            placeholder="เช่น เวลาเช็คอิน, การแต่งกาย, การเปิดกล้อง"
                            required
                          />
                        </div>
                        <div className="admin-field full">
                          <label>เนื้อหา / รายละเอียด (Value):</label>
                          <textarea
                            rows={2}
                            value={factForm.value}
                            onChange={(e) => setFactForm({ ...factForm, value: e.target.value })}
                            placeholder="ระบุข้อเท็จจริงที่ชัดเจน เช่น 08.30 น. หรือ ต้องใส่ชุดพนักงานร้านเซเว่น"
                            required
                          />
                        </div>
                      </div>
                      <div className="editor-actions">
                        <button type="button" className="btn-secondary" onClick={cancelFactForm}>
                          ยกเลิก
                        </button>
                        <button type="submit" className="btn-primary">
                          {editingFactId ? 'อัปเดตรายการนี้' : 'เพิ่มรายการนี้'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Facts Cards List */}
                  <div className="facts-list">
                    {filteredFacts.length === 0 ? (
                      <div className="facts-empty">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>
                    ) : (
                      filteredFacts.map((fact) => (
                        <div key={fact.id} className="fact-item">
                          <div className="fact-header">
                            <span className={`fact-cat-tag cat-${fact.category.replace(/\s+/g, '-')}`}>
                              {fact.category}
                            </span>
                            <span className="fact-id-tag">ID: {fact.id}</span>
                          </div>
                          <div className="fact-topic">{fact.topic}</div>
                          <div className="fact-value">{fact.value}</div>
                          <div className="fact-actions">
                            <button
                              type="button"
                              className="fact-btn edit"
                              onClick={() => startEditFact(fact)}
                              title="แก้ไขรายการนี้"
                            >
                              <Icon.Edit />
                              <span>แก้ไข</span>
                            </button>
                            <button
                              type="button"
                              className="fact-btn delete"
                              onClick={() => deleteFact(fact.id)}
                              title="ลบรายการนี้"
                            >
                              <Icon.Trash />
                              <span>ลบ</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <footer className="admin-footer">
              <button type="button" className="btn-logout" onClick={handleLogout}>
                ออกจากระบบแอดมิน
              </button>
              <div className="admin-footer-right">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  ปิด
                </button>
                <button
                  type="button"
                  className="btn-save-all"
                  onClick={handleSaveCourse}
                  disabled={saving || loading}
                >
                  {saving ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูลหลักสูตร'}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [theme, setTheme] = useState(readStoredTheme);
  const [messages, setMessages] = useState([createInitialGreeting()]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]); // { id, file, url }
  const [loading, setLoading] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [currentCourseName, setCurrentCourseName] = useState('มาตรฐานพนักงาน (V)');
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
    if (messages.length <= 1 && !attachments.length) return;
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
    setMessages([createInitialGreeting()]);
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
            <p className="brand-sub">หลักสูตร {currentCourseName}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            id="admin-btn"
            onClick={() => setIsAdminOpen(true)}
            aria-label="จัดการหลักสูตร (แอดมิน)"
            title="หน้าต่างแอดมินฝ่ายฝึกอบรม (Admin Knowledge Management)"
          >
            <Icon.Shield />
          </button>
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
            disabled={messages.length <= 1 && !attachments.length}
            aria-label="ล้างประวัติสนทนา"
            title="ล้างประวัติสนทนา"
          >
            <Icon.Trash />
          </button>
        </div>
      </header>

      <main className="chat" aria-live="polite">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isSpeaking={speakingId === m.id}
            onToggleSpeak={toggleSpeak}
          />
        ))}

        {messages.length <= 1 && (
          <div className="welcome-chips">
            <p className="welcome-hint">💡 ตัวอย่างคำถามที่สามารถสอบถามได้:</p>
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
          </div>
        )}

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

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onCourseUpdated={(data) => {
          if (data?.courseName) setCurrentCourseName(data.courseName);
        }}
      />
    </div>
  );
}
