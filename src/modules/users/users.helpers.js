const argon2 = require('argon2');

const { ForbiddenError } = require('../../middlewares/error.middleware');

const buildUsersListQuery = (query = {}) => {
    const { page = 1, limit = 10, role, search } = query;

    return {
        page,
        limit,
        skip: (page - 1) * limit,
        where: {
            ...(role && { role }),
            ...(search && {
                OR: [
                    { email: { contains: search } },
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                ],
            }),
        },
    };
};

const buildPaginatedUsersResponse = ({ data, total, page, limit }) => ({
    data,
    meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    },
});

const ensureUserCanUpdate = (targetUserId, currentUserId, currentUserRole) => {
    if (targetUserId !== currentUserId && currentUserRole !== 'ADMIN') {
        throw new ForbiddenError('You can only update your own profile');
    }
};

const ensureRoleCanBeChanged = (dto, currentUserRole) => {
    if (dto.role && currentUserRole !== 'ADMIN') {
        throw new ForbiddenError('Only admin can change user role');
    }
};

const ensureUserCanBeDeleted = (targetUserId, currentUserId, currentUserRole) => {
    if (currentUserRole !== 'ADMIN') {
        throw new ForbiddenError('Only admin can delete users');
    }

    if (targetUserId === currentUserId) {
        throw new ForbiddenError('You cannot delete your own account');
    }
};

const buildUpdateUserData = async (dto) => {
    if (!dto.password) {
        return dto;
    }

    return {
        ...dto,
        password: await argon2.hash(dto.password),
    };
};

module.exports = {
    buildUsersListQuery,
    buildPaginatedUsersResponse,
    ensureUserCanUpdate,
    ensureRoleCanBeChanged,
    ensureUserCanBeDeleted,
    buildUpdateUserData,
};
