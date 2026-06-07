# Joy Journey Daily ✈️

A **collaborative digital travel journal** for couples, friends, and solo travelers. Create beautiful scrapbook-style pages with photos, drawings, text, stickers, emoji, and interactive envelopes — all in **real-time** with your travel partner.

> Built with React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · Firebase

---

## ✨ Features

| Category | What You Can Do |
|---|---|
| **📝 Content** | Drag-and-drop photos, text, drawings, emoji, stickers, shapes, and interactive envelopes onto your pages |
| **🎨 Drawing** | Freehand drawing with pen, marker, highlighter, eraser, and lasso selection tools |
| **📸 Photo Masks** | Apply creative masks — Rectangle, Circle, Polaroid, Torn Edge, Cloud |
| **📄 Templates** | One-click layouts: Map Spread, Photo Grid, Quote Page, Itinerary |
| **🔄 Real-time Sync** | See edits and cursors from your partner instantly via Firebase + BroadcastChannel |
| **🔖 Book UI** | Two-page spread layout with realistic spine, page navigation, and focus mode |
| **🏆 Milestones** | Track trip milestones with confetti celebrations on completion |
| **📦 Checkpoints** | Save/restore journal history with auto-checkpoints every 60s |
| **📤 Export** | Export spreads as PNG (PDF coming soon) |
| **🌙 Theme** | Day/Night mode with vintage paper aesthetic |
| **🔐 Auth** | Google Sign-in, Anonymous, or Email/Password |

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- npm

### 1. Install

```bash
git clone <repo-url>
cd JornalV2
npm install
```

### 2. Configure Firebase

Copy the environment template and fill in your Firebase project credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `VITE_FIREBASE_APP_ID` | Your Firebase app ID |
| `VITE_FIREBASE_DATABASE_URL` | Your Realtime DB URL |

> **Firebase services needed:** Authentication (enable Google provider), Realtime Database, and Storage.

### 3. Run

```bash
npm run dev
```

Opens at `http://localhost:5173` with hot module reload.

---

## 📦 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | TypeScript check + production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint with TypeScript + React rules |

---

## 🗂️ Project Structure

```
src/
├── main.tsx                    # App entry point
├── index.css                   # Tailwind + custom theme + animations
├── types/journal.ts            # TypeScript types (CanvasElement, Page, User, etc.)
├── lib/
│   ├── firebase.ts             # Firebase initialization
│   ├── firebaseSync.ts         # Firebase Realtime DB sync engine
│   ├── broadcastSync.ts        # Same-browser tab sync
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── hooks/
│   ├── useFirebaseAuth.ts      # Auth (Google / Anonymous / Email)
│   ├── useWebRTCSync.ts        # Combined sync engine
│   ├── useAutoSave.ts          # Auto-save status
│   └── useToolDrag.ts          # Drag source for tool items
├── app/
│   ├── App.tsx                 # Root: providers, layout, theme toggle
│   ├── contexts/
│   │   ├── JournalContext.tsx   # Central state (pages, elements, auth, CRUD)
│   │   └── ThemeContext.tsx     # Day/Night theme
│   └── components/
│       ├── AuthScreen.tsx       # Login screen
│       ├── BookInterface.tsx    # Book layout + navigation
│       ├── Canvas.tsx           # Per-page canvas + drawing surface
│       ├── DraggableElement.tsx # Element rendering + move/resize/rotate
│       ├── LeftSidebar.tsx      # Journey details (milestones, occasions)
│       ├── RightToolbar.tsx     # Tool palette
│       ├── ExportButton.tsx     # PNG export
│       └── panels/             # Tool panels (Photo, Text, Draw, Emoji, etc.)
│           ├── PhotoPanel.tsx
│           ├── TextPanel.tsx
│           ├── DrawPanel.tsx
│           ├── EmojiPanel.tsx
│           ├── StickersPanel.tsx
│           ├── ShapesPanel.tsx
│           ├── EnvelopePanel.tsx
│           ├── TemplatesPanel.tsx
│           ├── BackgroundPanel.tsx
│           └── HistoryPanel.tsx
```

---

## 🧰 Tech Stack

| Frontend | Backend & Infrastructure |
|---|---|
| React 19 · TypeScript 6 | Firebase Auth + Realtime DB + Storage |
| Vite 8 · Tailwind CSS v4 | Vercel (hosting) |
| motion (Framer Motion) | Playwright (testing) |
| react-dnd (drag & drop) | ESLint (linting) |
| Radix UI (accessible primitives) | |
| lucide-react (icons) | |
| html2canvas (export) | |

---

## 🤝 Collaboration

The journal syncs in real-time via two channels:

- **BroadcastChannel** — Instant sync between browser tabs on the same device
- **Firebase Realtime Database** — Cross-device sync with your travel partner

You'll see each other's cursors, edits, and additions as they happen, with a latency badge showing connection health.

---

## 📄 License

MIT
