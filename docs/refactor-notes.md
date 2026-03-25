# Backend Refactor Notes

## Current state

- Runtime remains Express-based.
- Entry point remains `src/server.js`.
- App bootstrap remains `src/app.js`.
- Metrics endpoint remains `/metrics`.
- Health check remains `/health`.
- Existing env names remain unchanged.

## Structural target for this refactor

- `src/common/errors`
- `src/common/middleware`
- `src/common/observability`
- `src/database`
- existing `src/middlewares` and `src/utils` stay as compatibility wrappers

## Out of scope for this pass

- Changing Docker or Jenkins behavior
- Changing metric names
- Changing API routes
- Migrating Express to NestJS
- Renaming environment variables
