const categoriesRepository = require('./categories.repository');
const {
    categoryDetailInclude,
    categoryListInclude,
    categorySlugInclude,
} = require('./categories.queries');
const {
    buildCategorySlug,
    ensureCategoryExists,
    ensureCategorySlugAvailable,
} = require('./categories.helpers');

class CategoriesService {
    /**
     * Find all categories
     */
    async findAll() {
        return categoriesRepository.findMany({
            include: categoryListInclude,
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find category by ID
     */
    async findById(id) {
        const category = await categoriesRepository.findUnique({
            where: { id },
            include: categoryDetailInclude,
        });
        ensureCategoryExists(category);

        return category;
    }

    /**
     * Find category by slug
     */
    async findBySlug(slug) {
        const category = await categoriesRepository.findUnique({
            where: { slug },
            include: categorySlugInclude,
        });
        ensureCategoryExists(category);

        return category;
    }

    /**
     * Create category
     */
    async create(dto) {
        const slug = buildCategorySlug(dto.name, dto.slug);
        const existing = await categoriesRepository.findUnique({ where: { slug } });
        ensureCategorySlugAvailable(existing);

        return categoriesRepository.create({
            data: { ...dto, slug },
        });
    }

    /**
     * Update category
     */
    async update(id, dto) {
        await this.findById(id);

        if (dto.name) {
            dto.slug = buildCategorySlug(dto.name, dto.slug);
        }

        return categoriesRepository.update({
            where: { id },
            data: dto,
        });
    }

    /**
     * Delete category
     */
    async delete(id) {
        await this.findById(id);

        await categoriesRepository.delete({ where: { id } });

        return { message: 'Category deleted successfully' };
    }
}

module.exports = new CategoriesService();
