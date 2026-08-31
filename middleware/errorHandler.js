const config = require('../config');

// Business Central and Entra ID return very different error shapes. Translate both
// into one JSON contract the React client can rely on:
//   { error: <safe message>, code: <machine-readable>, details?: [ ... ] }
function describe(err) {
  const status = err.response?.status;

  // Rejected by the CORS origin check in server.js.
  if (/^Origin .* is not allowed$/.test(err.message || '')) {
    return { status: 403, code: 'ORIGIN_NOT_ALLOWED', message: err.message, log: err.message };
  }

  const data = err.response?.data;
  const bcError = data?.error;

  // Entra ID token failures - always a server-side configuration problem.
  if (data?.error_description || (typeof data?.error === 'string' && data.error_code)) {
    return {
      status: 502,
      code: 'BC_AUTH_FAILED',
      message: 'Could not authenticate with Business Central. Check the server configuration.',
      log: data.error_description || data.error,
    };
  }

  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    return {
      status: 502,
      code: 'BC_UNREACHABLE',
      message: 'Business Central could not be reached.',
      log: `${err.code} ${err.hostname || ''}`.trim(),
    };
  }

  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return {
      status: 504,
      code: 'BC_TIMEOUT',
      message: 'Business Central did not respond in time. Please try again.',
      log: err.message,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 502,
      code: 'BC_FORBIDDEN',
      message: 'Business Central rejected the request credentials.',
      log: bcError?.message || err.message,
    };
  }

  if (status === 404) {
    return {
      status: 502,
      code: 'BC_ENDPOINT_NOT_FOUND',
      message: 'The candidate API is not published in Business Central.',
      log: bcError?.message || err.message,
    };
  }

  // 400 from BC is usually a field the record rejected - safe to surface verbatim.
  if (status === 400 || status === 422) {
    return {
      status: 400,
      code: bcError?.code || 'BC_VALIDATION_FAILED',
      message: bcError?.message || 'Business Central rejected the candidate data.',
      log: bcError?.message,
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong while saving the candidate.',
    log: bcError?.message || err.message,
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const info = describe(err);

  // The full detail goes to the server log; the client gets the safe message.
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${info.code}: ${info.log || ''}`);

  const body = { error: info.message, code: info.code };

  // The candidate row was created but a line or the submit action failed afterwards.
  // Saying so stops an applicant from filling the form in again and creating a second
  // draft, and gives recruitment the entry number to finish it off in BC.
  if (err.partialSave) {
    body.code = 'BC_PARTIAL_SAVE';
    body.entryNo = err.partialSave.entryNo;
    body.error = `${info.message} Your application was created in Business Central as entry `
      + `${err.partialSave.entryNo} but is still a draft - please quote that number rather `
      + 'than submitting the form again.';
  }

  if (process.env.NODE_ENV !== 'production' && info.log) {
    body.detail = info.log;
  }

  res.status(info.status).json(body);
}

module.exports = errorHandler;
module.exports.describe = describe;
