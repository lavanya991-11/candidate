const Candidate = require('../models/candidate');
const config = require('../config');

async function createCandidate(req, res, next) {
  try {
    const saved = await Candidate.create(req.candidate);
    res.status(201).json({
      message: config.bc.enabled
        ? 'Candidate saved to Business Central.'
        : 'Candidate saved locally (Business Central is not configured).',
      candidate: saved,
    });
  } catch (err) {
    next(err);
  }
}

async function listCandidates(req, res, next) {
  try {
    res.json({ value: await Candidate.list() });
  } catch (err) {
    next(err);
  }
}

module.exports = { createCandidate, listCandidates };
