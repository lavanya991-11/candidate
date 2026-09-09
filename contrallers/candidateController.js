const Candidate = require('../models/candidate');
const config = require('../config');
const mailer = require('../services/mailer');

async function createCandidate(req, res, next) {
  try {
    const saved = await Candidate.create(req.candidate);

    // saved.submitted is false when the record reached BC in full but is still a
    // draft, so the applicant is told it arrived without being promised a status
    // that the record does not have.
    const message = config.bc.enabled
      ? `Thank you. Your application has been ${saved.submitted === false ? 'received' : 'submitted'} successfully. `
        + `Please quote reference number ${saved.entryNo} in any future correspondence.`
      : 'Application saved locally (Business Central is not configured).';

    await mailer.sendApplicationConfirmation(req.candidate);

    res.status(201).json({ message, candidate: saved });
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
