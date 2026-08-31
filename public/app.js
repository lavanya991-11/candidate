const form = document.getElementById('candidate-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind || '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

  if (!form.checkValidity()) {
    form.querySelectorAll(':invalid').forEach((el) => el.classList.add('invalid'));
    setStatus('Please fill in the required fields correctly.', 'err');
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());

  submitBtn.disabled = true;
  setStatus('Submitting...', '');

  try {
    const response = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      const details = Array.isArray(result.details) ? '\n' + result.details.join('\n') : '';
      setStatus((result.error || 'Submission failed.') + details, 'err');
      return;
    }

    form.reset();
    setStatus('Application submitted. Thank you!', 'ok');
  } catch (err) {
    setStatus('Could not reach the server. Please try again.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
});
