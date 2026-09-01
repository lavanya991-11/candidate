const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const bcClient = require('../config/bcClient');

const LOCAL_STORE = path.join(__dirname, '..', 'data', 'candidates.json');

const clip = (value, max) => (value || '').slice(0, max);

// Over OData an enum is sent as the AL member NAME, not its caption, so the form
// values are translated here. Anything not in a map is left unset rather than
// guessed - Business Central rejects a value that is not a member of the enum.
const ENUMS = {
  salutation: {
    'Mr.': 'Mr', 'Mrs.': 'Mrs', 'Ms.': 'Ms', Miss: 'Miss', 'Dr.': 'Dr',
  },
  gender: { Male: 'Male', Female: 'Female', Other: 'Other' },
  maritalStatus: {
    Single: 'Single',
    Married: 'Married',
    'Single Mother': 'Single Mother',
    Separated: 'Separated',
    Divorced: 'Divorced',
    'Widow / Widower': 'Widow or Widower',
  },
  qualification: {
    Diploma: 'Diploma', Graduate: 'Graduate', 'Post Graduate': 'Post Graduate', Other: 'Other',
  },
  englishCertification: { None: 'None', IELTS: 'IELTS', OET: 'OET' },
};

// Field names and lengths follow page 70142 "Candidate API" / table 70120 "Candidate".
// Two rules drive the shape of this payload:
//   * Derived and read-only fields are never sent. "Candidate Name" is rebuilt by the
//     table from the name parts, and posting it fails with "Control 'candidateName'
//     is read-only" whenever the table marks it as such.
//   * Properties are emitted in page order, because the validation triggers depend on
//     it: the same-as-current flag must land before the permanent address, the
//     qualification before its "other" text, and the certification before its date.
function candidatePayload(c) {
  const payload = {};
  const set = (key, value) => {
    if (value !== undefined && value !== null && value !== '') payload[key] = value;
  };

  // Personal information
  set('salutation', ENUMS.salutation[c.title]);
  set('firstName', clip(c.firstName, 50));
  set('middleName', clip(c.middleName, 50));
  set('lastName', clip(c.lastName, 50));
  set('dateOfBirth', c.dateOfBirth);
  set('gender', ENUMS.gender[c.gender]);
  set('maritalStatus', ENUMS.maritalStatus[c.maritalStatus]);

  // Contact information
  set('email', clip(c.email, 80));
  set('phoneNo', clip(c.phoneNo, 30));

  // Current address
  const current = c.currentAddress || {};
  set('address', clip(current.line1, 100));
  set('address2', clip(current.line2, 100));
  set('city', clip(current.city, 50));
  set('state', clip(current.state, 50));
  set('postCode', clip(current.pinCode, 20).toUpperCase());
  set('countryRegionCode', clip(current.country, 10).toUpperCase());

  // Permanent address. "Same as Current Address" has InitValue = true and the table
  // raises an error on any permanent field while it is set, so the flag is always
  // sent (before the fields) and the fields only follow when it is off.
  payload.sameAsCurrentAddress = Boolean(c.sameAsCurrent);
  if (!c.sameAsCurrent) {
    const permanent = c.permanentAddress || {};
    set('permanentAddress', clip(permanent.line1, 100));
    set('permanentAddress2', clip(permanent.line2, 100));
    set('permanentCity', clip(permanent.city, 50));
    set('permanentState', clip(permanent.state, 50));
    set('permanentPostCode', clip(permanent.pinCode, 20).toUpperCase());
    set('permanentCountryRegionCode', clip(permanent.country, 10).toUpperCase());
  }

  // Educational qualification - "Other Qualification" is only accepted alongside Other.
  const qualification = ENUMS.qualification[c.qualification];
  set('qualification', qualification);
  if (qualification === 'Other') set('otherQualification', clip(c.otherQualification, 100));

  // English language certification - a test date without a certification is rejected.
  const certification = ENUMS.englishCertification[c.englishCertification] || 'None';
  payload.englishCertification = certification;
  if (certification !== 'None') set('mostRecentTestDate', c.englishTestDate);

  // The references section states that supplying references is the consent.
  payload.referenceCheckConsent = (c.references || []).length > 0;
  set('positionAppliedFor', clip(c.positionAppliedFor, 100));

  return payload;
}

