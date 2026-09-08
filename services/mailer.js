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

// The signature block only lists the channels that are actually configured, so an
// unset phone number leaves the line out rather than printing an empty label.
function signatureLines() {
  const { name, careersEmail, website, phone } = config.company;
  return [
    { icon: '\u{1F4E7}', value: careersEmail, href: `mailto:${careersEmail}` },
    { icon: '\u{1F310}', value: website, href: /^https?:\/\//i.test(website || '') ? website : `https://${website}` },
    { icon: '\u{1F4DE}', value: phone, href: `tel:${String(phone || '').replace(/[^+\d]/g, '')}` },
  ].filter((line) => line.value).map((line) => ({ ...line, company: name }));
}

// The candidate's data is already safely saved (in BC or locally) by the time this
// runs, so a bad SMTP config or a delivery failure is only worth logging - it must
// never turn an otherwise-successful submission into an error response.
async function sendApplicationConfirmation(candidate) {
  if (!config.mail.enabled) return false;

  const company = config.company.name;
  const name = candidate.candidateName
    || [candidate.title, candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
  // Worded exactly as the standard acknowledgement, minus the clause itself when
  // the candidate attached nothing - the sentence would otherwise be untrue.
  const attachmentClause = (candidate.attachments || []).length
    ? ', along with the supporting documents submitted with your application'
    : '';
  const position = candidate.positionAppliedFor;
  const lines = signatureLines();

  const paragraphs = [
    `Thank you for your interest in pursuing a career opportunity with ${company}.`,
    'We are writing to confirm that we have successfully received your application for '
      + `the position of ${position}${attachmentClause}.`,
    'Our Talent Acquisition and Recruitment Team will carefully review your profile against '
      + 'the requirements of the position. If your qualifications and experience match our '
      + 'current requirements, a member of our team will contact you regarding the subsequent '
      + 'stages of the recruitment process.',
    'Please note that the review process may take some time, and we appreciate your patience '
      + 'during this period.',
    `We sincerely appreciate your interest in ${company} and thank you for considering us as `
      + 'a potential employer.',
  ];

  const text = `Dear ${name},\n\n`
    + `${paragraphs.join('\n\n')}\n\n`
    + `Best Regards,\nTalent Acquisition Team\n${company}\n`
    + lines.map((l) => `${l.icon} ${l.value}\n`).join('')
    + '\nThis is an automated email. Please do not reply directly to this message.';

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto;">
      <div style="background: linear-gradient(100deg, #1e50c8, #3b74ee); color: #fff; border-radius: 10px; padding: 18px 24px;">
        <h1 style="margin: 0; font-size: 18px;">${escapeHtml(company)}</h1>
        <p style="margin: 4px 0 0; font-size: 13px;">Talent Acquisition</p>
      </div>
      <div style="padding: 24px 4px; color: #1f2937; font-size: 14px; line-height: 1.7;">
        <p>Dear ${escapeHtml(name)},</p>
        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n        ')}
        <p style="margin-top: 28px;">Best Regards,<br />Talent Acquisition Team<br /><strong>${escapeHtml(company)}</strong></p>
        <p style="margin: 12px 0 0; font-size: 13px;">
          ${lines.map((l) => `${l.icon} <a href="${escapeHtml(l.href)}" style="color: #1e50c8; text-decoration: none;">${escapeHtml(l.value)}</a>`).join('<br />\n          ')}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px;" />
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          This is an automated email. Please do not reply directly to this message.
        </p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: config.mail.from,
      to: candidate.email,
      subject: `Application Acknowledgement \u2013 ${position} Position | ${company}`,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.warn('[mail] confirmation email could not be sent:', err.message);
    return false;
  }
}

module.exports = { sendApplicationConfirmation };
