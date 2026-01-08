const slugify = require('slugify');
const { getPrismaClient } = require('../../utils/prisma');
const { NotFoundError, ConflictError } = require('../../middlewares/error.middleware');

const prisma = getPrismaClient();

class CategoriesService {
    /**
     * Find all categories
     */
    async findAll() {
        return prisma.category.findMany({
            include: {
                _count: {
                    select: { posts: true },
                },
                parent: {
                    select: { id: true, name: true, slug: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find category by ID
     */
    async findById(id) {
        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                _count: { select: { posts: true } },
                parent: true,
                children: true,
            },
        });

        if (!category) {
            throw new NotFoundError('Category not found');
        }

        return category;
    }

    /**
     * Find category by slug
     */
    async findBySlug(slug) {
        const category = await prisma.category.findUnique({
            where: { slug },
            include: {
                _count: { select: { posts: true } },
            },
        });

        if (!category) {
            throw new NotFoundError('Category not found');
        }

        return category;
    }

    /**
     * Create category
     */
    async create(dto) {
        const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });

        // Check if slug exists
        const existing = await prisma.category.findUnique({ where: { slug } });
        if (existing) {
            throw new ConflictError('Category with this slug already exists');
        }

        return prisma.category.create({
            data: { ...dto, slug },
        });
    }

    /**
     * Update category
     */
    async update(id, dto) {
        await this.findById(id); // Check if exists

        if (dto.name) {
            const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
            dto.slug = slug;
        }

        return prisma.category.update({
            where: { id },
            data: dto,
        });
    }

    /**
     * Delete category
     */
    async delete(id) {
        await this.findById(id); // Check if exists

        await prisma.category.delete({ where: { id } });

        return { message: 'Category deleted successfully' };
    }
}

module.exports = new CategoriesService();
