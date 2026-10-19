# Contributing

Thanks for wanting to help. Bug Blitz is small on purpose: plain JavaScript modules, no framework,
no build step, and one serverless function.

## Getting set up

```bash
npm install
npm run dev     # the app and its API on http://localhost:5300, storage in memory
npm test        # unit tests for the logic and the API
npm run lint    # ESLint and Prettier
```

## Where things go

- **Rules about a blitz or a finding** go in `src/core.js`. The app and the server both use it, so
  a rule written there holds everywhere. Add a test in `src/core.test.js`.
- **The API** is `server/handler.js`. Each change a client can make is an entry in `OPS`, with who
  is allowed to make it. Tests are in `server/handler.test.js`.
- **The app** is `src/view.js` (state and events) and `src/templates.js` (HTML). Controls name
  their handler with `data-action` or `data-change`.
- **Words** the app shows on its home and setup screens are in `src/copy.js`.

## Pull requests

- Keep each one to one change, and say what it changes and why.
- `npm run lint` and `npm test` must pass. CI runs both.
- For anything a person sees, try it with `npm run dev` on a shared blitz and on one kept on this
  device, at desktop and phone widths.
- Copy is plain and specific. No em-dashes.

## Reporting a bug

Open an issue with what happened, what you expected and how to make it happen again. For security
problems, see [SECURITY.md](SECURITY.md) instead.
