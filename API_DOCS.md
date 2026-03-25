# DevOps Blog API Docs

This document is intended for handoff and integration work. It reflects the current backend behavior in `server-nodejs`.

## Base URLs

- Local: `http://localhost:3001`
- Production example: `https://api.blog.thienduong.info`

API prefix for application routes:

- `/api/v1`

Non-prefixed operational endpoints:

- `GET /health`
- `GET /metrics`

## Authentication Model

The backend uses a split-token flow:

- Access token:
  - returned in JSON response body
  - sent by client in `Authorization: Bearer <token>`
- Refresh token:
  - returned as HTTP-only cookie named `refreshToken`
  - used by `POST /api/v1/auth/refresh`

## Common Response Shapes

Success with data:

```json
{
  "success": true,
  "data": {}
}
```

Success with pagination:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  }
}
```

Success with message:

```json
{
  "success": true,
  "message": "Operation completed"
}
```

Error:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Roles

Current role values:

- `ADMIN`
- `MODERATOR`
- `EDITOR`
- `VIEWER`

## Auth API

### POST `/api/v1/auth/register`

Public endpoint. Creates a user and returns access token data.

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "firstName": "John",
  "lastName": "Doe"
}
```

Success:

- status `201`
- sets `refreshToken` cookie

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "accessTokenExpires": 1710000000000
  }
}
```

### POST `/api/v1/auth/login`

Public endpoint. Validates credentials and returns tokens.

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Success:

- status `200`
- sets `refreshToken` cookie

### POST `/api/v1/auth/refresh`

Public endpoint, but requires valid `refreshToken` cookie.

Success:

- status `200`
- rotates refresh token cookie
- returns new access token payload

Error example:

```json
{
  "success": false,
  "error": "No refresh token provided"
}
```

### POST `/api/v1/auth/logout`

Private endpoint.

Headers:

- `Authorization: Bearer <access-token>`

Success:

- clears `refreshToken` cookie

### GET `/api/v1/auth/profile`

Private endpoint.

Headers:

- `Authorization: Bearer <access-token>`

Response `data` contains:

- `id`
- `email`
- `firstName`
- `lastName`
- `avatar`
- `bio`
- `role`
- `isActive`
- `lastLoginAt`
- `createdAt`

## Posts API

### GET `/api/v1/posts/published`

Public list endpoint for published articles.

Query params:

- `page`
- `limit`
- `search`
- `categoryId`
- `authorId`
- `tagSlug`
- `sortBy`:
  - `createdAt`
  - `updatedAt`
  - `publishedAt`
  - `viewCount`
  - `title`
- `sortOrder`: `asc | desc`

Response:

- paginated list
- each item includes author, category, tags, comment count

### GET `/api/v1/posts/slug/:slug`

Public detail endpoint for blog detail page.

Behavior:

- returns article detail by slug
- includes approved top-level comments and approved replies
- increments `viewCount`

### GET `/api/v1/posts/:id/related`

Public endpoint.

Query params:

- `limit` optional, default `3`

Behavior:

- finds related published posts by category or shared tags

### GET `/api/v1/posts`

Private endpoint for admin/editor listing.

Roles:

- `ADMIN`
- `MODERATOR`
- `EDITOR`

Query params same shape as `/published`, plus:

- `status`: `DRAFT | PUBLISHED | SCHEDULED | ARCHIVED`

### GET `/api/v1/posts/stats`

Private endpoint.

Roles:

- `ADMIN`
- `MODERATOR`

Returns:

- total posts
- total views
- post count by status
- recent posts

### GET `/api/v1/posts/:id`

Private endpoint for admin detail view.

Roles:

- `ADMIN`
- `MODERATOR`
- `EDITOR`

### POST `/api/v1/posts`

Private endpoint.

Roles:

- `ADMIN`
- `EDITOR`

Request body:

```json
{
  "title": "Kubernetes at Scale",
  "slug": "kubernetes-at-scale",
  "excerpt": "Optional summary",
  "content": "Markdown or article body",
  "featuredImage": "https://example.com/image.webp",
  "status": "PUBLISHED",
  "categoryId": "category-id",
  "tagIds": ["tag-1", "tag-2"],
  "scheduledAt": null
}
```

Behavior:

- auto-generates slug if missing
- enforces unique slug
- calculates reading time
- sets `publishedAt` when status is `PUBLISHED`

### PUT `/api/v1/posts/:id`

Private endpoint.

Roles:

- `ADMIN`
- `EDITOR`

Behavior:

- only author or admin can update
- recalculates reading time if content changed
- regenerates slug if title changed
- replaces tags if `tagIds` provided

### DELETE `/api/v1/posts/:id`

Private endpoint.

Roles:

- `ADMIN`
- `EDITOR`

Behavior:

- only author or admin can delete

## Comments API

### GET `/api/v1/comments`

Private admin/moderation listing endpoint.

Roles:

- `ADMIN`
- `MODERATOR`

Query params:

- `page`
- `limit`
- `status`: `all | PENDING | APPROVED | SPAM | TRASH`
- `search`

Behavior:

- returns paginated comments ordered by newest first
- search matches comment content, guest author fields, post title, or linked user fields
- includes linked `post` and `user` information for admin UI

### GET `/api/v1/comments/post/:postId`

Public endpoint.

Returns:

- approved top-level comments for a post
- approved replies nested under each top-level comment

### POST `/api/v1/comments`

Public endpoint with optional auth.

Request body:

```json
{
  "content": "Great article",
  "postId": "post-id",
  "parentId": null,
  "authorName": "Guest User",
  "authorEmail": "guest@example.com"
}
```

Behavior:

- creates comment as `PENDING`
- stores guest identity when user is not logged in
- stores request IP in `authorIp`

### PATCH `/api/v1/comments/:id/status`

Private endpoint.

Roles:

- `ADMIN`
- `MODERATOR`

Request body:

```json
{
  "status": "APPROVED"
}
```

Allowed status values:

- `PENDING`
- `APPROVED`
- `SPAM`
- `TRASH`

### DELETE `/api/v1/comments/:id`

Private endpoint.

Behavior:

- comment author can delete own comment
- `ADMIN` and `MODERATOR` can delete any comment

### GET `/api/v1/comments/stats`

Private endpoint.

Roles:

- `ADMIN`
- `MODERATOR`

Returns:

- `total`
- `byStatus`

## Users API

### GET `/api/v1/users`

Private endpoint.

Roles:

- `ADMIN`
- `MODERATOR`

Query params:

- `page`
- `limit`
- `role`
- `search`

Returns paginated users with post/comment counts.

### GET `/api/v1/users/:id`

Private endpoint.

Returns detailed user profile plus counts.

### GET `/api/v1/users/stats`

Private endpoint.

Roles:

- `ADMIN`
- `MODERATOR`

Returns:

- `total`
- `active`
- `byRole`

### PUT `/api/v1/users/:id`

Private endpoint.

Behavior:

- self update allowed
- admin can update any user
- only admin can change `role`

Accepted fields:

- `email`
- `password`
- `firstName`
- `lastName`
- `avatar`
- `bio`
- `role`
- `isActive`

### DELETE `/api/v1/users/:id`

Private endpoint.

Roles:

- `ADMIN`

Behavior:

- admin only
- cannot delete own account

## Categories API

### GET `/api/v1/categories`

Public endpoint.

Returns:

- categories
- post counts
- parent reference

### GET `/api/v1/categories/:id`

Public endpoint.

Returns:

- category detail
- parent
- children
- post count

### POST `/api/v1/categories`

Private endpoint.

Roles:

- `ADMIN`

Request body fields:

- `name` required
- `slug` optional
- `description` optional
- `color` optional
- `icon` optional
- `parentId` optional

Behavior:

- generates slug if missing
- rejects duplicate slug

### PUT `/api/v1/categories/:id`

Private endpoint.

Roles:

- `ADMIN`

Behavior:

- updates category
- regenerates slug from `name` if needed

### DELETE `/api/v1/categories/:id`

Private endpoint.

Roles:

- `ADMIN`

## Tags API

### GET `/api/v1/tags`

Public endpoint.

Returns tags with post counts.

### GET `/api/v1/tags/:id`

Public endpoint.

Returns tag detail with post count.

### POST `/api/v1/tags`

Private endpoint.

Roles:

- `ADMIN`

Request body:

```json
{
  "name": "kubernetes",
  "slug": "kubernetes"
}
```

Behavior:

- generates slug if missing
- rejects duplicate slug

### PUT `/api/v1/tags/:id`

Private endpoint.

Roles:

- `ADMIN`

### DELETE `/api/v1/tags/:id`

Private endpoint.

Roles:

- `ADMIN`

## Subscribers API

### POST `/api/v1/subscribers`

Public endpoint.

Request body:

```json
{
  "email": "reader@example.com",
  "name": "Reader"
}
```

Behavior:

- creates new subscriber if email is new
- returns `Already subscribed` if already active
- reactivates inactive subscriber if email exists but is inactive

### POST `/api/v1/subscribers/unsubscribe`

Public endpoint.

Request body:

```json
{
  "token": "unsubscribe-token"
}
```

Behavior:

- deactivates subscriber
- sets `unsubscribedAt`

### GET `/api/v1/subscribers`

Private endpoint.

Roles:

- `ADMIN`

Query params:

- `page`
- `limit`
- `isActive`

### GET `/api/v1/subscribers/stats`

Private endpoint.

Roles:

- `ADMIN`

Returns:

- total
- active
- inactive

### DELETE `/api/v1/subscribers/:id`

Private endpoint.

Roles:

- `ADMIN`

## Settings API

### GET `/api/v1/settings`

Private endpoint.

Roles:

- `ADMIN`

Returns grouped system settings payload for:

- `general`
- `appearance`
- `email`
- `maintenance`

### PUT `/api/v1/settings`

Private endpoint.

Roles:

- `ADMIN`

Request body shape:

```json
{
  "general": {
    "siteName": "DevOps Blog",
    "siteUrl": "https://blog.thienduong.info",
    "siteDescription": "Expert articles on Kubernetes and DevOps best practices.",
    "language": "en",
    "timezone": "Asia/Ho_Chi_Minh",
    "postsPerPage": 10,
    "allowComments": true,
    "moderateComments": true
  },
  "appearance": {
    "darkModeDefault": true,
    "primaryColor": "#00bcd4"
  },
  "email": {
    "smtpHost": "",
    "smtpPort": "587",
    "smtpUser": "",
    "notifyNewComment": true,
    "notifyNewUser": true
  },
  "maintenance": {
    "maintenanceMode": false
  }
}
```

Behavior:

- stores values in `system_settings`
- returns normalized grouped settings after save

## SEO API

### GET `/api/v1/seo`

Private endpoint.

Roles:

- `ADMIN`

Returns SEO dashboard payload containing:

- `overview`
- `globalSettings`
- `homepage`
- `pages`
- `topKeywords`
- `suggestions`

Behavior:

- reads homepage/global SEO config from `seo_settings` and `system_settings`
- audits recent published posts and homepage SEO completeness
- computes overview score and issue summary for admin dashboard

### PUT `/api/v1/seo`

Private endpoint.

Roles:

- `ADMIN`

Request body shape:

```json
{
  "globalSettings": {
    "searchIndexing": true,
    "homepageTitleSuffix": " | DevOps Blog",
    "robotsTxt": "User-agent: *\nAllow: /\nDisallow: /admin/",
    "analyticsId": "G-XXXXXXXXXX"
  },
  "homepage": {
    "metaTitle": "DevOps Blog",
    "metaDescription": "Expert articles on Kubernetes, CI/CD, Cloud Architecture and DevOps best practices.",
    "canonicalUrl": "https://blog.thienduong.info/",
    "focusKeywords": ["devops", "kubernetes", "ci/cd"],
    "ogImage": "https://example.com/og-home.png",
    "noIndex": false,
    "noFollow": false
  }
}
```

Behavior:

- updates homepage SEO configuration in `seo_settings`
- updates global SEO settings in `system_settings`
- returns refreshed SEO dashboard payload after save

## Operational Endpoints

### GET `/health`

Public operational endpoint.

Returns server status, timestamp, environment, uptime, and memory stats.

### GET `/metrics`

Prometheus scrape endpoint.

Returns:

- default node metrics
- request count
- request latency histogram
- in-progress requests
- blog-specific counters

## Validation Notes

Validated modules currently include:

- `auth`
- `posts`
- `subscribers`
- `comments`
- `users`
- `tags`
- `categories`

## Current Verification Status

Latest backend refactor baseline has been validated with:

```bash
npm test
```
