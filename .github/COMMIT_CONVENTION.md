# Commit message rules

Start every commit with one of these prefixes (exact spelling and colon):

- `feat:` — new work (pages, forms, tools)
- `update:` — improvements to what already exists
- `fix:` — bug fixes

## Examples

```
feat: add event registration form
update: polish site styles and small fixes
fix: show register button correctly when signed in
```

Keep the rest of the message in simple words.

Before you push, run:

```bash
npm run fix
```

That cleans up lint issues the tools can fix for you.
