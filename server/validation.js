import fs from 'node:fs';

export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per image
export const MAX_FILES = 3;
export const MAX_MESSAGE_LENGTH = 1000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Detects the real image type from file content (magic bytes). */
export function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

/** Loads and validates course.json from the server file system. */
export function loadCourse(filePath) {
  const course = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return validateCourseData(course);
}

/** Validates course data structure and returns deep-frozen object. */
export function validateCourseData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('ข้อมูลหลักสูตรต้องเป็น Object ค่ะ');
  }
  if (typeof data.courseName !== 'string' || !data.courseName.trim()) {
    throw new Error('กรุณาระบุชื่อหลักสูตร (courseName) ค่ะ');
  }
  if (typeof data.refusalMessage !== 'string' || !data.refusalMessage.trim()) {
    throw new Error('กรุณาระบุข้อความปฏิเสธ (refusalMessage) ค่ะ');
  }
  if (!Array.isArray(data.facts) || data.facts.length === 0) {
    throw new Error('รายการข้อมูลหลักสูตร (facts) ต้องไม่ว่างเปล่าค่ะ');
  }
  const cleanFacts = [];
  const ids = new Set();
  for (const f of data.facts) {
    if (!f || typeof f !== 'object') throw new Error('ข้อมูลแต่ละรายการต้องเป็น Object ค่ะ');
    const id = String(f.id || '').trim();
    const topic = String(f.topic || '').trim();
    const value = String(f.value || '').trim();
    const category = String(f.category || 'ข้อมูลทั่วไป').trim();

    if (!id || !topic || !value) {
      throw new Error('ข้อมูลแต่ละรายการต้องมี id, หัวข้อ (topic) และเนื้อหา (value) ให้ครบถ้วนค่ะ');
    }
    if (ids.has(id)) {
      throw new Error(`รหัสข้อมูล (id) ซ้ำกัน: "${id}"`);
    }
    ids.add(id);
    cleanFacts.push({ id, category, topic, value });
  }

  return deepFreeze({
    courseName: data.courseName.trim(),
    refusalMessage: data.refusalMessage.trim(),
    facts: cleanFacts,
  });
}

/** Validates and atomically saves course data to file system. */
export function saveCourse(filePath, courseData) {
  const validated = validateCourseData(courseData);
  fs.writeFileSync(filePath, JSON.stringify(validated, null, 2), 'utf8');
  return validated;
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

export function toArabicDigits(text) {
  return text.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

/** Extracts numeric tokens ("08.30" -> {"8","30"}), ignoring list markers like "1. ". */
export function extractNumbers(text) {
  const cleaned = toArabicDigits(String(text ?? '')).replace(/^\s*\d+[.)]\s+/gm, '');
  return new Set((cleaned.match(/\d+/g) ?? []).map((n) => String(Number(n))));
}

/** Ensures the answer ends with "ค่ะ". */
export function ensurePoliteEnding(text) {
  let t = text.trim();
  if (/ค่ะ[.!]?$/.test(t)) return t;
  // Keep periods: Thai abbreviations such as "น." end with one.
  t = t.replace(/(ครับ|คะ)[.!]?$/, '').replace(/[\s!]+$/, '');
  return `${t} ค่ะ`;
}

/**
 * Verifies the model's structured output against course.json.
 * Any failure returns the exact refusal message from course.json.
 */
export function verifyModelResult(raw, course, { message, hasImages }) {
  const refuse = (reason) => ({
    answer: course.refusalMessage,
    refused: true,
    reason,
    sources: [],
  });

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return refuse('invalid_model_output');
  }
  if (!data || typeof data !== 'object') return refuse('invalid_model_output');

  if (hasImages && data.imageReadable !== true) return refuse('image_unreadable');
  if (data.answerable !== true) return refuse('not_in_course');

  const factMap = new Map(course.facts.map((f) => [f.id, f]));
  const citedIds = Array.isArray(data.citedFactIds)
    ? [...new Set(data.citedFactIds.filter((id) => typeof id === 'string' && factMap.has(id)))]
    : [];
  if (citedIds.length === 0) return refuse('no_supporting_fact');

  const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
  if (!answer || answer.length > 1500) return refuse('empty_answer');
  if (answer.includes(course.refusalMessage)) return refuse('model_refused');
  if (!/[\u0E00-\u0E7F]/.test(answer)) return refuse('not_thai');

  // Every number in the answer must come from a cited fact, the user's question,
  // or text read from the attached image. This blocks invented dates/times.
  const citedText = citedIds.map((id) => `${factMap.get(id).topic} ${factMap.get(id).value}`).join(' ');
  const allowedNumbers = new Set([
    ...extractNumbers(citedText),
    ...extractNumbers(message),
    ...(hasImages ? extractNumbers(data.imageText) : []),
  ]);
  for (const n of extractNumbers(answer)) {
    if (!allowedNumbers.has(n)) return refuse('unsupported_number');
  }

  return {
    answer: ensurePoliteEnding(answer),
    refused: false,
    reason: null,
    sources: citedIds.map((id) => {
      const f = factMap.get(id);
      return { id: f.id, category: f.category, topic: f.topic, value: f.value };
    }),
  };
}
