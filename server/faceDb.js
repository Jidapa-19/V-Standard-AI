import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');

/** Creates a stylish default SVG avatar as Data URL */
function createDefaultAvatar(initials, bgColor = '#EAAFC7', textColor = '#4A2438') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="36" fill="${bgColor}"/>
    <circle cx="80" cy="62" r="30" fill="${textColor}" opacity="0.85"/>
    <path d="M30 138 C30 102 55 96 80 96 C105 96 130 102 130 138" fill="${textColor}" opacity="0.85"/>
    <text x="80" y="70" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#FFF" text-anchor="middle">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEFAULT_ADMIN_FACES = [
  {
    id: 'adm_001',
    username: 'admin',
    fullName: 'อาจารย์ฝ่ายฝึกอบรม (Master Instructor)',
    role: 'ผู้ดูแลระบบฝ่ายฝึกอบรม',
    status: 'active',
    registeredAt: '2026-10-23T08:00:00.000Z',
    lastVerifiedAt: '2026-10-23T13:48:35.000Z',
    facePhoto: createDefaultAvatar('ADM', '#EAAFC7', '#4A2438'),
    notes: 'สิทธิ์จัดการหลักสูตรและตรวจสอบพนักงานประจำห้องเรียน',
  },
  {
    id: 'adm_002',
    username: 'instructor_somjai',
    fullName: 'อ.สมใจ ยิ่งเจริญ (วิทยากรอาวุโส)',
    role: 'วิทยากรประจำหลักสูตร',
    status: 'active',
    registeredAt: '2026-10-22T09:30:00.000Z',
    lastVerifiedAt: null,
    facePhoto: createDefaultAvatar('SJ', '#FFD1DC', '#63334D'),
    notes: 'วิทยากรบรรยายภาคทฤษฎี มาตรฐานพนักงาน (V)',
  },
];

const DEFAULT_EMPLOYEE_FACES = [
  {
    id: 'emp_001',
    employeeCode: '7100234',
    fullName: 'นายสมชาย มุ่งมั่น',
    position: 'พนักงานประจำร้าน (Store Assistant)',
    branch: 'สาขาสีลม ซอย 1 (00123)',
    course: 'มาตรฐานพนักงาน (V)',
    status: 'active',
    faceVerified: true,
    registeredAt: '2026-10-23T08:30:00.000Z',
    lastVerifiedAt: '2026-10-23T09:15:00.000Z',
    facePhoto: createDefaultAvatar('สม', '#FFE4EC', '#4A2438'),
    notes: 'ตรวจความพร้อมการแต่งกายและป้ายชื่อเรียบร้อย',
  },
  {
    id: 'emp_002',
    employeeCode: '7100567',
    fullName: 'น.ส.วิภาดา ยิ้มแย้ม',
    position: 'พนักงานบริการลูกค้า (Customer Service)',
    branch: 'สาขาอโศก ทาวเวอร์ (00456)',
    course: 'มาตรฐานพนักงาน (V)',
    status: 'active',
    faceVerified: true,
    registeredAt: '2026-10-23T08:45:00.000Z',
    lastVerifiedAt: '2026-10-23T09:20:00.000Z',
    facePhoto: createDefaultAvatar('วิ', '#F9D5E5', '#4A2438'),
    notes: 'เช็คอินตรงเวลา 08.45 น.',
  },
  {
    id: 'emp_003',
    employeeCode: '7100890',
    fullName: 'นายกิตติศักดิ์ พัฒนา',
    position: 'ผู้ช่วยผู้จัดการร้านฝึกหัด (Assistant Manager Trainee)',
    branch: 'สาขาสยามสแควร์ (00789)',
    course: 'มาตรฐานพนักงาน (V)',
    status: 'active',
    faceVerified: true,
    registeredAt: '2026-10-23T08:50:00.000Z',
    lastVerifiedAt: null,
    facePhoto: createDefaultAvatar('กิต', '#FFCCD9', '#4A2438'),
    notes: 'ลงทะเบียนเรียนรอบบ่าย',
  },
];

