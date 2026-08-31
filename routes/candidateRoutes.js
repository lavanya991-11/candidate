const express = require('express');
const validateCandidate = require('../middleware/validateCandidate');
const controller = require('../contrallers/candidateController');

const router = express.Router();

router.post('/candidates', validateCandidate, controller.createCandidate);
router.get('/candidates', controller.listCandidates);

module.exports = router;
