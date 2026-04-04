const { BadRequestError } = require('../../middlewares/error.middleware');
const { sendContactMessageEmail } = require('./contact.mailer');

class ContactService {
    async createMessage(dto) {
        if (dto.website && dto.website.trim()) {
            throw new BadRequestError('Spam submission rejected');
        }

        await sendContactMessageEmail({
            name: dto.name.trim(),
            email: dto.email.trim(),
            subject: dto.subject.trim(),
            message: dto.message.trim(),
        });

        return {
            message: 'Your message has been sent. We will get back to you soon.',
        };
    }
}

module.exports = new ContactService();
