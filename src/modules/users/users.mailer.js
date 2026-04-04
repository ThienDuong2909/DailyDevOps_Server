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

async function sendDeleteAccountRequestEmail({ user, reason }) {
    if (!isMailerConfigured()) {
        return { skipped: true };
    }

    const recipient = config.email.contactInbox || config.email.from;
    const safeName = escapeHtml(`${user.firstName} ${user.lastName}`.trim());
    const safeEmail = escapeHtml(user.email);
    const safeRole = escapeHtml(user.role);
    const safeReason = escapeHtml(reason || 'No reason provided').replace(/\n/g, '<br />');

    await sendMail({
        to: recipient,
        replyTo: user.email,
        subject: `[Privacy] Account deletion request for ${user.email}`,
        text: [
            'New account deletion request',
            '',
            `User ID: ${user.id}`,
            `Name: ${user.firstName} ${user.lastName}`,
            `Email: ${user.email}`,
            `Role: ${user.role}`,
            '',
            'Reason:',
            reason || 'No reason provided',
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;line-height:1.6;color:#0f172a;">
                <h1 style="font-size:24px;margin-bottom:16px;">Account deletion request</h1>
                <p><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Role:</strong> ${safeRole}</p>
                <div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    ${safeReason}
                </div>
            </div>
        `,
    });

    return { skipped: false };
}

module.exports = {
    sendDeleteAccountRequestEmail,
};
