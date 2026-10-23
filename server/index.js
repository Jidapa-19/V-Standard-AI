import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import {
  buildResponseSchema,
  buildSystemInstruction,
  buildUserContents,
} from './instructorPrompt.js';
import {
  ALLOWED_MIME,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_MESSAGE_LENGTH,
  detectImageType,
  loadCourse,
  verifyModelResult,
} from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const PLACEHOLDER_KEYS = new Set(['', 'your_api_key_here', 'YOUR_GEMINI_API_KEY']);

export class HttpError extends Error {
  constructor(status, publicMessage, code) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.code = code;
  }
}

/** Creates the Gemini caller. Returns null if no API key is configured. */
export function createGeminiGenerator({ apiKey, model, timeoutMs = 30000 }) {
  const key = (apiKey ?? '').trim();
  if (PLACEHOLDER_KEYS.has(key)) return null;
  const ai = new GoogleGenAI({ apiKey: key });

  return async ({ systemInstruction, contents, responseSchema }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0,
          abortSignal: controller.signal,
        },
      });
      return response.text ?? '';
    } catch (err) {
      if (controller.signal.aborted) {
        const timeoutErr = new Error('Gemini request timed out');
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Maps Gemini SDK errors to safe public errors. Never exposes the raw message. */
function mapGeminiError(err) {
  const status = Number(err?.status ?? err?.code) || 0;
  console.error(`[gemini] error name=${err?.name ?? 'Error'} status=${status || 'n/a'}`);

  if (err?.name === 'TimeoutError') {
    return new HttpError(504, 'AI ใช้เวลาประมวลผลนานเกินไป กรุณาลองใหม่อีกครั้งค่ะ', 'AI_TIMEOUT');
  }
  if (status === 429) {
    return new HttpError(429, 'บริการ AI มีการใช้งานเกินโควตาชั่วคราว กรุณาลองใหม่ในอีกสักครู่ค่ะ', 'AI_RATE_LIMITED');
  }
  const msg = String(err?.message ?? '');
  if (status === 401 || status === 403 || status === 404 || /api key/i.test(msg)) {
    return new HttpError(502, 'การตั้งค่าบริการ AI ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบค่ะ', 'AI_CONFIG_ERROR');
  }
  if (status === 400) {
    return new HttpError(422, 'AI ไม่สามารถประมวลผลคำขอนี้ได้ กรุณาลองใช้ภาพหรือข้อความอื่นค่ะ', 'AI_BAD_REQUEST');
  }
  return new HttpError(503, 'บริการ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ', 'AI_UNAVAILABLE');
}

function parseOrigins(value, port) {
  const list = (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (list.length) return list;
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ];
}

/**
 * @param {object} options
 * @param {Function|null} [options.generate] Gemini caller (injectable for tests)
 * @param {object} [options.course]
 * @param {string[]} [options.allowedOrigins]
 * @param {number} [options.rateLimitMax] requests per minute per IP
 */
export function createApp(options = {}) {
  const port = Number(process.env.PORT || 3001);
  const course = options.course ?? loadCourse(path.join(__dirname, 'course.json'));
  const generate = options.generate ?? null;
  const allowedOrigins = options.allowedOrigins ?? parseOrigins(process.env.ALLOWED_ORIGINS, port);
  const rateLimitMax = options.rateLimitMax ?? (Number(process.env.RATE_LIMIT_PER_MINUTE) || 20);
  const systemInstruction = buildSystemInstruction(course);
  const responseSchema = buildResponseSchema(course);

  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(
    '/api',
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) return cb(null, true);
        return cb(new HttpError(403, 'โดเมนนี้ไม่ได้รับอนุญาตให้เรียกใช้งาน API', 'CORS_FORBIDDEN'));
      },
      methods: ['GET', 'POST'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '10kb' }));

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: 'ส่งคำถามบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ',
        code: 'RATE_LIMITED',
      }),
  });

  // Images stay in memory only and are discarded after the request.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: MAX_FILES,
      fields: 5,
      fieldSize: 16 * 1024,
      parts: MAX_FILES + 5,
    },
    fileFilter(req, file, cb) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new HttpError(415, 'รองรับเฉพาะไฟล์ภาพ JPG, PNG และ WEBP เท่านั้นค่ะ', 'UNSUPPORTED_FILE_TYPE'));
      }
      return cb(null, true);
    },
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', aiConfigured: Boolean(generate), courseName: course.courseName });
  });

  app.post('/api/chat', chatLimiter, upload.array('images', MAX_FILES), async (req, res, next) => {
    const started = Date.now();
    try {
      // Only "message" and "images" are used. Any other field (e.g. a client-sent course) is ignored.
      const rawMessage = typeof req.body?.message === 'string' ? req.body.message : '';
      const message = rawMessage.replace(/\r\n/g, '\n').trim();
      const files = Array.isArray(req.files) ? req.files : [];

      if (message.length > MAX_MESSAGE_LENGTH) {
        throw new HttpError(413, `ข้อความยาวเกิน ${MAX_MESSAGE_LENGTH} ตัวอักษรค่ะ`, 'MESSAGE_TOO_LONG');
      }
      if (!message && files.length === 0) {
        throw new HttpError(400, 'กรุณาพิมพ์คำถามหรือแนบภาพก่อนส่งค่ะ', 'EMPTY_REQUEST');
      }

      const images = files.map((file) => {
        const detected = detectImageType(file.buffer);
        if (!detected || detected !== file.mimetype) {
          throw new HttpError(
            415,
            'ไฟล์ไม่ใช่ภาพที่ถูกต้อง หรือเนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ กรุณาใช้ JPG, PNG หรือ WEBP ค่ะ',
            'INVALID_IMAGE_CONTENT',
          );
        }
        return { mimeType: detected, data: file.buffer.toString('base64') };
      });

      if (!generate) {
        throw new HttpError(503, 'ระบบ AI ยังไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า GEMINI_API_KEY) กรุณาติดต่อผู้ดูแลระบบค่ะ', 'AI_NOT_CONFIGURED');
      }

      let raw;
      try {
        raw = await generate({
          systemInstruction,
          contents: buildUserContents({ message, images }),
          responseSchema,
        });
      } catch (err) {
        throw mapGeminiError(err);
      }

      const result = verifyModelResult(raw, course, { message, hasImages: images.length > 0 });
      // Log metadata only: never message text, image content, or keys.
      console.info(
        `[chat] images=${images.length} refused=${result.refused} reason=${result.reason ?? '-'} ms=${Date.now() - started}`,
      );
      res.json(result);
    } catch (err) {
      next(err);
    } finally {
      if (Array.isArray(req.files)) for (const f of req.files) f.buffer = null;
    }
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'ไม่พบ API ที่ร้องขอ', code: 'NOT_FOUND' });
  });

  // Serve the production frontend build if it exists (single-port mode).
  const clientDist = options.clientDist ?? path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: 'index.html', maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const map = {
        LIMIT_FILE_SIZE: [413, `ไฟล์ภาพต้องมีขนาดไม่เกิน ${MAX_FILE_SIZE / 1024 / 1024} MB ค่ะ`],
        LIMIT_FILE_COUNT: [400, `แนบภาพได้สูงสุด ${MAX_FILES} ภาพค่ะ`],
        LIMIT_UNEXPECTED_FILE: [400, `แนบภาพได้สูงสุด ${MAX_FILES} ภาพ ผ่านช่อง images เท่านั้นค่ะ`],
        LIMIT_FIELD_VALUE: [413, 'ข้อความยาวเกินกำหนดค่ะ'],
      };
      const [status, error] = map[err.code] ?? [400, 'ข้อมูลที่อัปโหลดไม่ถูกต้องค่ะ'];
      return res.status(status).json({ error, code: err.code });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.publicMessage, code: err.code });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไปค่ะ', code: 'PAYLOAD_TOO_LARGE' });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้องค่ะ', code: 'BAD_JSON' });
    }
    console.error(`[error] ${req.method} ${req.path} ${err?.name ?? 'Error'}`);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้งค่ะ', code: 'INTERNAL_ERROR' });
  });

  return app;
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const generate = createGeminiGenerator({
    apiKey: process.env.GEMINI_API_KEY,
    model,
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 30000,
  });
  const app = createApp({ generate });
  app.listen(port, host, () => {
    console.info(`AI Instructor Assistant API: http://${host}:${port}`);
    console.info(`Gemini model: ${model} | AI configured: ${Boolean(generate)}`);
  });
}
