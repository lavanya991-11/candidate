import { useState } from 'react';

// Point this at the Express server. In Vite: VITE_API_URL=http://localhost:5000
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';

const EMPTY = {
  candidateName: '',
  email: '',
  phoneNo: '',
  education: '',
  experience: '',
  skills: '',
  positionAppliedFor: '',
  interviewDate: '',
};

const FIELDS = [
  { name: 'candidateName', label: 'Candidate Name', required: true, maxLength: 100 },
  { name: 'email', label: 'Email', required: true, type: 'email', maxLength: 80 },
  { name: 'phoneNo', label: 'Phone Number', required: true, type: 'tel', maxLength: 30 },
  { name: 'positionAppliedFor', label: 'Position Applied For', required: true, maxLength: 100 },
  { name: 'education', label: 'Education', textarea: true, maxLength: 250 },
  { name: 'experience', label: 'Experience', textarea: true, maxLength: 250 },
  { name: 'skills', label: 'Skills', textarea: true, maxLength: 250 },
  { name: 'interviewDate', label: 'Interview Date', type: 'date' },
];

export default function CandidateForm() {
  const [values, setValues] = useState(EMPTY);
  const [status, setStatus] = useState(null); // { kind: 'ok' | 'err', message }
  const [fieldErrors, setFieldErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const update = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setFieldErrors([]);

    try {
      const response = await fetch(`${API_URL}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        // 400 from validation carries `details`; BC/config errors carry only `error`.
        setFieldErrors(Array.isArray(result.details) ? result.details : []);
        setStatus({ kind: 'err', message: result.error || 'Submission failed.' });
        return;
      }

      setValues(EMPTY);
      setStatus({ kind: 'ok', message: result.message || 'Application submitted.' });
    } catch {
      setStatus({ kind: 'err', message: 'Could not reach the server. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1>Candidate Application</h1>

      {FIELDS.map(({ name, label, textarea, ...rest }) => (
        <label key={name} style={{ display: 'block', marginBottom: 12 }}>
          <span>
            {label}
            {rest.required ? ' *' : ''}
          </span>
          <br />
          {textarea ? (
            <textarea name={name} value={values[name]} onChange={update} rows={2} {...rest} />
          ) : (
            <input name={name} value={values[name]} onChange={update} {...rest} />
          )}
        </label>
      ))}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit Application'}
      </button>

      {status && (
        <p style={{ color: status.kind === 'ok' ? 'green' : 'crimson' }} role="status">
          {status.message}
        </p>
      )}

      {fieldErrors.length > 0 && (
        <ul style={{ color: 'crimson' }}>
          {fieldErrors.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
