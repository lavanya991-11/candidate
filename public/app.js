const form = document.getElementById('application-form');
const statusEl = document.getElementById('status');
const errorList = document.getElementById('error-list');
const submitBtn = document.getElementById('submit-btn');

const DRAFT_KEY = 'candidate-form-draft';

// Business Central stores a Country/Region code, not a country name, so the option
// value is the code and only the label is the name. The codes must exist on the
// Countries/Regions page in Business Central or the record is rejected.
const COUNTRIES = [
  ['IN', 'India', '+91'], ['AE', 'United Arab Emirates', '+971'], ['SA', 'Saudi Arabia', '+966'],
  ['QA', 'Qatar', '+974'], ['OM', 'Oman', '+968'], ['KW', 'Kuwait', '+965'],
  ['BH', 'Bahrain', '+973'], ['GB', 'United Kingdom', '+44'], ['US', 'United States', '+1'],
  ['CA', 'Canada', '+1'], ['AU', 'Australia', '+61'], ['NZ', 'New Zealand', '+64'],
  ['SG', 'Singapore', '+65'], ['MY', 'Malaysia', '+60'], ['DE', 'Germany', '+49'],
  ['IE', 'Ireland', '+353'],
];

/* ── row templates for the repeating tables ─────────────────────── */
const ROW_TEMPLATES = {
  'employment-table': (n) => `
    <td class="col-no">${n}</td>
    <td><input name="emp_employerName" maxlength="100" /></td>
    <td><input name="emp_companyName" maxlength="100" /></td>
    <td><input name="emp_position" maxlength="100" /></td>
    <td><input name="emp_department" maxlength="100" /></td>
    <td><input name="emp_fromDate" type="date" /></td>
    <td><input name="emp_tillDate" type="date" /></td>
    <td class="col-act">
      <button type="button" class="row-remove" title="Remove row" aria-label="Remove row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </button>
    </td>`,
  'references-table': (n) => `
    <td class="col-no">${n}</td>
    <td><input name="ref_name" placeholder="Full Name" maxlength="100" /></td>
    <td><input name="ref_email" type="email" placeholder="email@example.com" maxlength="80" /></td>
    <td><input name="ref_phoneNo" type="tel" placeholder="(+00) 0000000000" maxlength="30" /></td>
    <td><input name="ref_notes" placeholder="Notes (Optional)" maxlength="250" /></td>`,
};

function addRow(tableId, values) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  const tr = document.createElement('tr');
  tr.innerHTML = ROW_TEMPLATES[tableId](tbody.children.length + 1);
  tbody.appendChild(tr);

  if (values) {
    tr.querySelectorAll('input').forEach((input) => {
      if (values[input.name] !== undefined) input.value = values[input.name];
    });
  }
  return tr;
}

function renumber(tableId) {
  document.querySelectorAll(`#${tableId} tbody tr`).forEach((tr, i) => {
    tr.querySelector('.col-no').textContent = i + 1;
  });
}

