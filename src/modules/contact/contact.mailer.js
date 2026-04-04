const config = require('../../config');
const { isMailerConfigured, sendMail } = require('../../common/email/mailer');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function sendContactMessageEmail({ name, email, subject, message }) {
    if (!isMailerConfigured()) {
        return { skipped: true };
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
    const recipient = config.email.contactInbox || config.email.from;

    await sendMail({
        to: recipient,
        replyTo: email,
        subject: `[Contact] ${subject}`,
        text: [
            `Name: ${name}`,
            `Email: ${email}`,
            `Subject: ${subject}`,
            '',
            message,
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;line-height:1.6;color:#0f172a;">
                <h1 style="font-size:24px;margin-bottom:16px;">New contact message</h1>
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Subject:</strong> ${safeSubject}</p>
                <div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    ${safeMessage}
                </div>
            </div>
        `,
    });

    return { skipped: false };
}

module.exports = {
    sendContactMessageEmail,
};
