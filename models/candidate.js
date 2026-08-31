const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const bcClient = require('../config/bcClient');

const LOCAL_STORE = path.join(__dirname, '..', 'data', 'candidates.json');

const clip = (value, max) => (value || '').slice(0, max);

// The form collects more than the original Candidate table holds. Until the extended
// AL objects in bc/ are deployed (BC_EXTENDED_SCHEMA=true), the extra detail is folded
// into the existing text fields so nothing entered on the form is lost.
function summariseEmployment(rows = []) {
  return rows
    .map((r) => {
      const span = [r.fromDate, r.tillDate].filter(Boolean).join(' to ');
      const role = [r.position, r.department].filter(Boolean).join(', ');
      return [r.employerName, role && `(${role})`, span].filter(Boolean).join(' ');
    })
    .join('; ');
}

function summariseReferences(rows = []) {
  return rows
    .map((r) => [r.name, r.email, r.phoneNo].filter(Boolean).join(' / '))
    .join('; ');
}

function formatAddress(address = {}) {
  return [address.line1, address.line2, address.city, address.state, address.pinCode, address.country]
    .filter(Boolean)
    .join(', ');
}

// Field set of the original table 50100 - always sent.
function basePayload(c) {
  return {
    candidateName: clip(c.candidateName, 100),
    email: clip(c.email, 80),
    phoneNo: clip(c.phoneNo, 30),
    education: clip(c.qualification, 250),
    experience: clip(summariseEmployment(c.employment), 250),
    skills: clip(summariseReferences(c.references), 250),
    positionAppliedFor: clip(c.positionAppliedFor, 100),
    interviewDate: c.interviewDate || null,
  };
}

// Extra fields, only valid once the extended AL objects are published. Employment and
// references get their own wide fields here instead of being squeezed into Skills.
function extendedPayload(c) {
  return {
    title: clip(c.title, 10),
    firstName: clip(c.firstName, 50),
    middleName: clip(c.middleName, 50),
    lastName: clip(c.lastName, 50),
    dateOfBirth: c.dateOfBirth || null,
    gender: clip(c.gender, 20),
    maritalStatus: clip(c.maritalStatus, 20),
    currentAddress: clip(formatAddress(c.currentAddress), 250),
    permanentAddress: clip(formatAddress(c.permanentAddress), 250),
    englishCertification: clip(c.englishCertification, 10),
    englishTestDate: c.englishTestDate || null,
    employmentHistory: clip(summariseEmployment(c.employment), 1000),
    referenceList: clip(summariseReferences(c.references), 1000),
  };
}

function toBcPayload(candidate) {
  if (!config.bc.extendedSchema) return basePayload(candidate);

  return {
    ...basePayload(candidate),
    // Skills carries the reference summary only in the fallback mapping.
    skills: '',
    ...extendedPayload(candidate),
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

  // Local mode keeps the full structure - it is not limited by the BC table.
  const rows = await readLocal();
  const row = {
    id: String(Date.now()),
    entryNo: rows.length + 1,
    ...candidate,
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

module.exports = { create, list, toBcPayload, summariseEmployment, summariseReferences, formatAddress };