/* ── collect the whole form into the API payload ────────────────── */
function rowsFrom(tableId, prefix, keys) {
  return [...document.querySelectorAll(`#${tableId} tbody tr`)]
    .map((tr) => {
      const row = {};
      keys.forEach((key) => {
        row[key] = (tr.querySelector(`[name="${prefix}_${key}"]`)?.value || '').trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean)); // drop untouched rows
}

function value(name) {
  const el = form.elements[name];
  if (!el) return '';
  if (el instanceof RadioNodeList) return el.value || '';
  if (el.type === 'checkbox') return el.checked;
  return (el.value || '').trim();
}

const joinPhone = (dial, number) => (dial && number ? `(${dial}) ${number}` : number);

function collect() {
  return {
    title: value('title'),
    firstName: value('firstName'),
    middleName: value('middleName'),
    lastName: value('lastName'),
    dateOfBirth: value('dateOfBirth'),
    gender: value('gender'),
    maritalStatus: value('maritalStatus'),
    positionAppliedFor: value('positionAppliedFor'),
    email: value('email'),
    phoneNo: joinPhone(value('phoneCode'), value('phoneNo')),
    currentAddress: {
      line1: value('cur_line1'), line2: value('cur_line2'), city: value('cur_city'),
      state: value('cur_state'), pinCode: value('cur_pin'), country: value('cur_country'),
    },
    permanentAddress: {
      line1: value('per_line1'), line2: value('per_line2'), city: value('per_city'),
      state: value('per_state'), pinCode: value('per_pin'), country: value('per_country'),
    },
    sameAsCurrent: value('sameAsCurrent'),
    qualification: value('qualification'),
    otherQualification: value('otherQualification'),
    englishCertification: value('englishCertification'),
    englishTestDate: value('englishTestDate'),
    employment: rowsFrom('employment-table', 'emp',
      ['employerName', 'companyName', 'position', 'department', 'fromDate', 'tillDate']),
    references: rowsFrom('references-table', 'ref',
      ['name', 'email', 'phoneNo', 'notes']),
  };
}

/* ── permanent address mirrors the current one ──────────────────── */
const ADDRESS_PAIRS = [
  ['cur_line1', 'per_line1'], ['cur_line2', 'per_line2'], ['cur_city', 'per_city'],
  ['cur_state', 'per_state'], ['cur_pin', 'per_pin'], ['cur_country', 'per_country'],
];

function syncPermanentAddress() {
  const same = document.getElementById('sameAsCurrent').checked;
  ADDRESS_PAIRS.forEach(([from, to]) => {
    const target = form.elements[to];
    if (same) target.value = form.elements[from].value;
    target.readOnly = same && target.tagName === 'INPUT';
    target.disabled = same && target.tagName === 'SELECT';
    target.classList.toggle('mirrored', same);
    // Address 2 is the one optional part; the rest have to be filled in by hand
    // as soon as the permanent address is no longer a copy of the current one.
    if (to !== 'per_line2') target.required = !same;
  });
  mirrorInvalidToPermanent();
}

// While the permanent address is a copy of the current one it has no values of its
// own to be missing, so nothing marks it - but it is every bit as mandatory, and
// leaving it plain next to a current address in red reads as though it were optional.
// It shows whatever its twin shows.
function mirrorInvalidToPermanent() {
  if (!document.getElementById('sameAsCurrent').checked) return;
  ADDRESS_PAIRS.forEach(([from, to]) => {
    form.elements[to].classList.toggle('invalid', form.elements[from].classList.contains('invalid'));
  });
}

/* ── draft handling ─────────────────────────────────────────────── */
function restoreDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return false;
  }
  if (!draft) return false;

  const setValue = (name, val) => {
    const el = form.elements[name];
    if (!el || val === undefined || val === null) return;
    if (el instanceof RadioNodeList) el.value = val;
    else if (el.type === 'checkbox') el.checked = Boolean(val);
    else el.value = val;
  };

  ['title', 'firstName', 'middleName', 'lastName', 'dateOfBirth', 'gender', 'maritalStatus',
    'positionAppliedFor', 'email', 'qualification', 'otherQualification',
    'englishCertification',
    'englishTestDate', 'sameAsCurrent'].forEach((k) => setValue(k, draft[k]));

  const savedPhone = String(draft.phoneNo || '');
  const codeEnd = savedPhone.startsWith('(') ? savedPhone.indexOf(')') : -1;
  setValue('phoneCode', codeEnd > 0 ? savedPhone.slice(1, codeEnd) : draft.phoneCode);
  setValue('phoneNo', codeEnd > 0 ? savedPhone.slice(codeEnd + 1).trim() : draft.phoneNo);

  const addr = (prefix, obj = {}) => {
    setValue(`${prefix}_line1`, obj.line1); setValue(`${prefix}_line2`, obj.line2);
    setValue(`${prefix}_city`, obj.city); setValue(`${prefix}_state`, obj.state);
    setValue(`${prefix}_pin`, obj.pinCode); setValue(`${prefix}_country`, obj.country);
  };
  addr('cur', draft.currentAddress);
  addr('per', draft.permanentAddress);

  document.querySelector('#employment-table tbody').innerHTML = '';
  document.querySelector('#references-table tbody').innerHTML = '';
  (draft.employment || []).forEach((r) => addRow('employment-table', {
    emp_employerName: r.employerName, emp_companyName: r.companyName, emp_position: r.position,
    emp_department: r.department, emp_fromDate: r.fromDate, emp_tillDate: r.tillDate,
  }));
  (draft.references || []).forEach((r) => addRow('references-table', {
    ref_name: r.name, ref_email: r.email, ref_phoneNo: r.phoneNo, ref_notes: r.notes,
  }));
  while (document.querySelectorAll('#employment-table tbody tr').length < 3) addRow('employment-table');
  while (document.querySelectorAll('#references-table tbody tr').length < 3) addRow('references-table');

  return true;
}

