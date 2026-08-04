# Contributing

## Commit messages

Use a clear prefix so progress is easy to read:

| Prefix | When to use |
| ------ | ----------- |
| `feat:` | Adding something new |
| `update:` | Improving something that exists |
| `fix:` | Fixing a bug |

Examples: `feat: add contact form`, `update: improve mobile layout`, `fix: correct payment status`.

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

PRs to `main` run install, lint, and build. Commit messages that do not start with `feat:`, `update:`, or `fix:` will fail the check.
