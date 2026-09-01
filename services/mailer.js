const nodemailer = require('nodemailer');
const config = require('../config');

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
async function sendApplicationConfirmation(candidate, saved) {
  if (!config.mail.enabled) return false;

  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
  const reference = saved?.entryNo ? ` Your reference number is ${saved.entryNo}.` : '';

  try {
    await getTransporter().sendMail({
      from: config.mail.from,
      to: candidate.email,
      subject: "We've received your application",
      text: `Hi ${name},\n\n`
        + `Thank you for applying for the ${candidate.positionAppliedFor} position. `
        + `We've received your application along with any attachments you provided.${reference}\n\n`
        + "Our recruitment team will be in touch if your profile matches the role.\n\n"
        + 'Best regards,\nRecruitment Team',
    });
    return true;
  } catch (err) {
    console.warn('[mail] confirmation email could not be sent:', err.message);
    return false;
  }
}

module.exports = { sendApplicationConfirmation };
