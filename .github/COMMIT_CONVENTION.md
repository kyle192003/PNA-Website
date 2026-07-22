# Commit message rules

Start every commit with one of these prefixes (exact spelling and colon):

- `Feature:` — new work (pages, forms, tools)
- `Update:` — improvements to what already exists
- `Fix:` — bug fixes

## Examples

```
Feature: add event registration form
Update: polish site styles and small fixes
Fix: show register button correctly when signed in
```

Keep the rest of the message in simple words.

Before you push, run:

```bash
npm run fix
```

That cleans up lint issues the tools can fix for you.
