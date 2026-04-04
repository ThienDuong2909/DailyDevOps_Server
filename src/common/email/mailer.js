const nodemailer = require('nodemailer');
const config = require('../../config');

let transporter;

function isMailerConfigured() {
    return Boolean(
        config.email.smtpHost &&
            config.email.smtpPort &&
            config.email.smtpUser &&
            config.email.smtpPass
    );
}

function getTransporter() {
    if (!isMailerConfigured()) {
        return null;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.email.smtpHost,
            port: config.email.smtpPort,
            secure: config.email.secure,
            auth: {
                user: config.email.smtpUser,
                pass: config.email.smtpPass,
            },
        });
    }

    return transporter;
}

async function verifyMailer() {
    const activeTransporter = getTransporter();

    if (!activeTransporter) {
        return false;
    }

    await activeTransporter.verify();
    return true;
}

async function sendMail(options) {
    const activeTransporter = getTransporter();

    if (!activeTransporter) {
        throw new Error('SMTP mailer is not configured');
    }

    return activeTransporter.sendMail({
        from: config.email.from,
        ...options,
    });
}

module.exports = {
    isMailerConfigured,
    verifyMailer,
    sendMail,
};
