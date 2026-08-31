const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const bcClient = require('../config/bcClient');

const LOCAL_STORE = path.join(__dirname, '..', 'data', 'candidates.json');

// Form field  ->  Business Central API field
function toBcPayload(candidate) {
  return {
    candidateName: candidate.candidateName,
    email: candidate.email,
    phoneNo: candidate.phoneNo,
    education: candidate.education,
    experience: candidate.experience,
    skills: candidate.skills,
    positionAppliedFor: candidate.positionAppliedFor,
    interviewDate: candidate.interviewDate || null,
  };
}

async function readLocal() {
  try {
    return JSON.parse(await fs.readFile(LOCAL_STORE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeLocal(rows) {
  await fs.mkdir(path.dirname(LOCAL_STORE), { recursive: true });
  await fs.writeFile(LOCAL_STORE, JSON.stringify(rows, null, 2));
}

async function create(candidate) {
  if (config.bc.enabled) {
    return bcClient.request('post', 'candidates', { data: toBcPayload(candidate) });
  }

  const rows = await readLocal();
  const row = {
    id: String(Date.now()),
    entryNo: rows.length + 1,
    ...toBcPayload(candidate),
    applicationDate: new Date().toISOString().slice(0, 10),
  };
  rows.push(row);
  await writeLocal(rows);
  return row;
}

async function list() {
  if (config.bc.enabled) {
    const data = await bcClient.request('get', 'candidates', {
      params: { $orderby: 'entryNo desc', $top: 100 },
    });
    return data.value || [];
  }
  return (await readLocal()).reverse();
}

module.exports = { create, list, toBcPayload };
