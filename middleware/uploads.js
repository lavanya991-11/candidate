const multer = require('multer');

// Mirrors what table 70123 "Candidate Attachment" accepts in Business Central, so a
// file is refused here rather than after it has crossed the wire twice.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Each dropzone posts under its own field name, which is also the Candidate Attachment
// Type enum member the file is filed under in BC.
const FIELDS = ['Education', 'Registration', 'Experience', 'Photo'];

// The candidate photo is one file, unlike the other sections which accept a batch.
const MAX_COUNTS = { Photo: 1 };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter(req, file, cb) {
    if (!ALLOWED[file.mimetype]) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }
    cb(null, true);
  },
});

const acceptAttachments = upload.fields(
  FIELDS.map((name) => ({ name, maxCount: MAX_COUNTS[name] || MAX_FILES })),
);

// The form posts as multipart so the files travel with the application in one request.
// The application itself rides along as a JSON string, which is unpacked here so that
// validateCandidate and everything downstream keep seeing a plain body.
function unpackApplication(req, res, next) {
  if (!req.is('multipart/form-data')) {
    next();
    return;
  }

  try {
    req.body = JSON.parse(req.body.payload || '{}');
  } catch {
    res.status(400).json({
      error: 'The application could not be read.',
      code: 'VALIDATION_FAILED',
      details: ['payload is not valid JSON'],
    });
    return;
  }

  // Flatten the per-dropzone groups into one list, each file tagged with the section
  // it came from so BC files it under the right attachment type.
  req.attachments = FIELDS.flatMap((attachmentType) => (
    (req.files?.[attachmentType] || []).map((file) => ({ ...file, attachmentType }))
  ));

  next();
}

function uploadErrorHandler(err, req, res, next) {
  if (!(err instanceof multer.MulterError)) {
    next(err);
    return;
  }

  const message = {
    LIMIT_FILE_SIZE: 'Each file must be 10 MB or smaller.',
    LIMIT_UNEXPECTED_FILE: 'Only PDF, JPG and PNG files can be attached.',
    LIMIT_FILE_COUNT: `You can attach at most ${MAX_FILES} files.`,
  }[err.code] || 'The attached files could not be read.';

  res.status(400).json({ error: message, code: 'UPLOAD_REJECTED' });
}

module.exports = {
  acceptAttachments, unpackApplication, uploadErrorHandler, FIELDS, MAX_FILE_BYTES,
};
