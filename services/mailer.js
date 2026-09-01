const nodemailer = require('nodemailer');
const config = require('../config');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return transporter;
}

// The candidate's data is already safely saved (in BC or locally) by the time this
// runs, so a bad SMTP config or a delivery failure is only worth logging - it must
// never turn an otherwise-successful submission into an error response.
async function sendApplicationConfirmation(candidate) {
  if (!config.mail.enabled) return false;

  const name = candidate.candidateName
    || [candidate.title, candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
  const docCount = (candidate.attachments || []).length;
  const attachmentLine = docCount
    ? `, together with ${docCount} attached document${docCount === 1 ? '' : 's'},`
    : '';
  const body = `Dear ${name}, thank you for applying for the position of `
    + `${candidate.positionAppliedFor}. We have received your application${attachmentLine} `
    + 'and our recruitment team will review it and contact you regarding the next steps.';

  const bodyHtml = `Dear ${escapeHtml(name)}, thank you for applying for the position of `
    + `${escapeHtml(candidate.positionAppliedFor)}. We have received your application${attachmentLine} `
    + 'and our recruitment team will review it and contact you regarding the next steps.';

  try {
    await getTransporter().sendMail({
      from: config.mail.from,
      to: candidate.email,
      subject: 'We have received your application',
      text: body,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: linear-gradient(100deg, #1e50c8, #3b74ee); color: #fff; border-radius: 10px; padding: 18px 24px;">
            <h1 style="margin: 0; font-size: 18px;">Novasoft</h1>
            <p style="margin: 4px 0 0; font-size: 13px;">Recruitment</p>
          </div>
          <div style="padding: 24px 4px; color: #1f2937; font-size: 14px; line-height: 1.6;">
            <p>${bodyHtml}</p>
            <p style="margin-top: 24px;">Best regards,<br />Recruitment Team</p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.warn('[mail] confirmation email could not be sent:', err.message);
    return false;
  }
}

module.exports = { sendApplicationConfirmation };
