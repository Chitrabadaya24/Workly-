# Codeo — AI Teammate Integration Guide

Codeo is now wired into your Desk Helper project as a **system-wide AI assistant** that
performs **real actions** (creates meetings, files requests, assigns/lists tasks, changes
CEO status) against your existing models and APIs — not a fake chat.

It speaks through a glassmorphism floating cloud with typing animation and a mascot that
reacts (glowing eyes, expressions, sparkles) to what's happening.

---

## 1. Install the one new dependency

```bash
cd Frontend
npm install            # framer-motion@^11 is already added to package.json
```

Backend needs **no new packages** (uses your existing express/mongoose/socket.io).

> Note: `node_modules` was removed from this delivery folder to keep it small.
> Run `npm install` in **both** `Backend/` and `Frontend/` once.

---

## 2. What was ADDED (new files)

### Backend
| File | Purpose |
|------|---------|
| `Backend/models/Task.js` | Real Task model (assign / list / status) |
| `Backend/models/CodeoConversation.js` | Per-user chat memory for Codeo |
| `Backend/utils/codeoIntent.js` | **The brain** — offline NLU parser + LLM swap-seam |
| `Backend/controllers/codeoController.js` | Parses a message → runs the real action → replies |
| `Backend/controllers/taskController.js` | Task CRUD for the UI |
| `Backend/routes/codeo.js` | `POST /api/codeo/message`, `GET /api/codeo/history` |
| `Backend/routes/tasks.js` | `/api/tasks` endpoints |

### Frontend
| File | Purpose |
|------|---------|
| `Frontend/src/components/codeo/Codeo.jsx` | Animated raccoon mascot SVG matching the official character sheet (5 expressions) |
| `Frontend/src/components/codeo/CodeoLogo.jsx` | The `{ }` brace logo + CODEO wordmark (use in sidebar/login) |
| `Frontend/src/components/codeo/ChatBubble.jsx` | Glass cloud + typewriter + neon glow |
| `Frontend/src/components/codeo/CodeoProvider.jsx` | Global widget + `useCodeo()` context |

### The mascot — matches the character sheet
Codeo is the futuristic raccoon "Guardian of Code": charcoal fur, white muzzle &
ear-tips, spiky hair tuft, and a goggle-style cyber-mask with glowing cyan markings.
All five sheet expressions are implemented and mapped to moods:

| Sheet expression | Codeo `mood` | When it fires |
|---|---|---|
| `< >` code-bracket eyes | `idle` / `listening` | default / waiting |
| `^ ^` arcs + open smile | `happy` | request submitted, lists shown |
| `( (` curious + paw on chin | `thinking` | parsing / unsure |
| `✦ ✦` sparkles + "wow" mouth | `celebrate` | meeting/task created |
| `⌐ ⌐` half-lidded confident | `cool` | status set / confident confirmations |

Drop the logo anywhere with `import CodeoLogo from '.../codeo/CodeoLogo'` then
`<CodeoLogo size={40} withWordmark />`.

## 3. What was EDITED (existing files)

| File | Change |
|------|--------|
| `Backend/index.js` | Registered `codeoRoutes` and `taskRoutes` |
| `Frontend/src/services/apiService.js` | Added `codeoAPI` and `taskAPI` |
| `Frontend/src/App.jsx` | Wrapped authenticated routes in `<CodeoProvider>` (via `WithCodeo`) |
| `Frontend/package.json` | Added `framer-motion` |

Nothing else in your code was touched. Your meeting/request/auth flows are unchanged.

---

## 4. How Codeo "understands" (and how to upgrade later)

Right now Codeo uses a **deterministic offline parser** in `utils/codeoIntent.js` — no API
key, no network, fully reliable for the documented commands. It extracts dates ("tomorrow",
"next Monday", "5 PM"), teams ("HR team"), priority, titles, etc.

When you want true LLM understanding:
1. Implement `parseWithLLM(text, ctx)` in `utils/codeoIntent.js` (a stub is already there).
   It must return the same `{ type, entities, raw }` shape.
2. Set `CODEO_USE_LLM=true` in `Backend/.env`.
3. Done — nothing else changes. If the LLM call fails, it auto-falls back to the offline parser.

---

## 5. Commands Codeo handles today

**CEO**
- "Show pending requests" → inbox of employee requests
- "Approve 1" / "Reject 2 because …" → approve/reject with notifications
- "Create a meeting tomorrow at 5 PM" → real Meeting + Jitsi link
- "Assign task to HR team" / "Show assigned tasks"
- "Set my status to deep work"
- "Show analytics" / "Show upcoming meetings"

**Admin**
- "List users" / "Create user jsmith employee John Smith"
- "Deactivate user @oldhire" / "Reset password for @jsmith"
- "Create a meeting tomorrow at 5 PM" / "Assign task to HR team"
- "Show analytics" / "Show pending requests"

**Employee**
- "Request leave next Monday" → real request, notifies CEO
- "Request a meeting with my manager tomorrow at 3pm"
- "Apply for shift change"
- "Show my tasks" / "Show my requests"

Type **"help"** anytime to see role-specific commands. Codeo uses your JWT role (CEO/admin/employee), matching the dashboard you logged into.

---

## 6. Trigger Codeo from anywhere in the UI (optional)

Any component under the provider can drive the mascot:

```jsx
import { useCodeo } from '../components/codeo/CodeoProvider';

function SomeButton() {
  const codeo = useCodeo();
  return (
    <>
      <button onClick={() => codeo.send('Create a meeting tomorrow at 5pm')}>
        Quick schedule
      </button>
      <button onClick={() => codeo.say('Welcome back! 3 requests need your review.')}>
        Greet
      </button>
      {/* codeo.open(), codeo.close(), codeo.react('celebrate') also available */}
    </>
  );
}
```

You can also add a "Tasks" page using `taskAPI` (getAll/create/updateStatus) — the backend
is ready.

---

## 7. Realtime reactions

The backend emits `codeo_action` to the acting user's socket room after every action, so the
mascot reacts platform-wide (e.g. celebrate on a successful schedule). `new_task` and
`task_updated` socket events are also emitted for live task UIs.

---

## 8. Quick test

1. Start backend (`npm run dev` in `Backend/`) and frontend (`npm run dev` in `Frontend/`).
2. Log in. Codeo greets you bottom-right after ~1s.
3. As CEO, type: **"Create a meeting tomorrow at 5 PM"** → check the meeting appears and
   participants get a notification.
4. As employee, type: **"Show my tasks"** or **"Request leave next Monday"**.
