const {
    commentIdParamSchema,
    createCommentSchema,
    postCommentsParamSchema,
    updateCommentStatusSchema,
} = require('../comments.validation');

describe('Comments Validation', () => {
    describe('postCommentsParamSchema', () => {
        it('accepts a valid post id', () => {
            const { error } = postCommentsParamSchema.validate({ postId: 'post-1' });
            expect(error).toBeUndefined();
        });

        it('rejects missing post id', () => {
            const { error } = postCommentsParamSchema.validate({});
            expect(error).toBeDefined();
        });
    });

    describe('createCommentSchema', () => {
        it('accepts a valid guest comment payload', () => {
            const { error } = createCommentSchema.validate({
                content: 'Nice article',
                postId: 'post-1',
                authorName: 'Guest User',
                authorEmail: 'guest@example.com',
            });

            expect(error).toBeUndefined();
        });

        it('accepts a valid reply payload', () => {
            const { error } = createCommentSchema.validate({
                content: 'Reply content',
                postId: 'post-1',
                parentId: 'comment-1',
            });

            expect(error).toBeUndefined();
        });

        it('rejects missing content', () => {
            const { error } = createCommentSchema.validate({
                postId: 'post-1',
            });

            expect(error).toBeDefined();
        });

        it('rejects invalid author email', () => {
            const { error } = createCommentSchema.validate({
                content: 'Nice article',
                postId: 'post-1',
                authorEmail: 'not-an-email',
            });

            expect(error).toBeDefined();
        });
    });

    describe('updateCommentStatusSchema', () => {
        it('accepts a valid moderation status', () => {
            const { error } = updateCommentStatusSchema.validate({ status: 'APPROVED' });
            expect(error).toBeUndefined();
        });

        it('rejects an invalid moderation status', () => {
            const { error } = updateCommentStatusSchema.validate({ status: 'VISIBLE' });
            expect(error).toBeDefined();
        });
    });

    describe('commentIdParamSchema', () => {
        it('accepts a valid comment id', () => {
            const { error } = commentIdParamSchema.validate({ id: 'comment-1' });
            expect(error).toBeUndefined();
        });

        it('rejects missing comment id', () => {
            const { error } = commentIdParamSchema.validate({});
            expect(error).toBeDefined();
        });
    });
});
