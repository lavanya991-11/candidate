const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts the "(+91) 1234567890" shape the form asks for: allowed punctuation plus
// 7-15 actual digits, which covers international numbers without being fussy.
const PHONE_CHARS = /^[0-9\s()+-]+$/;
const isPhone = (v) => PHONE_CHARS.test(v) && /^\d{7,15}$/.test(v.replace(/\D/g, ''));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

const MAX = {
  title: 10, firstName: 50, middleName: 50, lastName: 50,
  gender: 20, maritalStatus: 20, positionAppliedFor: 100,
  email: 80, phoneNo: 30, qualification: 20,
  otherQualification: 100, englishCertification: 10,
};

// The country field carries a Country/Region code (Code[10] in Business Central),
// not a country name, so it is shorter than the other address parts.
const ADDRESS_MAX = { line1: 100, line2: 100, city: 50, state: 50, pinCode: 20, country: 10 };

function cleanAddress(raw = {}, label, errors) {
  const address = {};
  for (const [field, max] of Object.entries(ADDRESS_MAX)) {
    const value = str(raw[field]);
    if (value.length > max) errors.push(`${label} ${field} must be ${max} characters or fewer`);
    address[field] = value;
  }
  return address;
}

// Every part of an address is mandatory except line 2, which is genuinely optional
// for addresses that have no apartment or street name.
const REQUIRED_ADDRESS = [
  ['line1', 'line 1'], ['city', 'city'], ['state', 'state'],
  ['pinCode', 'PIN / post code'], ['country', 'country'],
];

function checkAddress(address, label, errors) {
  for (const [field, name] of REQUIRED_ADDRESS) {
    if (!address[field]) errors.push(`${label} ${name} is required`);
  }
}

function cleanDate(raw, label, errors) {
  const value = str(raw);
  if (value && !DATE_RE.test(value)) {
    errors.push(`${label} must be in YYYY-MM-DD format`);
    return '';
  }
  return value;
}

function cleanEmployment(rows, errors) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 20).map((row, i) => {
    const n = i + 1;
    const entry = {
      employerName: str(row.employerName).slice(0, 100),
      position: str(row.position).slice(0, 100),
      department: str(row.department).slice(0, 100),
      fromDate: cleanDate(row.fromDate, `Employment row ${n} From Date`, errors),
      tillDate: cleanDate(row.tillDate, `Employment row ${n} Till Date`, errors),
    };
    if (entry.fromDate && entry.tillDate && entry.fromDate > entry.tillDate) {
      errors.push(`Employment row ${n}: From Date is after Till Date`);
    }
    if (!entry.employerName && (entry.position || entry.department || entry.fromDate)) {
      errors.push(`Employment row ${n}: employer name is required when the row is filled in`);
    }
    return entry;
  }).filter((entry) => Object.values(entry).some(Boolean));
}

function cleanReferences(rows, errors) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 20).map((row, i) => {
    const n = i + 1;
    const entry = {
      name: str(row.name).slice(0, 100),
      email: str(row.email).slice(0, 80),
      phoneNo: str(row.phoneNo).slice(0, 30),
      notes: str(row.notes).slice(0, 250),
    };
    if (entry.email && !EMAIL_RE.test(entry.email)) {
      errors.push(`Reference row ${n}: email is not a valid address`);
    }
    if (!entry.name && (entry.email || entry.phoneNo)) {
      errors.push(`Reference row ${n}: reference name is required when the row is filled in`);
    }
    return entry;
  }).filter((entry) => Object.values(entry).some(Boolean));
}

function validateCandidate(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const candidate = {};

  for (const [field, max] of Object.entries(MAX)) {
    const value = str(body[field]);
    if (value.length > max) errors.push(`${field} must be ${max} characters or fewer`);
    candidate[field] = value;
  }

  if (!candidate.firstName) errors.push('First name is required');
  if (!candidate.lastName) errors.push('Last name is required');
  if (!candidate.gender) errors.push('Gender is required');
  if (!candidate.positionAppliedFor) errors.push('Position applied for is required');

  if (!candidate.email) errors.push('Email address is required');
  else if (!EMAIL_RE.test(candidate.email)) errors.push('Email address is not valid');

  if (!candidate.phoneNo) errors.push('Primary mobile number is required');
  else if (!isPhone(candidate.phoneNo)) errors.push('Primary mobile number is not valid');

  candidate.dateOfBirth = cleanDate(body.dateOfBirth, 'Date of birth', errors);
  candidate.englishTestDate = cleanDate(body.englishTestDate, 'Most recent test date', errors);

  if (candidate.dateOfBirth && candidate.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    errors.push('Date of birth cannot be in the future');
  }

  candidate.sameAsCurrent = Boolean(body.sameAsCurrent);
  candidate.currentAddress = cleanAddress(body.currentAddress, 'Current address', errors);
  candidate.permanentAddress = candidate.sameAsCurrent
    ? { ...candidate.currentAddress }
    : cleanAddress(body.permanentAddress, 'Permanent address', errors);

  // Business Central runs these same checks in Candidate.CheckMandatoryFields() when
  // the application is submitted. Catching them here keeps a submission from creating
  // a record in BC that then fails halfway through and is left sitting as a draft.
  if (!candidate.dateOfBirth) errors.push('Date of birth is required');
  checkAddress(candidate.currentAddress, 'Current address', errors);
  // A mirrored permanent address is already known to be complete, so it is only
  // worth checking when the candidate has entered a different one.
  if (!candidate.sameAsCurrent) {
    checkAddress(candidate.permanentAddress, 'Permanent address', errors);
  }
  if (!candidate.qualification) errors.push('Educational qualification is required');

  // Two conditional rules the table enforces with its own errors.
  if (candidate.otherQualification && candidate.qualification !== 'Other') {
    errors.push('Another qualification can only be given when qualification is Other');
  }
  if (candidate.englishTestDate && candidate.englishCertification !== 'IELTS'
      && candidate.englishCertification !== 'OET') {
    errors.push('A most recent test date can only be given when IELTS or OET was attempted');
  }

  candidate.employment = cleanEmployment(body.employment, errors);
  candidate.references = cleanReferences(body.references, errors);

  // Attached files were parsed out of the multipart body before validation. Only the
  // graduation certificates are mandatory; the photo, the registration certificates
  // and the experience certificates are all optional.
  candidate.attachments = req.attachments || [];
  const attached = (type) => candidate.attachments.some((f) => f.attachmentType === type);
  if (!attached('Education')) {
    errors.push('At least one graduation certificate or mark sheet is required');
  }

  // Assembled once here so every downstream consumer sees the same name.
  candidate.candidateName = [
    candidate.title, candidate.firstName, candidate.middleName, candidate.lastName,
  ].filter(Boolean).join(' ').slice(0, 100);

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_FAILED', details: errors });
  }

  req.candidate = candidate;
  next();
}

module.exports = validateCandidate;
