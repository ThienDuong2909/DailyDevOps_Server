const {
    detectCommentModeration,
    ensureCommentReplyDepth,
    ensureGuestIdentity,
} = require('../comments.helpers');

describe('comments helpers moderation', () => {
    it('marks guest comments as pending', () => {
        const result = detectCommentModeration({
            content: 'Great article, thanks for sharing.',
            isAuthenticated: false,
        });

        expect(result.status).toBe('PENDING');
        expect(result.reasons).toContain('guest_comment');
    });

    it('marks obvious link spam as spam', () => {
        const result = detectCommentModeration({
            content: 'Visit https://spam.example and https://seo.example for backlinks and casino wins',
            isAuthenticated: true,
        });

        expect(result.status).toBe('SPAM');
        expect(result.reasons).toEqual(expect.arrayContaining(['too_many_links', 'spam_keyword']));
    });

    it('requires guest identity when there is no account', () => {
        expect(() =>
            ensureGuestIdentity({
                userId: null,
                authorName: '',
                authorEmail: '',
            })
        ).toThrow('Guest comments require name and email');
    });

    it('rejects replies deeper than 2 levels', () => {
        expect(() =>
            ensureCommentReplyDepth({
                id: 'reply-2',
                parentId: 'reply-1',
            })
        ).toThrow('Replies are limited to 2 levels');
    });
});
