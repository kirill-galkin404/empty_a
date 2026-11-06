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

## More

See [docs/monorepo-import.md](docs/monorepo-import.md) for how the apps were imported and the open follow-ups.