/* ── status helpers ─────────────────────────────────────────────── */
function setStatus(message, kind) {
  statusEl.textContent = message || '';
  statusEl.className = kind || '';
}

function setErrors(list) {
  errorList.innerHTML = '';
  list.forEach((detail) => {
    const li = document.createElement('li');
    li.textContent = detail;
    errorList.appendChild(li);
  });
}

// Mandatory means four different things here: a plain [required] input, a radio
// group with nothing chosen, an attachment section with no file, and a table with
// no row filled in. The server checks all four again on submission.
function markInvalid() {
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

  const missing = [...form.querySelectorAll('[required]')].filter((el) => !el.value.trim());

  form.querySelectorAll('[data-required-group]').forEach((group) => {
    if (!value(group.dataset.requiredGroup)) missing.push(group);
  });

  form.querySelectorAll('[data-dropzone][data-required]').forEach((zone) => {
    if (!zone.querySelector('input[type="file"]').files.length) missing.push(zone);
  });

  form.querySelectorAll('[data-required-table]').forEach((wrap) => {
    const rows = [...wrap.querySelectorAll('tbody tr')];
    const filled = rows.some((tr) => [...tr.querySelectorAll('input')].some((i) => i.value.trim()));
    if (!filled) missing.push(wrap);
  });

  missing.forEach((el) => el.classList.add('invalid'));
  mirrorInvalidToPermanent();
  return missing;
}

// The highlight is put on at submission, but it comes off as soon as the field it
// belongs to is filled in rather than waiting for the next attempt.
function clearInvalid(event) {
  const el = event.target;
  if (el.matches('input, select, textarea') && (el.value || '').trim()) {
    el.classList.remove('invalid');
  }
  const group = el.closest('[data-required-group]');
  if (group && value(group.dataset.requiredGroup)) group.classList.remove('invalid');
  const zone = el.closest('[data-dropzone]');
  if (zone && el.type === 'file' && el.files.length) zone.classList.remove('invalid');
  mirrorInvalidToPermanent();
}

/* ── wiring ─────────────────────────────────────────────────────── */
form.addEventListener('input', clearInvalid);
form.addEventListener('change', clearInvalid);

document.querySelectorAll('select[data-countries]').forEach((select) => {
  select.innerHTML = '<option value="">Please Select</option>' +
    COUNTRIES.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
});

document.querySelectorAll('select[data-dial-codes]').forEach((select) => {
  select.innerHTML = '<option value="">Code</option>' +
    COUNTRIES.map(([code, name, dial]) => `<option value="${dial}" title="${name}">${dial} (${code})</option>`).join('');
});

// Business Central only accepts "Other Qualification" alongside the Other option.
function syncOtherQualification() {
  const other = value('qualification') === 'Other';
  const input = document.getElementById('otherQualification');
  input.hidden = !other;
  if (!other) input.value = '';
}

form.elements.qualification.forEach((radio) => {
  radio.addEventListener('change', syncOtherQualification);
});

for (let i = 0; i < 3; i += 1) {
  addRow('employment-table');
  addRow('references-table');
}

document.querySelectorAll('[data-add-row]').forEach((btn) => {
  btn.addEventListener('click', () => addRow(btn.dataset.addRow));
});

document.addEventListener('click', (event) => {
  const remove = event.target.closest('.row-remove');
  if (!remove) return;
  const tbody = remove.closest('tbody');
  if (tbody.children.length > 1) {
    remove.closest('tr').remove();
    renumber(tbody.closest('table').id);
  }
});

document.getElementById('sameAsCurrent').addEventListener('change', syncPermanentAddress);
ADDRESS_PAIRS.forEach(([from]) => {
  form.elements[from].addEventListener('input', syncPermanentAddress);
  form.elements[from].addEventListener('change', syncPermanentAddress);
});