function employmentPayload(row) {
  const line = {
    employerName: clip(row.employerName, 100),
    position: clip(row.position, 100),
    department: clip(row.department, 100),
  };
  if (row.fromDate) line.fromDate = row.fromDate;
  if (row.tillDate) line.tillDate = row.tillDate;
  return line;
}

function referencePayload(row) {
  return {
    referenceName: clip(row.name, 100),
    email: clip(row.email, 80),
    phoneNo: clip(row.phoneNo, 30),
    notes: clip(row.notes, 250),
  };
}

// The sub-entities cannot travel in the parent payload: both are page parts linked on
// the AutoIncrement "Entry No.", so the candidate has to exist before its lines do.
// "Candidate Entry No." is not sent either - the SubPageLink fills it in, and the
// field is read-only on both line tables. They are posted one at a time on purpose,
// because each table numbers a new row from the last one it finds.
async function postLines(candidateId, candidate) {
  for (const row of candidate.employment || []) {
    await bcClient.request('post', `candidates(${candidateId})/employmentHistory`, {
      data: employmentPayload(row),
    });
  }
  for (const row of candidate.references || []) {
    await bcClient.request('post', `candidates(${candidateId})/candidateReferences`, {
      data: referencePayload(row),
    });
  }
}

// The Candidate Attachment Type enum in BC only has Other/Education/Registration/
// Experience - there is no Photo member - so the candidate's photo is filed under
// Other, the closest fit, rather than BC rejecting the whole submission outright.
const ATTACHMENT_TYPE_TO_BC = { Photo: 'Other' };

// Each attached file is two calls: the line carries the name and the section it came
// from, then the bytes go to the stream property the Blob is published as. The table
// validates the file name, so an unsupported extension is refused by BC as well.
async function postAttachments(entryNo, files = []) {
  for (const file of files) {
    const line = await bcClient.request('post', 'candidateAttachments', {
      data: {
        candidateEntryNo: entryNo,
        attachmentType: ATTACHMENT_TYPE_TO_BC[file.attachmentType] || file.attachmentType,
        fileName: clip(file.originalname, 250),
      },
    });
    await bcClient.putStream(
      `candidateAttachments(${line.id})/attachmentContent`,
      file.buffer,
      file.mimetype,
    );
  }
}

// Once everything is in place the bound action moves the application out of Draft.
// It re-checks the mandatory fields server side, so this is also the point where a
// gap between the form's rules and the table's rules would surface.
async function submitApplication(candidateId) {
  await bcClient.request('post', `candidates(${candidateId})/Microsoft.NAV.submit`, { data: {} });
}

async function createInBc(candidate) {
  const created = await bcClient.request('post', 'candidates', { data: candidatePayload(candidate) });
  const { id } = created;

  // The candidate row already exists from here on. If a line or a file fails, say so
  // plainly instead of letting it read as "nothing was saved" - the application is in
  // Business Central as a draft and can be completed there.
  try {
    await postLines(id, candidate);
    await postAttachments(created.entryNo, candidate.attachments);
  } catch (err) {
    err.partialSave = { id, entryNo: created.entryNo };
    throw err;
  }

  let submitted = true;
  try {
    await submitApplication(id);
  } catch (err) {
    // The bound action only exists once the API page carries a ServiceEnabled submit
    // procedure. Where it is missing the application still arrived in full and simply
    // stays a draft, which recruitment can submit in BC - not worth losing over.
    if (err.response?.status !== 404) {
      err.partialSave = { id, entryNo: created.entryNo };
      throw err;
    }
    submitted = false;
    console.warn('[bc] candidates/Microsoft.NAV.submit is not published - entry '
      + `${created.entryNo} was left as a draft.`);
  }

  return { ...await bcClient.request('get', `candidates(${id})`), submitted };
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
  if (config.bc.enabled) return createInBc(candidate);

  // Local mode keeps the full structure - it is not limited by the BC table. Files are
  // recorded by name only: the JSON store is a stand-in for BC, not a file store.
  const rows = await readLocal();
  const row = {
    id: String(Date.now()),
    entryNo: rows.length + 1,
    ...candidate,
    attachments: (candidate.attachments || []).map((f) => ({
      attachmentType: f.attachmentType, fileName: f.originalname, size: f.size,
    })),
    applicationStatus: 'Submitted',
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

module.exports = {
  create, list, candidatePayload, employmentPayload, referencePayload, ENUMS,
};
