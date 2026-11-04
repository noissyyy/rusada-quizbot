# rusada-quizbot

Russian Language Quiz Telegram Mini App — Rusada учебный центр.

Monorepo. Phase 1 (Mini App UI) in progress.

| Path | Status |
|---|---|
| `apps/miniapp` | React 19 + TS + Vite 8 + Tailwind 4. Design tokens + UI kit + **Home screen** done (mock data) |
| `packages/shared-types` | API contract types (client types never contain correct answers) |
| `apps/admin`, `services/api`, `services/telegram-bot`, `infrastructure` | Empty — Phases 2–6 |

## Run
```bash
npm install
npm run dev         # http://localhost:5173
npm test            # vitest
npm run build       # typecheck + production build
```

## Design system
- Tokens: `apps/miniapp/src/styles/tokens.css` (Tailwind `@theme` — single source of truth)
- Components: `apps/miniapp/src/components/ui/*`
- Illustrations: `components/illustrations/*` — **vector placeholders**, replace with approved 3D assets.

## Mocked / pending
- All data comes from `src/data/mock.ts` through the `QuizApi` interface (`src/data/api.ts`).
- Telegram: `ready/expand/colors/safe-area/haptics` wired; initData is NOT yet validated (needs backend, Phase 3).
- Routes other than `/` render an explicit placeholder screen.