/* ── attachments ────────────────────────────────────────────────── */
// Business Central stores these in a Blob and refuses anything else, so the same
// limits are applied here rather than letting a file fail after it has been uploaded.
const MAX_FILE_MB = 10;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const IMAGE_TYPES = ['image/jpeg', 'image/png'];

const allowedTypesFor = (zone) => (
  zone.dataset.attachmentType === 'Photo' ? IMAGE_TYPES : ALLOWED_TYPES
);

const fileProblem = (file, allowed, beforeShrinking = false) => {
  if (!allowed.includes(file.type)) {
    return allowed === IMAGE_TYPES ? 'must be a JPG or PNG' : 'must be a PDF, JPG or PNG';
  }
  // While the file is still the one that was picked, an image that is over the limit
  // is left alone: it is scaled down on submission and only then has to fit.
  const exempt = beforeShrinking && IMAGE_TYPES.includes(file.type);
  if (!exempt && file.size > MAX_FILE_MB * 1024 * 1024) return `is larger than ${MAX_FILE_MB} MB`;
  return '';
};

function attachmentZones() {
  return [...document.querySelectorAll('[data-dropzone]')];
}

function attachmentErrors(prepared) {
  return prepared.flatMap(({ zone, files }) => {
    const allowed = allowedTypesFor(zone);
    return files
      .map((file) => (fileProblem(file, allowed) ? `${file.name} ${fileProblem(file, allowed)}` : ''))
      .filter(Boolean);
  });
}

// Most of the wait on a submission is the files. Each one crosses the wire twice -
// browser to the server, then on to Business Central, where an image travels as
// base64 and is a third larger again. A photo straight off a phone is several
// megabytes of detail that nothing downstream ever shows, so it is scaled down
// before it is sent. PDFs go up untouched, and so does anything already small.
const IMAGE_BUDGET = {
  // The candidate picture is only ever displayed small.
  Photo: { maxEdge: 800, type: 'image/jpeg', quality: 0.85 },
  // A certificate has to stay readable, so it keeps its own format and only the
  // outsized ones are scaled. 2000px is roughly 200 dpi across an A4 page.
  default: { maxEdge: 2000, quality: 0.9 },
};
const SHRINK_ABOVE_BYTES = 512 * 1024;

const canvasBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob(resolve, type, quality);
});

async function shrinkImage(file, attachmentType) {
  if (!IMAGE_TYPES.includes(file.type) || file.size <= SHRINK_ABOVE_BYTES) return file;

  const budget = IMAGE_BUDGET[attachmentType] || IMAGE_BUDGET.default;
  const outType = budget.type || file.type;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, budget.maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await canvasBlob(canvas, outType, budget.quality);
    // Re-encoding is not always a saving: a small PNG can come back larger.
    if (!blob || blob.size >= file.size) return file;

    const dot = file.name.lastIndexOf('.');
    const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
    const name = `${stem}${outType === 'image/png' ? '.png' : '.jpg'}`;
    return new File([blob], name, { type: outType, lastModified: file.lastModified });
  } catch {
    // An image the browser cannot decode is sent as it is rather than lost.
    return file;
  }
}

async function prepareAttachments() {
  const zones = attachmentZones();
  const perZone = await Promise.all(zones.map((zone) => {
    const files = [...(zone.querySelector('input[type="file"]').files || [])];
    return Promise.all(files.map((file) => shrinkImage(file, zone.dataset.attachmentType)));
  }));
  return zones.map((zone, i) => ({ zone, files: perZone[i] }));
}

// Files travel with the application in one multipart request, each under the field
// name of the section it was attached to. The browser sets the boundary itself, so
// the request must not carry a Content-Type of its own.
function buildSubmission(prepared) {
  const data = new FormData();
  data.append('payload', JSON.stringify(collect()));
  prepared.forEach(({ zone, files }) => {
    files.forEach((file) => data.append(zone.dataset.attachmentType, file));
  });
  return data;
}

function clearAttachments() {
  attachmentZones().forEach((zone) => {
    zone.querySelector('input[type="file"]').value = '';
    zone.querySelector('.file-list').innerHTML = '';
    const preview = zone.querySelector('.photo-preview');
    const placeholder = zone.querySelector('.photo-placeholder');
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute('src');
      placeholder.hidden = false;
    }
  });
}

