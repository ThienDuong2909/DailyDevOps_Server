const slugify = require('slugify');

const { ConflictError, NotFoundError } = require('../../middlewares/error.middleware');

const buildTagSlug = (name, slug) => slug || slugify(name, { lower: true, strict: true });

const ensureTagExists = (tag) => {
    if (!tag) {
        throw new NotFoundError('Tag not found');
    }
};

const ensureTagSlugAvailable = (existing) => {
    if (existing) {
        throw new ConflictError('Tag with this slug already exists');
    }
};

module.exports = {
    buildTagSlug,
    ensureTagExists,
    ensureTagSlugAvailable,
};
