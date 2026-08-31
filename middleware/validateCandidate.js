const MAX = {
  candidateName: 100,
  email: 80,
  phoneNo: 30,
  education: 250,
  experience: 250,
  skills: 250,
  positionAppliedFor: 100,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9][0-9\s()-]{6,}$/;

function validateCandidate(req, res, next) {
  const body = req.body || {};
  const candidate = {};
  const errors = [];

  for (const [field, max] of Object.entries(MAX)) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (value.length > max) {
      errors.push(`${field} must be ${max} characters or fewer`);
    }
    candidate[field] = value;
  }

  if (!candidate.candidateName) errors.push('candidateName is required');
  if (!candidate.email) errors.push('email is required');
  else if (!EMAIL_RE.test(candidate.email)) errors.push('email is not a valid address');
  if (!candidate.phoneNo) errors.push('phoneNo is required');
  else if (!PHONE_RE.test(candidate.phoneNo)) errors.push('phoneNo is not a valid phone number');
  if (!candidate.positionAppliedFor) errors.push('positionAppliedFor is required');

  const interviewDate = typeof body.interviewDate === 'string' ? body.interviewDate.trim() : '';
  if (interviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(interviewDate)) {
    errors.push('interviewDate must be in YYYY-MM-DD format');
  }
  candidate.interviewDate = interviewDate;

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  req.candidate = candidate;
  next();
}

module.exports = validateCandidate;
