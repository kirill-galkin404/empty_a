# Todo app monorepo

Two apps live side by side:

- `apps/backend` — REST API (Node.js, Express 4, SQLite), default port **3000** (override with `PORT`).
- `apps/frontend` — AngularJS single-page app served by `http-server`, port **8080**.

The SPA talks to the API at `http://localhost:3000/api` (see `apps/frontend/js/config.js`).

## Run the backend

```
npm --prefix apps/backend install
npm --prefix apps/backend run seed    # optional, creates the demo user
npm --prefix apps/backend start       # http://localhost:3000
```

## Run the frontend

```
npm --prefix apps/frontend install
npm --prefix apps/frontend start      # http://localhost:8080
```

## Demo login

After seeding, sign in with username `demo` and password `demo`.

## Root scripts

Convenience scripts at the repository root delegate to the per-app commands above (they are an addition beyond the original merge goal; the per-app commands keep working unchanged). The root `package.json` has no dependencies.

| Command | Does |
| --- | --- |
| `npm run install:all` | installs both apps' dependencies |
| `npm run seed` | `npm --prefix apps/backend run seed` |
| `npm run start:api` | starts the API on port 3000 |
| `npm run start:web` | serves the SPA on port 8080 |
| `npm run dev` | runs API and SPA together (`node scripts/dev.js`); Ctrl+C stops both. Use `node scripts/dev.js --dry-run` to print the commands only |
| `npm test` | runs `node --test tests/*.test.js` |

Root `npm test` needs the backend dependencies installed first: `npm --prefix apps/backend ci`. The end-to-end API test needs no manual seeding, because its harness seeds a temporary copy of the database.

## More

See [docs/monorepo-import.md](docs/monorepo-import.md) for how the apps were imported and the open follow-ups.
