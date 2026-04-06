const config = require('../../config');
const { parse } = require('node-html-parser');
const { isMailerConfigured, sendMail } = require('../../common/email/mailer');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function sendSubscriptionConfirmationEmail({ email, name, confirmationToken }) {
    if (!isMailerConfigured()) {
        return { skipped: true };
    }

    const confirmationUrl = `${config.appUrl.replace(/\/$/, '')}/newsletter/confirm?token=${encodeURIComponent(confirmationToken)}`;
    const recipientName = name ? escapeHtml(name) : 'there';

    await sendMail({
        to: email,
        subject: 'Confirm your DevOps Daily newsletter subscription',
        text: [
            `Hi ${name || 'there'},`,
            '',
            'Thanks for subscribing to DevOps Daily.',
            `Please confirm your subscription by opening this link: ${confirmationUrl}`,
            '',
            'If you did not request this subscription, you can ignore this email.',
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#0f172a;">
                <h1 style="font-size:24px;margin-bottom:16px;">Confirm your subscription</h1>
                <p>Hi ${recipientName},</p>
                <p>Thanks for subscribing to <strong>DevOps Daily</strong>.</p>
                <p>Please confirm your subscription to start receiving weekly DevOps updates.</p>
                <p style="margin:24px 0;">
                    <a href="${confirmationUrl}" style="background:#0ea5e9;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
                        Confirm subscription
                    </a>
                </p>
                <p>If the button does not work, open this URL:</p>
                <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
                <p>If you did not request this subscription, you can ignore this email.</p>
            </div>
        `,
    });

    return {
        skipped: false,
        confirmationUrl,
    };
}

function stripHtml(value) {
    return parse(String(value || ''))
        .textContent
        .replace(/\s+/g, ' ')
        .trim();
}

async function sendPostPublishedEmail({ subscriber, post }) {
    if (!isMailerConfigured()) {
        return { skipped: true };
    }

    const postUrl = `${config.appUrl.replace(/\/$/, '')}/blog/${encodeURIComponent(post.slug)}`;
    const unsubscribeUrl = `${config.appUrl.replace(/\/$/, '')}/api/v1/subscribers/unsubscribe/${encodeURIComponent(subscriber.unsubscribeToken)}`;
    const recipientName = subscriber.name ? escapeHtml(subscriber.name) : 'there';
    const postTitle = escapeHtml(post.title);
    const excerpt = escapeHtml(stripHtml(post.excerpt || post.subtitle || post.contentHtml || post.content || post.title).slice(0, 220));

    await sendMail({
        to: subscriber.email,
        subject: `New on DevOps Daily: ${post.title}`,
        text: [
            `Hi ${subscriber.name || 'there'},`,
            '',
            `A new post is live on DevOps Daily: ${post.title}`,
            excerpt,
            '',
            `Read it here: ${postUrl}`,
            '',
            `Unsubscribe: ${unsubscribeUrl}`,
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6;color:#0f172a;">
                <p style="font-size:14px;color:#475569;">Hi ${recipientName},</p>
                <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px;">${postTitle}</h1>
                <p style="font-size:15px;color:#334155;">${excerpt}</p>
                <p style="margin:24px 0;">
                    <a href="${postUrl}" style="background:#0ea5e9;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
                        Read the post
                    </a>
                </p>
                <p style="font-size:13px;color:#64748b;">
                    You are receiving this email because you subscribed to DevOps Daily updates.
                </p>
                <p style="font-size:13px;color:#64748b;">
                    <a href="${unsubscribeUrl}" style="color:#64748b;">Unsubscribe</a>
                </p>
            </div>
        `,
    });

    return {
        skipped: false,
        postUrl,
    };
}

module.exports = {
    sendSubscriptionConfirmationEmail,
    sendPostPublishedEmail,
};
