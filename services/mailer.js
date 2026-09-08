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
    { icon: '✉', value: careersEmail, href: `mailto:${careersEmail}` },
    { icon: '\u{1F310}', value: website, href: /^https?:\/\//i.test(website || '') ? website : `https://${website}` },
    { icon: '☎', value: phone, href: `tel:${String(phone || '').replace(/[^+\d]/g, '')}` },
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

  // Built for Outlook's Word rendering engine, which is the strictest client in use:
  //   - every coloured area carries a bgcolor attribute as well as the CSS, because
  //     Word ignores the `background` shorthand and would otherwise drop the fill
  //     (white footer text on an unpainted footer is invisible);
  //   - rules are 1px bgcolor rows, not CSS borders, which Word paints around every
  //     cell in the table rather than along the one edge asked for;
  //   - no empty <div> spacers - Word collapses anything with no content, so shapes
  //     are table cells with a real glyph inside them;
  //   - border-collapse is set everywhere so no stray cell borders appear.
  // border-radius is simply ignored by Word: the corners go square, nothing breaks.
  const brand = '#1e50c8';
  const highlight = (s) => `<strong style="color: ${brand};">${escapeHtml(s)}</strong>`;
  const careersLink = lines.find((l) => l.value === config.company.website);
  const initial = escapeHtml((company || '?').trim().charAt(0).toUpperCase());
  const table = 'cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;"';
  const rule = (color) => `<tr><td height="1" bgcolor="${color}" style="height: 1px; line-height: 1px; font-size: 0;">&nbsp;</td></tr>`;

  const html = `
  <table width="100%" bgcolor="#eef2f8" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse; background-color: #eef2f8;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table width="640" bgcolor="#ffffff" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width: 640px; max-width: 640px; border-collapse: collapse; background-color: #ffffff; border-radius: 14px; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">

          <tr>
            <td style="padding: 20px 28px;">
              <table width="100%" ${table}>
                <tr>
                  <td width="40" valign="middle" style="width: 40px;">
                    <table ${table}>
                      <tr>
                        <td width="40" height="40" align="center" valign="middle" bgcolor="${brand}" style="width: 40px; height: 40px; background-color: ${brand}; border-radius: 9px; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: bold;">${initial}</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding-left: 12px; font-family: Arial, Helvetica, sans-serif;">
                    <div style="font-size: 17px; font-weight: bold; color: #0f2f6b;">${escapeHtml(company)}</div>
                    <div style="font-size: 11px; color: #6b7280; padding-top: 3px;">Technology for a better tomorrow</div>
                  </td>
                  <td align="right" valign="middle" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: bold; color: ${brand};">
                    ${careersLink
    ? `<a href="${escapeHtml(careersLink.href)}" style="color: ${brand}; text-decoration: none;">Careers</a>`
    : 'Careers'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${rule('#e6ecf5')}

          <tr>
            <td bgcolor="#e8f0fe" style="background-color: #e8f0fe; padding: 26px 28px;">
              <table width="100%" ${table}>
                <tr>
                  <td align="left" valign="middle" style="font-family: Arial, Helvetica, sans-serif;">
                    <div style="font-size: 22px; font-weight: bold; color: #0f2f6b;">Application Acknowledgement</div>
                    <div style="font-size: 13px; color: #3b5175; line-height: 1.6; padding-top: 8px;">
                      Thank you for taking the next step in your career with us!
                    </div>
                  </td>
                  <td align="right" valign="middle" width="72" style="width: 72px;">
                    <table ${table}>
                      <tr>
                        <td width="60" height="60" align="center" valign="middle" bgcolor="#ffffff" style="width: 60px; height: 60px; background-color: #ffffff; border-radius: 30px; font-family: Arial, Helvetica, sans-serif; font-size: 26px; color: #22a06b;">&#10003;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 28px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: #1f2937;">
              <p style="margin: 0 0 16px;">Dear ${escapeHtml(name)},</p>
              ${bodyParagraphs(highlight).map((p) => `<p style="margin: 0 0 16px;">${p}</p>`).join('\n              ')}
            </td>
          </tr>

          <tr>
            <td style="padding: 6px 28px 10px;">
              <table width="100%" bgcolor="#f3f7fe" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse; background-color: #f3f7fe; border-radius: 10px;">
                <tr>
                  <td width="60" align="center" valign="top" style="width: 60px; padding: 18px 0 18px 16px;">
                    <table ${table}>
                      <tr>
                        <td width="30" height="30" align="center" valign="middle" bgcolor="${brand}" style="width: 30px; height: 30px; background-color: ${brand}; border-radius: 15px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #ffffff;">&#10003;</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top" style="padding: 18px 18px 18px 4px; font-family: Arial, Helvetica, sans-serif;">
                    <div style="font-size: 14px; font-weight: bold; color: #0f2f6b; padding-bottom: 10px;">Application Summary</div>
                    <table ${table}>
                      ${summaryRows.map(([label, value]) => `<tr>
                        <td width="150" valign="top" style="width: 150px; padding: 3px 0; font-size: 13px; color: #33415c; white-space: nowrap;">${escapeHtml(label)}</td>
                        <td width="16" valign="top" style="width: 16px; padding: 3px 0; font-size: 13px; color: #33415c;">:</td>
                        <td valign="top" style="padding: 3px 0; font-size: 13px; font-weight: bold; color: #0f2f6b;">${escapeHtml(value)}</td>
                      </tr>`).join('\n                      ')}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 28px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
              <div>Best Regards,</div>
              <div style="font-weight: bold; color: ${brand};">Talent Acquisition Team</div>
              <div style="color: #33415c;">${escapeHtml(company)}</div>
            </td>
          </tr>

          ${lines.length ? `${rule('#e6ecf5')}
          <tr>
            <td style="padding: 14px 28px;">
              <table width="100%" ${table}>
                <tr>
                  ${lines.map((l) => `<td width="${Math.floor(100 / lines.length)}%" align="center" valign="middle" style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${brand};">
                    <span style="font-size: 13px; color: #33415c;">${l.icon}</span>&nbsp;<a href="${escapeHtml(l.href)}" style="color: ${brand}; text-decoration: none;">${escapeHtml(l.value)}</a>
                  </td>`).join('\n                  ')}
                </tr>
              </table>
            </td>
          </tr>
          ${rule('#e6ecf5')}` : ''}

          <tr>
            <td bgcolor="#123163" style="background-color: #123163; padding: 18px 28px;">
              <table width="100%" ${table}>
                <tr>
                  <td align="left" valign="middle" width="42%" style="width: 42%; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #ffffff; line-height: 1.5;">
                    Build Your Future<br />With Us
                  </td>
                  <td width="1" bgcolor="#2b4a80" style="width: 1px; background-color: #2b4a80; font-size: 0; line-height: 0;">&nbsp;</td>
                  <td align="right" valign="middle" style="padding-left: 18px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #c3d3ee; line-height: 1.5;">
                    This is an automated email. Please do not reply directly to this message.
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
