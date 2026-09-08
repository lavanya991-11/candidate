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
  const position = candidate.positionAppliedFor;
  const attachmentCount = (candidate.attachments || []).length;
  // Worded exactly as the standard acknowledgement, minus the clause itself when
  // the candidate attached nothing - the sentence would otherwise be untrue.
  const attachmentClause = attachmentCount
    ? ', along with the supporting documents submitted with your application'
    : '';
  const lines = signatureLines();

  // One wording rendered two ways: `em` is the identity function for the plain-text
  // part and wraps the company name / position in the highlighted span for the HTML
  // part. Everything around those values is static ASCII, so only they need escaping.
  const bodyParagraphs = (em) => [
    `Thank you for your interest in pursuing a career opportunity with ${em(company)}.`,
    'We are writing to confirm that we have successfully received your application for '
      + `the position of ${em(position)}${attachmentClause}.`,
    'Our Talent Acquisition and Recruitment Team will carefully review your profile against '
      + 'the requirements of the position. If your qualifications and experience match our '
      + 'current requirements, a member of our team will contact you regarding the subsequent '
      + 'stages of the recruitment process.',
    'Please note that the review process may take some time, and we appreciate your patience '
      + 'during this period.',
    `We sincerely appreciate your interest in ${em(company)} and thank you for considering us as `
      + 'a potential employer.',
  ];

  const summaryRows = [
    ['Position Applied', position],
    ['Application Status', 'Application Received'],
    ['Documents Submitted', `${attachmentCount} Attachment(s)`],
  ];

  const text = `Dear ${name},\n\n`
    + `${bodyParagraphs((s) => s).join('\n\n')}\n\n`
    + 'Application Summary\n'
    + summaryRows.map(([label, value]) => `  ${label} : ${value}\n`).join('')
    + `\nBest Regards,\nTalent Acquisition Team\n${company}\n`
    + lines.map((l) => `${l.icon} ${l.value}\n`).join('')
    + '\nThis is an automated email. Please do not reply directly to this message.';

  // Laid out with tables and inline styles only - no external images, no flexbox and
  // no gradients - so it renders the same in Outlook as it does in Gmail.
  const brand = '#1e50c8';
  const highlight = (s) => `<strong style="color: ${brand};">${escapeHtml(s)}</strong>`;
  const careersLink = lines.find((l) => l.value === config.company.website);
  const initial = escapeHtml((company || '?').trim().charAt(0).toUpperCase());

  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #eef2f8; margin: 0; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width: 640px; max-width: 640px; background: #ffffff; border-radius: 14px; overflow: hidden; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">

          <tr>
            <td style="padding: 20px 28px; border-bottom: 1px solid #eef2f8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="38" style="width: 38px;">
                          <div style="width: 38px; height: 38px; border-radius: 9px; background: ${brand}; color: #ffffff; font-size: 18px; font-weight: bold; line-height: 38px; text-align: center;">${initial}</div>
                        </td>
                        <td style="padding-left: 10px;">
                          <div style="font-size: 17px; font-weight: bold; color: #0f2f6b;">${escapeHtml(company)}</div>
                          <div style="font-size: 11px; color: #6b7280; padding-top: 2px;">Technology for a better tomorrow</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="font-size: 13px; font-weight: bold; color: ${brand};">
                    ${careersLink
    ? `<a href="${escapeHtml(careersLink.href)}" style="color: ${brand}; text-decoration: none;">Careers</a>`
    : 'Careers'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background: #e8f0fe; padding: 26px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <div style="font-size: 22px; font-weight: bold; color: #0f2f6b;">Application Acknowledgement</div>
                    <div style="font-size: 13px; color: #3b5175; line-height: 1.6; padding-top: 8px;">
                      Thank you for taking the next step<br />in your career with us!
                    </div>
                  </td>
                  <td align="right" valign="middle" width="120" style="width: 120px;">
                    <div style="width: 96px; background: #ffffff; border: 1px solid #d7e3fb; border-radius: 10px; padding: 12px;">
                      <div style="height: 7px; background: #cfdefa; border-radius: 4px;"></div>
                      <div style="height: 7px; width: 70%; background: #e2eafb; border-radius: 4px; margin-top: 6px;"></div>
                      <div style="height: 7px; width: 45%; background: #e2eafb; border-radius: 4px; margin-top: 6px;"></div>
                      <div style="width: 24px; height: 24px; border-radius: 12px; background: #22a06b; color: #ffffff; font-size: 13px; line-height: 24px; text-align: center; margin-top: 12px;">&#10003;</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 28px 8px; font-size: 14px; line-height: 1.75;">
              <p style="margin: 0 0 16px;">Dear ${escapeHtml(name)},</p>
              ${bodyParagraphs(highlight).map((p) => `<p style="margin: 0 0 16px;">${p}</p>`).join('\n              ')}
            </td>
          </tr>

          <tr>
            <td style="padding: 8px 28px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f3f7fe; border: 1px solid #e2eafb; border-radius: 10px;">
                <tr>
                  <td width="56" valign="top" style="width: 56px; padding: 18px 0 18px 18px;">
                    <div style="width: 30px; height: 30px; border-radius: 15px; background: ${brand}; color: #ffffff; font-size: 15px; line-height: 30px; text-align: center;">&#10003;</div>
                  </td>
                  <td valign="top" style="padding: 18px 18px 18px 0;">
                    <div style="font-size: 14px; font-weight: bold; color: #0f2f6b; padding-bottom: 10px;">Application Summary</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #33415c;">
                      ${summaryRows.map(([label, value]) => `<tr>
                        <td style="padding: 3px 0;">${escapeHtml(label)}</td>
                        <td style="padding: 3px 10px;">:</td>
                        <td style="padding: 3px 0; font-weight: bold; color: #0f2f6b;">${escapeHtml(value)}</td>
                      </tr>`).join('\n                      ')}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 22px 28px 6px; font-size: 14px; line-height: 1.7;">
              <p style="margin: 0;">Best Regards,</p>
              <p style="margin: 0; font-weight: bold; color: ${brand};">Talent Acquisition Team</p>
              <p style="margin: 0; color: #33415c;">${escapeHtml(company)}</p>
            </td>
          </tr>

          ${lines.length ? `<tr>
            <td style="padding: 16px 28px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #eef2f8; border-bottom: 1px solid #eef2f8;">
                <tr>
                  ${lines.map((l) => `<td align="center" style="padding: 14px 6px; font-size: 12px;">
                    <span style="font-size: 13px;">${l.icon}</span>&nbsp;<a href="${escapeHtml(l.href)}" style="color: ${brand}; text-decoration: none;">${escapeHtml(l.value)}</a>
                  </td>`).join('\n                  ')}
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <tr>
            <td style="background: #123163; padding: 18px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle" style="font-size: 12px; color: #ffffff; font-weight: bold; line-height: 1.5;">
                    Build Your Future<br />With Us
                  </td>
                  <td align="right" valign="middle" style="font-size: 11px; color: #b8c8e6; line-height: 1.5; border-left: 1px solid #2b4a80; padding-left: 18px;">
                    This is an automated email. Please do not reply directly<br />to this message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  `;

  try {
    await getTransporter().sendMail({
      from: config.mail.from,
      to: candidate.email,
      subject: `Application Acknowledgement – ${position} Position | ${company}`,
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
