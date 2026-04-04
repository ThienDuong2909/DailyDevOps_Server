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

async function sendResetPasswordEmail({ email, firstName, resetToken }) {
    if (!isMailerConfigured()) {
        return { skipped: true };
    }

    const resetUrl = `${config.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const recipientName = firstName ? escapeHtml(firstName) : 'there';

    await sendMail({
        to: email,
        subject: 'Reset your DevOps Daily password',
        text: [
            `Hi ${firstName || 'there'},`,
            '',
            'We received a request to reset your DevOps Daily password.',
            `Open this link to choose a new password: ${resetUrl}`,
            '',
            'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#0f172a;">
                <h1 style="font-size:24px;margin-bottom:16px;">Reset your password</h1>
                <p>Hi ${recipientName},</p>
                <p>We received a request to reset your DevOps Daily password.</p>
                <p style="margin:24px 0;">
                    <a href="${resetUrl}" style="background:#0ea5e9;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
                        Reset password
                    </a>
                </p>
                <p>If the button does not work, open this URL:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>If you did not request this, you can ignore this email.</p>
            </div>
        `,
    });

    return {
        skipped: false,
        resetUrl,
    };
}

async function sendVerificationEmail({ email, firstName, verificationToken }) {
    if (!isMailerConfigured()) {
        return { skipped: true };
    }

    const verifyUrl = `${config.appUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const recipientName = firstName ? escapeHtml(firstName) : 'there';

    await sendMail({
        to: email,
        subject: 'Verify your DevOps Daily account',
        text: [
            `Hi ${firstName || 'there'},`,
            '',
            'Welcome to DevOps Daily.',
            `Verify your email by opening this link: ${verifyUrl}`,
            '',
            'If you did not create this account, you can ignore this email.',
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#0f172a;">
                <h1 style="font-size:24px;margin-bottom:16px;">Verify your email</h1>
                <p>Hi ${recipientName},</p>
                <p>Welcome to <strong>DevOps Daily</strong>.</p>
                <p>Please verify your email to activate sign-in for your account.</p>
                <p style="margin:24px 0;">
                    <a href="${verifyUrl}" style="background:#0ea5e9;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
                        Verify email
                    </a>
                </p>
                <p>If the button does not work, open this URL:</p>
                <p><a href="${verifyUrl}">${verifyUrl}</a></p>
                <p>If you did not create this account, you can ignore this email.</p>
            </div>
        `,
    });

    return {
        skipped: false,
        verifyUrl,
    };
}

module.exports = {
    sendResetPasswordEmail,
    sendVerificationEmail,
};