export class FaceDatabase {
  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    this.adminFile = path.join(dataDir, 'admin_faces.json');
    this.employeeFile = path.join(dataDir, 'employee_faces.json');
    this.init();
  }

  /** Ensures directories and separate database files exist with seed data */
  init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.adminFile)) {
      this._writeAtomic(this.adminFile, {
        collection: 'admin_faces',
        description: 'ฐานข้อมูลใบหน้าและข้อมูลชีวมิติของผู้ดูแลระบบและวิทยากรฝ่ายฝึกอบรม',
        updatedAt: new Date().toISOString(),
        faces: DEFAULT_ADMIN_FACES,
      });
    }

    if (!fs.existsSync(this.employeeFile)) {
      this._writeAtomic(this.employeeFile, {
        collection: 'employee_faces',
        description: 'ฐานข้อมูลใบหน้าและข้อมูลชีวมิติของพนักงานและผู้เข้าอบรมหลักสูตร',
        updatedAt: new Date().toISOString(),
        faces: DEFAULT_EMPLOYEE_FACES,
      });
    }
  }

  _readJson(filePath, fallbackFaces = []) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.faces)) return data;
      return { faces: fallbackFaces, updatedAt: new Date().toISOString() };
    } catch {
      return { faces: fallbackFaces, updatedAt: new Date().toISOString() };
    }
  }

  _writeAtomic(filePath, data) {
    const tmp = `${filePath}.tmp.${Date.now()}`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, filePath);
  }

  /* ================== ADMIN FACE OPERATIONS ================== */

  getAdminFaces() {
    const data = this._readJson(this.adminFile, DEFAULT_ADMIN_FACES);
    return data.faces;
  }

  getAdminFaceById(id) {
    return this.getAdminFaces().find((f) => f.id === id) || null;
  }

  getAdminFaceByUsername(username) {
    const clean = String(username || '').trim().toLowerCase();
    return this.getAdminFaces().find((f) => String(f.username || '').toLowerCase() === clean) || null;
  }

  saveAdminFace(record) {
    const cleanUsername = String(record.username || '').trim();
    if (!cleanUsername) throw new Error('กรุณาระบุ Username ของผู้ดูแลระบบ');

    const data = this._readJson(this.adminFile, DEFAULT_ADMIN_FACES);
    const existingIndex = data.faces.findIndex(
      (f) => f.id === record.id || String(f.username).toLowerCase() === cleanUsername.toLowerCase()
    );

    const now = new Date().toISOString();
    let saved;

    if (existingIndex >= 0) {
      saved = {
        ...data.faces[existingIndex],
        ...record,
        username: cleanUsername,
        updatedAt: now,
      };
      data.faces[existingIndex] = saved;
    } else {
      saved = {
        id: record.id || `adm_${crypto.randomBytes(4).toString('hex')}`,
        username: cleanUsername,
        fullName: record.fullName || cleanUsername,
        role: record.role || 'ผู้ดูแลระบบฝ่ายฝึกอบรม',
        status: record.status || 'active',
        registeredAt: now,
        lastVerifiedAt: null,
        facePhoto: record.facePhoto || createDefaultAvatar(cleanUsername.slice(0, 2).toUpperCase()),
        notes: record.notes || '',
      };
      data.faces.push(saved);
    }

    data.updatedAt = now;
    this._writeAtomic(this.adminFile, data);
    return saved;
  }

  deleteAdminFace(id) {
    const data = this._readJson(this.adminFile, DEFAULT_ADMIN_FACES);
    const filtered = data.faces.filter((f) => f.id !== id);
    if (filtered.length === data.faces.length) return false;
    data.faces = filtered;
    data.updatedAt = new Date().toISOString();
    this._writeAtomic(this.adminFile, data);
    return true;
  }

  recordAdminVerification(username) {
    const data = this._readJson(this.adminFile, DEFAULT_ADMIN_FACES);
    const target = data.faces.find((f) => String(f.username).toLowerCase() === String(username).toLowerCase());
    if (target) {
      target.lastVerifiedAt = new Date().toISOString();
      data.updatedAt = target.lastVerifiedAt;
      this._writeAtomic(this.adminFile, data);
    }
  }

  /* ================== EMPLOYEE FACE OPERATIONS ================== */

  getEmployeeFaces() {
    const data = this._readJson(this.employeeFile, DEFAULT_EMPLOYEE_FACES);
    return data.faces;
  }

  getEmployeeFaceById(id) {
    return this.getEmployeeFaces().find((f) => f.id === id) || null;
  }

  getEmployeeFaceByCode(code) {
    const clean = String(code || '').trim();
    return this.getEmployeeFaces().find((f) => String(f.employeeCode || '').trim() === clean) || null;
  }

  saveEmployeeFace(record) {
    const cleanCode = String(record.employeeCode || '').trim();
    const cleanName = String(record.fullName || '').trim();
    if (!cleanCode || !cleanName) {
      throw new Error('กรุณาระบุรหัสพนักงานและชื่อ-นามสกุลให้ครบถ้วน');
    }

    const data = this._readJson(this.employeeFile, DEFAULT_EMPLOYEE_FACES);
    const existingIndex = data.faces.findIndex(
      (f) => f.id === record.id || String(f.employeeCode).trim() === cleanCode
    );

    const now = new Date().toISOString();
    let saved;

    if (existingIndex >= 0) {
      saved = {
        ...data.faces[existingIndex],
        ...record,
        employeeCode: cleanCode,
        fullName: cleanName,
        updatedAt: now,
      };
      data.faces[existingIndex] = saved;
    } else {
      saved = {
        id: record.id || `emp_${crypto.randomBytes(4).toString('hex')}`,
        employeeCode: cleanCode,
        fullName: cleanName,
        position: record.position || 'พนักงานประจำร้าน',
        branch: record.branch || 'สาขาหน้าร้าน',
        course: record.course || 'มาตรฐานพนักงาน (V)',
        status: record.status || 'active',
        faceVerified: Boolean(record.faceVerified ?? true),
        registeredAt: now,
        lastVerifiedAt: record.lastVerifiedAt || null,
        facePhoto: record.facePhoto || createDefaultAvatar(cleanName.slice(0, 2)),
        notes: record.notes || '',
      };
      data.faces.push(saved);
    }

    data.updatedAt = now;
    this._writeAtomic(this.employeeFile, data);
    return saved;
  }

  deleteEmployeeFace(id) {
    const data = this._readJson(this.employeeFile, DEFAULT_EMPLOYEE_FACES);
    const filtered = data.faces.filter((f) => f.id !== id);
    if (filtered.length === data.faces.length) return false;
    data.faces = filtered;
    data.updatedAt = new Date().toISOString();
    this._writeAtomic(this.employeeFile, data);
    return true;
  }

  recordEmployeeVerification(idOrCode) {
    const data = this._readJson(this.employeeFile, DEFAULT_EMPLOYEE_FACES);
    const clean = String(idOrCode || '').trim();
    const target = data.faces.find((f) => f.id === clean || String(f.employeeCode).trim() === clean);
    if (target) {
      target.lastVerifiedAt = new Date().toISOString();
      target.faceVerified = true;
      data.updatedAt = target.lastVerifiedAt;
      this._writeAtomic(this.employeeFile, data);
      return target;
    }
    return null;
  }
}
