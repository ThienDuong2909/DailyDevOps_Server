const tagsRepository = require('./tags.repository');
const { tagDetailInclude, tagListInclude } = require('./tags.queries');
const {
    buildTagSlug,
    ensureTagExists,
    ensureTagSlugAvailable,
} = require('./tags.helpers');

class TagsService {
    /**
     * Find all tags
     */
    async findAll() {
        return tagsRepository.findMany({
            include: tagListInclude,
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find tag by ID
     */
    async findById(id) {
        const tag = await tagsRepository.findUnique({
            where: { id },
            include: tagDetailInclude,
        });
        ensureTagExists(tag);

        return tag;
    }

    /**
     * Create tag
     */
    async create(dto) {
        const slug = buildTagSlug(dto.name, dto.slug);
        const existing = await tagsRepository.findUnique({ where: { slug } });
        ensureTagSlugAvailable(existing);

        return tagsRepository.create({
            data: { ...dto, slug },
        });
    }

    /**
     * Update tag
     */
    async update(id, dto) {
        await this.findById(id);

        if (dto.name) {
            dto.slug = buildTagSlug(dto.name, dto.slug);
        }

        return tagsRepository.update({
            where: { id },
            data: dto,
        });
    }

    /**
     * Delete tag
     */
    async delete(id) {
        await this.findById(id);

        await tagsRepository.delete({ where: { id } });

        return { message: 'Tag deleted successfully' };
    }
}

module.exports = new TagsService();
