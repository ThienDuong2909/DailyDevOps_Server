const authProfileSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatar: true,
    bio: true,
    role: true,
    isActive: true,
    mfaEnabled: true,
    emailVerifiedAt: true,
    lastLoginAt: true,
    createdAt: true,
};

module.exports = {
    authProfileSelect,
};
