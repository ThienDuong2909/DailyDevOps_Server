# DevOps Blog API

Backend API for DevOps Blog, currently implemented with Node.js, Express, Prisma, and MySQL.

## Current Stack

- Node.js
- Express
- Prisma
- MySQL
- JWT authentication
- Joi validation
- Prometheus metrics

## Runtime Contracts

These contracts are currently considered stable and should not be broken by refactor work:

- Entry point: `src/server.js`
- App bootstrap: `src/app.js`
- Health endpoint: `/health`
- Metrics endpoint: `/metrics`
- API prefix: `/api/v1`
- Existing env variable names

## Installation

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Default runtime URL: [http://localhost:3001](http://localhost:3001)

## Current Structure

```text
server-nodejs/
|-- prisma/
|-- src/
|   |-- app.js
|   |-- server.js
|   |-- config/
|   |-- common/
|   |-- database/
|   |-- middlewares/        # compatibility wrappers kept for existing imports
|   |-- modules/
|   |-- utils/              # compatibility wrappers kept for existing imports
|-- docs/
|-- package.json
```

## Backend Refactor Direction

The current refactor is standardizing the codebase toward:

- `common/errors`
- `common/middleware`
- `common/observability`
- `database`
- feature modules with `routes -> service -> repository`

This is a structural cleanup pass. It is not a framework migration pass.

## Scripts

```bash
npm run dev
npm start
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:prod
npm run prisma:studio
npm run prisma:seed
```

## API Notes

Main public/admin routes currently live under `/api/v1`:

- `/api/v1/auth`
- `/api/v1/posts`
- `/api/v1/categories`
- `/api/v1/tags`
- `/api/v1/comments`
- `/api/v1/users`
- `/api/v1/subscribers`

## Verification

Current refactor baseline has been verified with:

```bash
npm test
```

For deployment/runtime guardrails, see [refactor-notes.md](E:/stitch/server-nodejs/docs/refactor-notes.md).
