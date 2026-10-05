const path = require('path');
const fs = require('fs');

const UPLOAD_ROOT = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const REQUEST_ATTACHMENTS_DIR = path.join(UPLOAD_ROOT, 'request-attachments');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 3;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

function ensureUploadDirs() {
  fs.mkdirSync(REQUEST_ATTACHMENTS_DIR, { recursive: true });
}

module.exports = {
  UPLOAD_ROOT,
  REQUEST_ATTACHMENTS_DIR,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
  ensureUploadDirs,
};
