const slugify = require('slugify');
const { getPrismaClient } = require('../../utils/prisma');
const { NotFoundError, ConflictError } = require('../../middlewares/error.middleware');

const prisma = getPrismaClient();

class TagsService {
    /**
     * Find all tags
     */
    async findAll() {
        return prisma.tag.findMany({
            include: {
                _count: {
                    select: { posts: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find tag by ID
     */
    async findById(id) {
        const tag = await prisma.tag.findUnique({
            where: { id },
            include: {
                _count: { select: { posts: true } },
            },
        });

        if (!tag) {
            throw new NotFoundError('Tag not found');
        }

        return tag;
    }

    /**
     * Create tag
     */
    async create(dto) {
        const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });

        // Check if slug exists
        const existing = await prisma.tag.findUnique({ where: { slug } });
        if (existing) {
            throw new ConflictError('Tag with this slug already exists');
        }

        return prisma.tag.create({
            data: { ...dto, slug },
        });
    }

    /**
     * Update tag
     */
    async update(id, dto) {
        await this.findById(id);

        if (dto.name) {
            const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
            dto.slug = slug;
        }

        return prisma.tag.update({
            where: { id },
            data: dto,
        });
    }

    /**
     * Delete tag
     */
    async delete(id) {
        await this.findById(id);

        await prisma.tag.delete({ where: { id } });

        return { message: 'Tag deleted successfully' };
    }
}

module.exports = new TagsService();
