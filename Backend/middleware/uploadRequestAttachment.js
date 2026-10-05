const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const {
  REQUEST_ATTACHMENTS_DIR,
  MAX_UPLOAD_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
  ensureUploadDirs,
} = require('../config/uploads');

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, REQUEST_ATTACHMENTS_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`;
    cb(null, unique);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('File type not allowed. Use PDF, PNG, JPG, or DOCX.'));
  }
  cb(null, true);
}

const uploadRequestAttachments = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter,
});

module.exports = { uploadRequestAttachments };
