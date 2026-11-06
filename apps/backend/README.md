# todo_backend

REST API for the Todo app. Frontend lives in [todo_frontend](https://github.com/kirill-galkin404/todo_frontend).

Node.js + Express 4 + SQLite.

## Run

```
npm install
npm run seed   # optional, creates user demo / demo
npm start      # http://localhost:3000
```

## API

All endpoints except register/login need `X-Auth-Token` header.

| Method | Path | |
|---|---|---|
| POST | /api/users/register | `{username, password, email}` |
| POST | /api/users/login | `{username, password}` -> `{token, user}` |
| POST | /api/users/logout | |
| GET/PUT | /api/users/me | |
| GET/POST | /api/lists | |
| PUT/DELETE | /api/lists/:id | |
| GET | /api/todos | `?list=&done=0|1&q=&tag=&sort=due|priority&page=` |
| POST | /api/todos | `{title, notes, list_id, priority, due_date, tags}` |
| GET/PUT/DELETE | /api/todos/:id | |
| POST | /api/todos/:id/toggle | |
| POST | /api/todos/bulk | `{action: complete_all|clear_done, list_id}` |
| GET | /api/stats | |