document.querySelectorAll('[data-dropzone]').forEach((zone) => {
  const input = zone.querySelector('input[type="file"]');
  const list = zone.querySelector('.file-list');
  const preview = zone.querySelector('.photo-preview');
  const placeholder = zone.querySelector('.photo-placeholder');
  const allowed = allowedTypesFor(zone);

  const show = (files) => {
    list.innerHTML = '';
    [...files].forEach((file) => {
      const li = document.createElement('li');
      const kb = Math.max(1, Math.round(file.size / 1024));
      const problem = fileProblem(file, allowed, true);
      li.innerHTML = problem
        ? `${file.name} <span class="file-bad">(${problem})</span>`
        : `${file.name} <span>(${kb} KB)</span>`;
      list.appendChild(li);
    });

    if (preview) {
      const [file] = files;
      const showPreview = file && !fileProblem(file, allowed, true);
      if (showPreview) preview.src = URL.createObjectURL(file);
      else preview.removeAttribute('src');
      preview.hidden = !showPreview;
      placeholder.hidden = showPreview;
    }
  };

  zone.querySelector('.btn-browse').addEventListener('click', () => input.click());
  input.addEventListener('change', () => show(input.files));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    input.files = e.dataTransfer.files;
    show(input.files);
  });
});

/* ── sidebar navigation ─────────────────────────────────────────── */
// The highlight follows the section in view, but a click on a step wins until the
// scroll it started has settled. The last section cannot be scrolled all the way to
// the top of the viewport, so position alone would send step 6 back to step 4.
const stepLinks = [...document.querySelectorAll('.step')];
const stepTargets = stepLinks
  .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
  .filter((entry) => entry.section);

function activateStep(link) {
  stepLinks.forEach((other) => other.classList.toggle('is-active', other === link));
}

const sectionTop = (section) => section.getBoundingClientRect().top + window.scrollY;

function stepInView() {
  const atBottom = window.innerHeight + window.scrollY
    >= document.documentElement.scrollHeight - 2;
  if (atBottom) return stepTargets[stepTargets.length - 1].link;

  const marker = window.scrollY + window.innerHeight * 0.25;
  let current = stepTargets[0];
  stepTargets.forEach((entry) => {
    if (sectionTop(entry.section) <= marker) current = entry;
  });
  return current.link;
}

// A smooth scroll reports positions all the way there, so tracking is held off
// until it has arrived rather than following the sections it passes over.
let trackingHeldUntil = 0;

function syncSteps() {
  if (Date.now() < trackingHeldUntil) return;
  activateStep(stepInView());
}

stepTargets.forEach(({ link, section }) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    activateStep(link);
    trackingHeldUntil = Date.now() + 900;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', link.getAttribute('href'));
  });
});

window.addEventListener('scroll', syncSteps, { passive: true });
window.addEventListener('resize', syncSteps);
syncSteps();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  setErrors([]);

  const missing = markInvalid();
  if (missing.length) {
    const [first] = missing;
    if (first.matches('input, select, textarea')) first.focus();
    else first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setStatus('Please complete the required fields marked with *.', 'err');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Preparing your documents…');

  try {
    const prepared = await prepareAttachments();

    const badFiles = attachmentErrors(prepared);
    if (badFiles.length) {
      setErrors(badFiles);
      setStatus('Please remove or replace the files listed below.', 'err');
      return;
    }

    setStatus('Submitting your application…');
    const response = await fetch('/api/candidates', {
      method: 'POST',
      body: buildSubmission(prepared),
    });
    const result = await response.json();

    if (!response.ok) {
      setErrors(Array.isArray(result.details) ? result.details : []);
      setStatus(result.error || 'Submission failed.', 'err');
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    form.reset();
    document.querySelector('#employment-table tbody').innerHTML = '';
    document.querySelector('#references-table tbody').innerHTML = '';
    for (let i = 0; i < 3; i += 1) { addRow('employment-table'); addRow('references-table'); }
    clearAttachments();
    syncPermanentAddress();
    syncOtherQualification();
    setStatus(result.message || 'Application submitted. Thank you!', 'ok');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  } catch {
    setStatus('Could not reach the server. Please try again.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
});

restoreDraft();
syncPermanentAddress();
syncOtherQualification();
