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
    companyName: clip(row.companyName, 100),
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
// Experience - there is no Photo member - so a photo that has to travel as an
// attachment is filed under Other, the closest fit. That is only the fallback now:
// the photo's real home is the Candidate Picture, written by postPicture().
const ATTACHMENT_TYPE_TO_BC = { Photo: 'Other' };

// "Candidate Picture" is a Media field, published on the API page as a read-only
// GUID, so there is no stream to write bytes to. The setPictureBase64 action is the
// way in. BC re-encodes the image on import, and rejects anything that is not valid
// Base64 with its own error.
async function postPicture(candidateId, photo) {
  if (!photo) return false;
  try {
    await bcClient.request('post', `candidates(${candidateId})/Microsoft.NAV.setPictureBase64`, {
      data: { pictureBase64: photo.buffer.toString('base64') },
    });
    return true;
  } catch (err) {
    // Same reasoning as the submit action below: where the extension predates the
    // action the application still arrived in full, and the photo is filed as an
    // attachment instead of being lost.
    if (err.response?.status !== 404) throw err;
    console.warn('[bc] candidates/Microsoft.NAV.setPictureBase64 is not published - '
      + 'the photo was filed as an attachment instead.');
    return false;
  }
}

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

// Everything after the candidate row is another dozen round trips to Business
// Central, and none of it changes the reference number the applicant is given. It
// runs behind the response rather than in front of it, so the form comes back as
// soon as the record exists and is numbered.
//
// Nothing in here may throw. There is no request left to report a failure to, and an
// unhandled rejection would take the process down with it. A failure leaves the
// application in BC as a draft, which is the same state the missing-submit-action
// fallback has always produced, and recruitment can finish it there.
async function finishInBc(created, candidate) {
  const { id, entryNo } = created;
  const reason = (err) => err.response?.data?.error?.message || err.message;

  try {
    await postLines(id, candidate);

    // Once the photo is on the Candidate Picture there is no reason to keep a second
    // copy of it in the attachment list, so it only stays there if the action is gone.
    const photo = (candidate.attachments || []).find((f) => f.attachmentType === 'Photo');
    const onPicture = await postPicture(id, photo);
    await postAttachments(
      entryNo,
      onPicture ? candidate.attachments.filter((f) => f !== photo) : candidate.attachments,
    );
  } catch (err) {
    console.error(`[bc] entry ${entryNo} was created but could not be completed: ${reason(err)}. `
      + 'It is a draft in Business Central, and the applicant has already been told the '
      + 'application was received.');
    return;
  }

  try {
    await submitApplication(id);
  } catch (err) {
    // The bound action only exists once the API page carries a ServiceEnabled submit
    // procedure. Where it is missing the application still arrived in full and simply
    // stays a draft, which recruitment can submit in BC - not worth losing over.
    console.warn(`[bc] entry ${entryNo} was left as a draft: `
      + (err.response?.status === 404
        ? 'candidates/Microsoft.NAV.submit is not published.'
        : reason(err)));
  }
}

async function createInBc(candidate) {
  const created = await bcClient.request('post', 'candidates', { data: candidatePayload(candidate) });

  // The entry number is on the row the moment it is created, so the applicant is
  // answered from here and does not wait for the rest of the work.
  finishInBc(created, candidate)
    .catch((err) => console.error('[bc] completing an application failed:', err.message));

  // The row exists and is numbered but is still a draft at this point, so the
  // controller words the message as "received" rather than "submitted".
  return { ...created, submitted: false };
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
