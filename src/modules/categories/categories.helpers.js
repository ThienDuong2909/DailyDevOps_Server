const slugify = require('slugify');

const { ConflictError, NotFoundError } = require('../../middlewares/error.middleware');

const buildCategorySlug = (name, slug) => slug || slugify(name, { lower: true, strict: true });

const ensureCategoryExists = (category) => {
    if (!category) {
        throw new NotFoundError('Category not found');
    }
};

const ensureCategorySlugAvailable = (existing) => {
    if (existing) {
        throw new ConflictError('Category with this slug already exists');
    }
};

module.exports = {
    buildCategorySlug,
    ensureCategoryExists,
    ensureCategorySlugAvailable,
};
