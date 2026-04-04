const express = require('express');
const asyncHandler = require('express-async-handler');
const { validate } = require('../../middlewares/validation.middleware');
const { sendCreated } = require('../../common/http/responses');
const contactService = require('./contact.service');
const { createContactMessageSchema } = require('./contact.validation');

const router = express.Router();

router.post(
    '/',
    validate(createContactMessageSchema),
    asyncHandler(async (req, res) => {
        const result = await contactService.createMessage(req.body);
        return sendCreated(res, {
            message: result.message,
        });
    })
);

module.exports = router;
