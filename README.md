# Philippine National Association — Conference Website

Official conference website for the **Philippine National Association (PNA) 2026 National Conference & General Assembly**, featuring online participant registration.

## Features

- Professional government-style design with Philippine national colors
- Conference information pages (About, Program, Speakers, Contact)
- **Online registration** with form validation and reference number generation
- Registration data persisted locally in `data/registrations.json`
- Registration lookup API by reference number
- Fully responsive layout for mobile and desktop

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.17 or later

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Pages

| Route       | Description                    |
| ----------- | ------------------------------ |
| `/`         | Home page with conference hero |
| `/about`    | Conference overview & objectives |
| `/program`  | 3-day schedule                 |
| `/speakers` | Featured speakers              |
| `/register` | Online registration form       |
| `/contact`  | Contact information            |

## API Endpoints

### `POST /api/register`

Submit a new conference registration.

### `GET /api/register/lookup?reference=PNA-2026-XXXXX`

Look up a registration by reference number.

## Customization

Conference details (dates, venue, fees, speakers, program) are centralized in:

```
src/lib/conference.ts
```

Edit this file to update conference content across the entire site.

## TanStack Query

Server state is managed with [TanStack Query](https://tanstack.com/query):

| File | Purpose |
| ---- | ------- |
| `src/providers/QueryProvider.tsx` | App-wide `QueryClientProvider` |
| `src/lib/query-client.ts` | Query client factory (SSR-safe) |
| `src/lib/query-keys.ts` | Centralized query key definitions |
| `src/lib/api/registrations.ts` | API fetch functions |
| `src/hooks/use-registrations.ts` | `useMutation` / `useQuery` hooks |

React Query Devtools are available in development (bottom-left corner).

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TanStack Query](https://tanstack.com/query) (server state & API mutations)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## Contributing

Use commit prefixes `feat:`, `update:`, or `fix:` so changes are easy to follow. Run `npm run fix` before pushing to clean up lint issues. Details are in [CONTRIBUTING.md](CONTRIBUTING.md).
