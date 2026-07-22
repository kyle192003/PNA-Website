# Contributing

## Commit messages

Use a clear prefix so progress is easy to read:

| Prefix | When to use |
| ------ | ----------- |
| `Feature:` | Adding something new |
| `Update:` | Improving something that exists |
| `Fix:` | Fixing a bug |

Examples: `Feature: add contact form`, `Update: improve mobile layout`, `Fix: correct payment status`.

See [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md) for more detail.

## Before you push

```bash
npm run fix
```

This runs the linter and auto-fixes what it can. Then build if you changed a lot:

```bash
npm run build
```

## Pull requests

PRs to `main` run install, lint, and build. Commit messages that do not start with `Feature:`, `Update:`, or `Fix:` will fail the check.
