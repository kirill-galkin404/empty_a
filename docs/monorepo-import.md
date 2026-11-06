# Monorepo import record

The two original repositories were imported into this repository:

| App | Destination | Source repository | Source commit |
|---|---|---|---|
| Backend | `apps/backend` | kirill-galkin404/todo_backend | `fcc83f9bd1dfa337dedb4e0de1ccc64c2ac9fb0e` |
| Frontend | `apps/frontend` | kirill-galkin404/todo_frontend | `942ccd9422cbcd811dd8ad7a196ce441bc2080ee` |

## Snapshot, not history

The import is a **snapshot of the tracked files** at the commits above. Git history of the source repositories was **not** grafted. The operator should confirm this is acceptable; if the history is wanted, use one of the methods below.

## Fidelity

Imported files are byte-for-byte copies of the source files; nothing was reformatted, lint-fixed or edited (including config values and lockfiles). This repository holds no reference blobs, so the verification limit is: fidelity was checked with `cmp` against the read-only source checkouts at import time. It can be re-checked later by comparing blob hashes, e.g.:

```
git -C <backend-clone> rev-parse fcc83f9bd1dfa337dedb4e0de1ccc64c2ac9fb0e:server.js
git hash-object apps/backend/server.js
```

(the two hashes must match; likewise for the frontend against `942ccd9422cbcd811dd8ad7a196ce441bc2080ee`).

## History-graft commands

Option A — `git subtree` (keeps history, rewrites nothing in the source):

```
git subtree add --prefix=apps/backend  https://github.com/kirill-galkin404/todo_backend.git  <branch>
git subtree add --prefix=apps/frontend https://github.com/kirill-galkin404/todo_frontend.git <branch>
```

Option B — `git filter-repo` on a fresh clone of each source, then merge:

```
git clone https://github.com/kirill-galkin404/todo_backend.git /tmp/todo_backend
git -C /tmp/todo_backend filter-repo --to-subdirectory-filter apps/backend
git remote add todo_backend /tmp/todo_backend
git fetch todo_backend
git merge --allow-unrelated-histories todo_backend/<branch>
```

and the same for `todo_frontend` with `--to-subdirectory-filter apps/frontend`. Either option must be done before the snapshot files are committed on the same paths, or the snapshot commit must be replaced.

## Deferred follow-ups

- **Shared env for `API_URL`**: the SPA hardcodes `API_URL` in `apps/frontend/js/config.js`, and the backend has its own config values in `apps/backend/config.js`. Introduce a shared env file so both are configured from one place.
- **Vendor the CDN libraries**: `apps/frontend/index.html` loads bootstrap, jquery, angular and moment from CDNs. Vendor them (or add them as dependencies) for offline and reproducible builds.
- **Security — ownership checks**: `POST /todos/:id/toggle` and `DELETE /lists/:id` lack ownership checks. This is preserved as-is from the source and deliberately not fixed in the import; fix it in a separate change.
- Root scripts and CI workflows are additions beyond the original goal of the import; pin CI action versions (to a release tag or commit SHA) when they are added.
