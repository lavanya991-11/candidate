const form = document.getElementById('application-form');
const statusEl = document.getElementById('status');
const errorList = document.getElementById('error-list');
const submitBtn = document.getElementById('submit-btn');

const DRAFT_KEY = 'candidate-form-draft';

const COUNTRIES = [
  'India', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Bahrain',
  'United Kingdom', 'United States', 'Canada', 'Australia', 'New Zealand', 'Singapore',
  'Malaysia', 'Germany', 'Ireland', 'Other',
];

/* ── row templates for the repeating tables ─────────────────────── */
const ROW_TEMPLATES = {
  'employment-table': (n) => `
    <td class="col-no">${n}</td>
    <td><input name="emp_employerName" maxlength="100" /></td>
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
    phoneNo: value('phoneNo'),
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
    englishCertification: value('englishCertification'),
    englishTestDate: value('englishTestDate'),
    employment: rowsFrom('employment-table', 'emp',
      ['employerName', 'position', 'department', 'fromDate', 'tillDate']),
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
    target.style.background = same ? '#f7f9fc' : '';
  });
}

/* ── draft handling ─────────────────────────────────────────────── */
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collect()));
    return true;
  } catch {
    return false;
  }
}

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
    'positionAppliedFor', 'email', 'phoneNo', 'qualification', 'englishCertification',
    'englishTestDate', 'sameAsCurrent'].forEach((k) => setValue(k, draft[k]));

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
    emp_employerName: r.employerName, emp_position: r.position, emp_department: r.department,
    emp_fromDate: r.fromDate, emp_tillDate: r.tillDate,
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

function markInvalid() {
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  const missing = [...form.querySelectorAll('[required]')].filter((el) => !el.value.trim());
  missing.forEach((el) => el.classList.add('invalid'));
  return missing;
}

/* ── wiring ─────────────────────────────────────────────────────── */
document.querySelectorAll('select[data-countries]').forEach((select) => {
  select.innerHTML = '<option value="">Please Select</option>' +
    COUNTRIES.map((c) => `<option>${c}</option>`).join('');
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

// File pickers: selection is shown, but nothing is uploaded yet - see README.
document.querySelectorAll('[data-dropzone]').forEach((zone) => {
  const input = zone.querySelector('input[type="file"]');
  const list = zone.querySelector('.file-list');

  const show = (files) => {
    list.innerHTML = '';
    [...files].forEach((file) => {
      const li = document.createElement('li');
      const kb = Math.max(1, Math.round(file.size / 1024));
      li.innerHTML = `${file.name} <span>(${kb} KB — not uploaded yet)</span>`;
      list.appendChild(li);
    });
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

document.getElementById('save-draft').addEventListener('click', () => {
  setErrors([]);
  setStatus(
    saveDraft()
      ? 'Draft saved in this browser. Reopen this page on this device to continue.'
      : 'Could not save the draft in this browser.',
    saveDraft() ? 'ok' : 'err'
  );
});

// Sidebar highlight follows the section in view.
const sections = [...document.querySelectorAll('.card[id], .actions[id]')];
const stepLinks = [...document.querySelectorAll('.step')];
const observer = new IntersectionObserver((entries) => {
  entries.filter((e) => e.isIntersecting).forEach((entry) => {
    stepLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
    });
  });
}, { rootMargin: '-20% 0px -70% 0px' });
sections.forEach((section) => observer.observe(section));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  setErrors([]);

  const missing = markInvalid();
  if (missing.length) {
    missing[0].focus();
    setStatus('Please complete the required fields marked with *.', 'err');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Submitting your application…');

  try {
    const response = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collect()),
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
    syncPermanentAddress();
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
