# Cloud Transcription & Usage Paywall

## Overview

Transform OpenWhispr into a "just works" experience for signed-in users. The app sends audio to an OpenWhispr API (Vercel), which handles both transcription and reasoning server-side — no user configuration needed. Free tier: 2000 words/day. Pro subscription via Stripe for unlimited. Power users can switch to BYOK (bring your own key) for unlimited free usage. Local mode unchanged.

The server-side API is **provider-agnostic** — transcription and reasoning are routed through a unified provider interface. Initial providers: Groq (transcription + fast reasoning), OpenRouter (model variety). Future providers (Baseten, Deepgram, OpenAI Whisper, etc.) slot in without API changes.

## Architecture

```
Electron App  →  IPC (main process)  →  openwhispr-api (Vercel)  →  Provider (transcription)
                   (attaches session cookies)     ↕                →  Provider (reasoning)
                                             Neon Postgres              ↕
                                                  ↕                Stripe Webhooks
```

All API calls route through Electron's main process via IPC — same proven pattern as the existing Anthropic handler. This eliminates CORS entirely and keeps auth simple (session cookies forwarded by main process).

**Three transcription modes:**
| Mode | Who | Limit | Transcription | Reasoning |
|------|-----|-------|---------------|-----------|
| OpenWhispr Cloud (default) | Signed-in users | 2000 words/day free, unlimited Pro | Vercel API → provider | Vercel API → provider |
| BYOK | Advanced users with own keys | Unlimited | Direct to provider (existing) | Direct to provider (existing) |
| Local | Privacy users / offline | Unlimited | whisper.cpp / Parakeet | Own keys or local LLM |

---

## Step 0: Dead Code Cleanup (Prerequisite PR)

Merge before starting feature work:
- `preload.js:171` — Remove dead `onOAuthCallback` handler
- `src/components/AuthenticationStep.tsx:64` — Remove stale oauth-callback comment

---

## Step 1: Create `openwhispr-api` Repo

Location: `~/Projects/OpenWhispr/openwhispr-api/`

```
openwhispr-api/
  package.json            # @neondatabase/serverless, stripe, openai (provider-compatible), typescript
  tsconfig.json
  vercel.json             # maxDuration: 30s for transcribe, 60s for reason
  .env.local              # Local dev secrets
  lib/
    db.ts                 # Neon serverless Postgres client
    auth.ts               # Validate Neon Auth session → userId
    stripe.ts             # Stripe client init
    usage.ts              # countWords(), checkLimit(), getTodayUsage()
    providers.ts          # Provider registry — unified interface for transcription + reasoning
  api/
    transcribe.ts         # POST — receive audio, route to provider, return text + usage
    reason.ts             # POST — receive text, route to provider, return result
    usage.ts              # GET — current day's word count + limit info
    stripe/
      checkout.ts         # POST — create Stripe Checkout session
      portal.ts           # POST — create Stripe Customer Portal session
      webhook.ts          # POST — handle Stripe events
    checkout/
      success.ts          # GET — static "Payment successful, close this tab" page
      cancel.ts           # GET — static "Payment cancelled" page
```

### Provider Registry (`lib/providers.ts`)

Unified interface — providers are swappable without changing API endpoints or client code:

```typescript
interface TranscriptionProvider {
  id: string;                    // 'groq' | 'deepgram' | 'openai' | 'baseten' | ...
  transcribe(audio: Blob, opts: TranscribeOpts): Promise<TranscribeResult>;
}

interface ReasoningProvider {
  id: string;                    // 'groq' | 'openrouter' | 'baseten' | ...
  complete(messages: Message[], opts: ReasonOpts): Promise<ReasonResult>;
  models: ModelDefinition[];     // available models for this provider
}

interface TranscribeOpts {
  language?: string;
  prompt?: string;               // custom dictionary hints
  model?: string;                // provider-specific model ID
}

interface ReasonOpts {
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// Provider implementations are simple adapters — most use OpenAI-compatible API format
// Adding a new provider = one new file implementing the interface + register it
```

Initial providers:
- **Groq**: transcription (`whisper-large-v3-turbo`) + fast reasoning (`llama-3.3-70b-versatile`)
- **OpenRouter**: reasoning model variety (Claude, Gemini, GPT via OpenAI-compatible API)

Future providers slot in by implementing the interface:
- **Baseten**: custom deployed models (transcription + reasoning)
- **Deepgram**: alternative transcription
- **OpenAI**: Whisper API transcription

The active provider is configured via environment variables — no code changes needed to switch:
```
TRANSCRIPTION_PROVIDER=groq          # or 'deepgram', 'openai', 'baseten'
TRANSCRIPTION_MODEL=whisper-large-v3-turbo
REASONING_PROVIDERS=groq,openrouter  # comma-separated, first is default
```

### Environment Variables (Vercel)
```
DATABASE_URL=<neon-postgres-connection-string>
NEON_AUTH_URL=<same as VITE_NEON_AUTH_URL>

# Provider keys (only configure what you use)
GROQ_API_KEY=<for transcription + fast reasoning>
OPENROUTER_API_KEY=<for model variety>
# Future: DEEPGRAM_API_KEY, BASETEN_API_KEY, OPENAI_API_KEY

# Provider routing
TRANSCRIPTION_PROVIDER=groq
TRANSCRIPTION_MODEL=whisper-large-v3-turbo
REASONING_PROVIDERS=groq,openrouter

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

---

## Step 2: Neon Postgres Schema

Run in Neon console. Neon Auth already has a `user` table.

```sql
-- Transcription history (extensible for future metadata)
CREATE TABLE transcriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'cloud',          -- 'cloud' | 'byok' | 'local'
  provider TEXT,                                  -- 'groq' | 'deepgram' | 'openai' | 'baseten' | null
  model TEXT,                                     -- provider-specific model ID
  language TEXT,                                  -- ISO 639-1 code
  audio_duration_ms INTEGER,                      -- original audio length (for analytics)
  processing_ms INTEGER,                          -- server-side processing time
  metadata JSONB DEFAULT '{}',                    -- extensible: { prompt, confidence, segments, ... }
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tx_user ON transcriptions(user_id, created_at DESC);
CREATE INDEX idx_tx_source ON transcriptions(source);
CREATE INDEX idx_tx_user_date ON transcriptions(user_id, created_at)
  WHERE source = 'cloud';  -- optimizes daily usage aggregation

-- Subscription state (Stripe-managed)
CREATE TABLE subscriptions (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',              -- 'free' | 'pro' | future tiers
  status TEXT NOT NULL DEFAULT 'active',          -- 'active' | 'past_due' | 'canceled' | 'trialing'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,     -- user requested cancellation
  metadata JSONB DEFAULT '{}',                    -- extensible: { referral, coupon, ... }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Schema design notes:**
- `metadata JSONB` columns on `transcriptions` and `subscriptions` provide extensibility without schema migrations
- `provider` + `model` on transcriptions enable per-provider analytics and cost tracking
- `audio_duration_ms` + `processing_ms` enable performance monitoring
- Daily usage is derived from `transcriptions` via `SUM(word_count) WHERE created_at >= CURRENT_DATE` — no separate usage table needed
- `idx_tx_user_date` partial index (filtered to `source = 'cloud'`) keeps the aggregate query fast
- `cancel_at_period_end` tracks pending cancellations (Stripe pattern)
- `current_period_start` needed for usage reset alignment

---

## Step 3: API Endpoints

### `POST /api/transcribe` — Server-side transcription
- **Auth**: Session cookie (forwarded by Electron main process)
- **Request**: `multipart/form-data` — `file` (audio blob), `language`, `prompt` (dictionary)
- **Flow**:
  1. Validate session → get userId
  2. Route audio to active transcription provider (via provider registry)
  3. Count words from result: `text.trim().split(/\s+/).length`
  4. In one transaction:
     - INSERT `transcriptions` row (with word_count)
     - Aggregate today's usage: `SELECT COALESCE(SUM(word_count), 0) FROM transcriptions WHERE user_id = $1 AND created_at >= CURRENT_DATE AND source = 'cloud'`
     - If aggregate > plan limit: return text + `limitReached: true`
  5. Return `{ text, wordsUsed, wordsRemaining, plan, limitReached }`
- **Limit logic**: Post-transcription check. The audio is already transcribed (API cost incurred) — don't waste it. `limitReached: true` tells the client the *next* request will be blocked. Pre-flight check via `GET /api/usage` handles UI state.
- **No separate usage table**: Daily usage is derived from the `transcriptions` table via aggregate query. The `idx_tx_user_date` partial index keeps this fast.

### `POST /api/reason` — Server-side reasoning
- **Auth**: Session cookie
- **Request**: `{ text, model?, agentName?, customDictionary? }`
- **Flow**:
  1. Validate session → get userId
  2. Resolve model → provider via provider registry
  3. Build system prompt (reuse `getSystemPrompt()` logic from Electron app)
  4. Call provider
  5. Return `{ text, model, provider }`
- **No usage counting** for reasoning (only transcription counts toward word limit)

### `GET /api/usage`
- Returns `{ wordsUsed, wordsRemaining, limit, plan, isSubscribed, resetAt }`
- `wordsUsed` derived from: `SELECT COALESCE(SUM(word_count), 0) FROM transcriptions WHERE user_id = $1 AND created_at >= CURRENT_DATE AND source = 'cloud'`
- `resetAt`: midnight UTC of current day (so client can show countdown)

### `POST /api/stripe/checkout`
- Creates Stripe Checkout session
- Success/cancel URLs point to `/checkout/success` and `/checkout/cancel` on the Vercel API
- Returns `{ url }`

### `POST /api/stripe/portal`
- Creates Customer Portal session, returns `{ url }`

### `POST /api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Updates `subscriptions` table (plan, status, period dates, cancel_at_period_end)

### `GET /checkout/success` + `GET /checkout/cancel`
- Simple static HTML pages: "Payment successful, you can close this tab" / "Payment cancelled"
- Electron app polls `/api/usage` after opening checkout URL and detects plan change

### Auth Validation (`lib/auth.ts`)
```typescript
// Session cookies forwarded from Electron main process
async function validateSession(cookieHeader: string): Promise<{ userId: string } | null> {
  const res = await fetch(`${NEON_AUTH_URL}/api/auth/get-session`, {
    headers: { Cookie: cookieHeader }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.session ? { userId: data.session.userId } : null;
}
```

---

## Step 4: Electron App Changes

### Key Decision: IPC-First Architecture

All cloud API calls go through the main process via IPC. This:
- Eliminates CORS (main process is not subject to browser CORS)
- Reuses session cookies naturally (main process has access to session storage)
- Follows existing Anthropic handler pattern (`ipcHandlers.js:688`)
- Keeps renderer process thin and secure

### New IPC Handlers (in `ipcHandlers.js`)

```
cloud-transcribe     — forwards audio + metadata to Vercel /api/transcribe
cloud-reason         — forwards text + config to Vercel /api/reason
cloud-usage          — fetches /api/usage
cloud-checkout       — creates Stripe checkout session, returns URL
cloud-portal         — creates Stripe portal session, returns URL
```

Each handler:
1. Gets session cookies from Electron's session store
2. Makes fetch request to Vercel API with cookies attached
3. Returns `{ success, data }` or `{ success: false, error, code }` (existing IPC pattern)

### New IPC Channels (in `preload.js`)

```javascript
cloudTranscribe: (audioBuffer, opts) => ipcRenderer.invoke('cloud-transcribe', audioBuffer, opts),
cloudReason: (text, opts) => ipcRenderer.invoke('cloud-reason', text, opts),
cloudUsage: () => ipcRenderer.invoke('cloud-usage'),
cloudCheckout: () => ipcRenderer.invoke('cloud-checkout'),
cloudPortal: () => ipcRenderer.invoke('cloud-portal'),
```

### New Setting: `cloudTranscriptionMode`

Add to `src/hooks/useSettings.ts`:
- `cloudTranscriptionMode`: `"openwhispr"` | `"byok"` (default: `"openwhispr"`)
- When signed in + `useLocalWhisper === false`: determines cloud routing
- When not signed in: ignored, falls through to BYOK

### New Files

**`src/hooks/useUsage.ts`** — Usage tracking hook
- Depends on `useAuth()` — only fetches when `isSignedIn`
- Calls `window.electronAPI.cloudUsage()` on mount
- Returns `{ plan, wordsUsed, wordsRemaining, limit, isSubscribed, isOverLimit, refetch }`
- Exposes `openCheckout()` and `openPortal()` (calls IPC → gets URL → `shell.openExternal()`)
- Returns `null` when not signed in (BYOK/local users see nothing)
- Caches result with TTL from existing `CACHE_CONFIG`

**`src/components/UsageDisplay.tsx`** — Usage meter
- Progress bar showing `wordsUsed / limit`
- "Unlimited" for Pro users
- "Upgrade" button when approaching/at limit

**`src/components/UpgradePrompt.tsx`** — Limit hit dialog
- Shown when transcription returns `limitReached: true`
- Three options: "Upgrade to Pro", "Use your own API key", "Switch to local"

### Modified Files

**`src/helpers/audioManager.js`** — Core routing change
- Add `processWithOpenWhisprCloud(audioBlob, metadata)` method:
  - Calls `window.electronAPI.cloudTranscribe(audioArrayBuffer, { language, prompt })`
  - Handles `limitReached` flag (emits event for UI to show UpgradePrompt)
  - Returns same `{ success, text, source: "openwhispr", timings }` shape as other methods
  - ~10 lines — all heavy lifting in the IPC handler
- Modify `processAudio()` routing (~line 219):
  ```
  if (useLocalWhisper) → processWithLocalWhisper/Parakeet (unchanged)
  else if (cloudTranscriptionMode === "openwhispr" && isSignedIn) → processWithOpenWhisprCloud (NEW)
  else → processWithOpenAIAPI (existing BYOK flow, unchanged)
  ```

**`src/services/ReasoningService.ts`** — Add `"openwhispr"` provider
- Add `processWithOpenWhispr()` method alongside existing `processWithOpenAI()`, `processWithAnthropic()`, etc.
- Calls `window.electronAPI.cloudReason(text, { model, agentName, customDictionary })`
- When `cloudTranscriptionMode === "openwhispr"` && signed in, `reasoningProvider` is `"openwhispr"`
- Single routing point — no changes needed in `audioManager.js` for reasoning

**`src/hooks/useSettings.ts`**
- Add `cloudTranscriptionMode` setting with `useLocalStorage` hook

**`src/components/OnboardingFlow.tsx`** — Simplified step 1
- When signed in: default to OpenWhispr Cloud — show language picker + reasoning model selector (curated list from `modelRegistryData.json`, smart default pre-selected)
- Collapsible "Advanced: Use your own API key" section reveals existing TranscriptionModelPicker + ReasoningModelSelector
- When not signed in: show existing local/cloud picker (unchanged)

**`src/components/SettingsPage.tsx`**
- **Transcription section**: Mode toggle — "OpenWhispr Cloud" (simple) vs "Use your own API key" (shows existing provider/model/key pickers)
- **AI Models section**: When cloud mode, show curated model picker (from `modelRegistryData.json` cloud models section). When BYOK, show existing ReasoningModelSelector (unchanged)
- **Account section**: Add usage display (words today / limit), plan badge, upgrade/manage button

**`src/models/modelRegistryData.json`** — Add cloud model tiers
- Add `"openwhisprCloudModels"` section with curated tiers:
  - **Fast** (Groq): `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
  - **Balanced** (OpenRouter): `anthropic/claude-sonnet-4`, `google/gemini-2.5-flash`
  - **Quality** (OpenRouter): `anthropic/claude-opus-4`, `openai/gpt-4.1`
- Ships with the app — works offline for model selection UI
- Future: `/api/models` endpoint can refresh this list periodically (cached in localStorage, daily check)

**`src/config/constants.ts`**
- Add `OPENWHISPR_API_URL` constant (from `VITE_API_URL` env var, used by main process IPC handlers)

**`.env.example`**
- Add `VITE_API_URL=`

### Error Handling Strategy

All cloud errors handled in IPC handlers with consistent `{ success, data, error, code }` shape:

| Scenario | Client behavior |
|----------|----------------|
| Network failure | If BYOK keys exist, offer fallback. Otherwise show "No connection" with retry |
| 401 Unauthorized | Session expired — trigger re-auth flow |
| 429 Rate limited | Show "Too many requests, try again shortly" |
| 500 Server error | Show generic error, log details for debugging |
| Timeout (>30s) | Show "Server busy" with retry option |
| Offline (`!navigator.onLine`) | Before attempting: toast "You're offline. Switch to local or reconnect." |

Use existing `RETRY_CONFIG` from `constants.ts` for automatic retries in the main process API client.

---

## Step 5: UI/UX Design

### Design Principles
- **Minimal by default, powerful on demand** — signed-in users see 2 dropdowns, not 15 config fields
- **Never block, always guide** — limits hit? Text still pastes. Then a polished dialog offers paths forward
- **Upgrade prompts are helpful, not nagging** — surface Pro at natural friction points, never interrupt flow
- **Consistent visual language** — reuse existing shadcn/ui components, color scales, spacing, card patterns
- **Motion = meaning** — subtle transitions on state changes (progress bar color, badge swaps), no gratuitous animation

### Components to Reuse
| Existing Component | Used For |
|-------------------|----------|
| `Badge` (success/warning/destructive) | Plan pill ("Free", "Pro"), status indicators |
| `Progress` | Usage meter bar |
| `Dialog` | UpgradePrompt modal, limit hit |
| `Toast` (useToast) | Offline, errors, upgrade confirmation |
| `Card` / `CardHeader` / `CardContent` | Usage card, mode selector, option cards |
| `Button` (primary/outline/ghost) | Upgrade, manage, mode switches |
| `SettingsSection` / `SettingsGroup` | New settings areas match existing sections |
| `ProcessingModeSelector` | Adapt pattern for Cloud/BYOK toggle |
| `ProviderTabs` | Cloud model tier tabs (Fast/Balanced/Quality) |
| `Alert` (warning) | Approaching limit inline warning |
| `Select` | Cloud model dropdown |
| `LanguageSelector` | Reuse in simplified onboarding |
| `StepProgress` | Onboarding progress (unchanged, but step count may change) |

---

### 5a. User Journeys

#### Journey 1: New User — "Just Works" (primary path, optimized for)

```
Launch app
  → Onboarding Step 0: Account
     ┌─────────────────────────────────────────┐
     │  Create your account                     │
     │  [Continue with Google]  ← primary CTA   │
     │  ── or continue with email ──            │
     │  [email/password form]                   │
     │                                          │
     │  Benefits card (indigo-purple gradient):  │
     │  "Cloud transcription — just works"      │
     │  "2,000 words/day free"                  │
     │  "AI text processing included"           │
     │  "No API keys needed"                    │
     └─────────────────────────────────────────┘

  → Onboarding Step 1: Setup (SIMPLIFIED — see 5d)
     Just 2 dropdowns: Language + AI Model
     canProceed() = true immediately (smart defaults pre-selected)
     User can literally just click "Next" without touching anything

  → Steps 2-4: Permissions → Hotkey → Agent Name (unchanged)

  → Complete → Start dictating
     First transcription: audio → IPC → Vercel → text pasted
     Zero configuration. Magic.
```

**Key insight**: A signed-in user can go from app launch to first dictation by clicking: Google sign-in → Next → Grant mic → Next → Set hotkey → Next → Name agent → Complete. The Setup step requires zero thought.

#### Journey 2: Power User — BYOK

```
Either during onboarding (clicks "Advanced" in Step 1)
  or later in Settings → Transcription → "Use your own API key"

  → Existing TranscriptionModelPicker + ReasoningModelSelector appear
  → Enter API key, select model, configure endpoint
  → Audio routes direct to provider — no word limit, no usage tracking
  → Everything works exactly as it does today
```

#### Journey 3: Privacy User — Local Only

```
Onboarding Step 0: "Continue without an account"
  → Step 1: ProcessingModeSelector shows (unchanged)
     Select "Local" → download whisper model
  → Rest of onboarding unchanged
  → All processing on-device, no network calls
```

#### Journey 4: Free → Pro Conversion (upgrade touchpoints)

Users encounter Pro naturally at friction points — never as a nag:

| Touchpoint | Trigger | What They See |
|------------|---------|---------------|
| **Settings account section** | Always visible when signed in | Usage meter + "Upgrade to Pro" button. Subtle, always there. |
| **80% usage toast** | First transcription after 1,600 words | One-time toast: "370 words remaining today". Not blocking. |
| **Limit reached dialog** | Transcription returns `limitReached` | UpgradePrompt dialog (see 5e). Text already pasted — not punitive. |
| **Next-day return** | User returns after hitting limit yesterday | Usage reset, but Settings shows "Yesterday you hit your limit" hint with Pro CTA |

**Anti-patterns we avoid:**
- No upgrade popups on app launch
- No upgrade banners in the dictation overlay
- No "you're on the free plan" warnings during active work
- No feature-gating of existing functionality (BYOK/local always available)
- No countdown timers or urgency tactics

#### Journey 5: Returning User — Already Signed In

```
App launches → onboarding already complete
  → Control Panel shows transcription history
  → Dictation overlay ready
  → If cloud mode: first transcription fetches /api/usage in background
     → Usage state cached, updates after each transcription
  → If limit was hit yesterday: usage reset at midnight UTC, no friction
```

#### Journey 6: Pro User — Day-to-Day

```
Same as Journey 5, but:
  → Settings account shows "Pro" badge (emerald) + "Unlimited" + "Manage" button
  → No usage meter (no limit to track)
  → No upgrade prompts ever surface
  → "Manage" opens Stripe Customer Portal in browser
```

---

### 5b. Onboarding Flow Changes

Current onboarding: 5 steps (Account → Setup → Permissions → Hotkey → Agent Name)

**Steps 0, 2, 3, 4 are unchanged.** Only Step 1 (Setup) changes based on auth state.

#### Step 0: Account — Minor Enhancement

Update the benefits card content to emphasize the "zero config" value prop:

```
┌─────────────────────────────────────────────────────┐
│  Why create an account?          (indigo→purple bg)  │
│                                                      │
│  ● Instant transcription — no API keys needed        │
│  ● 2,000 words/day free, unlimited with Pro          │
│  ● AI text processing with world-class models        │
│  ● Your settings sync across devices (future)        │
└─────────────────────────────────────────────────────┘
```

"Continue without an account" link stays — no pressure.

#### Step 1: Setup — Two Completely Different Experiences

**Path A: Signed in** (simplified cloud-first experience)

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│        ┌──────┐                                      │
│        │  ✓   │  ← emerald circle (w-14 h-14)       │
│        └──────┘                                      │
│     You're ready to go                               │  ← text-2xl font-semibold
│                                                      │
│  OpenWhispr handles transcription and AI             │  ← text-neutral-600
│  processing for you. No setup needed.                │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │  Language                                     │   │  ← neutral-50 card
│  │  [ Auto-detect                          ▾ ]   │   │  ← LanguageSelector (existing)
│  │                                               │   │
│  │  AI Model                                     │   │
│  │  [ Llama 3.3 70B · Fast           ▾ ]         │   │  ← Select, pre-selected default
│  │                 ↑ smart default                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │  Advanced options                         ▸   │   │  ← ghost button, neutral-500
│  └───────────────────────────────────────────────┘   │
│  (collapsed by default — expands to show existing    │
│   ProcessingModeSelector + TranscriptionModelPicker  │
│   + ReasoningModelSelector for BYOK/local)           │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │  Included with your account:                  │   │  ← blue-50 card, text-sm
│  │  ✓ 2,000 words/day  ✓ AI processing          │   │
│  │  ✓ Multiple AI models  ✓ Custom dictionary    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**canProceed()**: Always `true` — defaults are pre-selected. User can literally click Next immediately.

**"Advanced options" behavior:**
- Click → section expands with smooth height transition
- Shows existing `ProcessingModeSelector` + full `TranscriptionModelPicker` + `ReasoningModelSelector`
- Selecting any BYOK/local option sets `cloudTranscriptionMode` accordingly
- Collapsing the section reverts to cloud defaults (with confirmation if they entered a key)

**Path B: Not signed in** (unchanged)

Shows existing `ProcessingModeSelector` (Local vs Cloud cards) + `TranscriptionModelPicker` + `LanguageSelector`. No simplification — they need to configure everything manually because they're not using cloud mode.

---

### 5c. Settings Page — Account Section Enhancement

Current: gradient card with avatar + name + email + sign-out.

**Add `UsageDisplay` component below the existing signed-in card:**

#### Free Plan — Normal Usage (<80%)
```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Today's Usage           Free  ← Badge outline   │  ← text-sm font-medium
│                                                  │
│  ██████████░░░░░░░░░░░░░░░░░░  847 / 2,000      │  ← Progress (indigo-600), text-sm tabular-nums
│                                                  │
│  Resets at midnight UTC                          │  ← text-xs text-neutral-400
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │  Upgrade to Pro — unlimited transcriptions │   │  ← subtle CTA: text link, not button
│  └───────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

- Card: `bg-white border border-neutral-200 rounded-xl` (clean, not gradient — gradient is for the profile card above)
- "Upgrade to Pro" is a `text-indigo-600 hover:text-indigo-700 text-sm` link, not a loud button. Subtle.
- Progress bar: `h-2 rounded-full`, indigo-600 fill, neutral-100 track

#### Free Plan — Approaching Limit (>80%)
```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Today's Usage           Free  ← Badge outline   │
│                                                  │
│  ██████████████████████████░░░  1,847 / 2,000    │  ← Progress (amber-500)
│                                                  │
│  153 words remaining                             │  ← text-xs text-amber-600 (replaces "resets at")
│                                                  │
│  [ Upgrade to Pro ]                              │  ← Button primary (indigo), appears at >80%
│                                                  │
└─────────────────────────────────────────────────┘
```

- Progress bar color transitions: indigo-600 → amber-500 at 80% → red-500 at 100%
- CTA elevates from text link to primary button when approaching limit

#### Free Plan — At Limit
```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Today's Usage        Limit reached ← Badge warn │
│                                                  │
│  ██████████████████████████████  2,000 / 2,000   │  ← Progress (red-500, full)
│                                                  │
│  Resets at midnight UTC                          │
│                                                  │
│  [ Upgrade to Pro ]    [ Use Your Own Key ]      │  ← Button primary + Button outline
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Pro Plan
```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Your Plan              Pro  ← Badge success     │
│                                                  │
│  Unlimited transcriptions                        │  ← text-sm text-neutral-600
│                                                  │
│  [ Manage Subscription ]                         │  ← Button outline (opens Stripe Portal)
│                                                  │
└─────────────────────────────────────────────────┘
```

- Clean, minimal. No progress bar (nothing to track). Badge is emerald/success.
- "Manage Subscription" → IPC → Stripe Customer Portal URL → `shell.openExternal()`

#### Not Signed In
- `UsageDisplay` component not rendered at all. Existing sign-in prompt shown.

---

### 5d. Settings Page — Transcription Mode Toggle

**Only shown when signed in.** Appears at top of Transcription Mode settings section.

```
┌─────────────────────────────────────────────────┐
│  ☁  OpenWhispr Cloud                    ● ──┐   │  ← selected: border-indigo-500/30, bg-indigo-50/30
│  Just works. No configuration needed.    │   │   │
│                                          │   │   │  ← radio-style, only one active
│  🔑  Bring Your Own Key                 ○ ──┘   │  ← unselected: border-neutral-200, bg-white
│  Use your own API key. No usage limits.         │
└─────────────────────────────────────────────────┘
```

- Same card-selection pattern as `ProcessingModeSelector` (indigo border + tinted bg for active)
- **Cloud selected**: Everything below is hidden. Clean empty state — maybe a single line: "Transcription is handled by OpenWhispr's servers. Change your language in General settings."
- **BYOK selected**: Existing `TranscriptionModelPicker` appears below (unchanged)
- Smooth height transition when switching (existing CSS pattern: `transition-all duration-200`)

**When not signed in:** This toggle is not rendered. User sees existing `TranscriptionModelPicker` directly.

---

### 5e. Settings Page — AI Models Section (Cloud Mode)

When `cloudTranscriptionMode === "openwhispr"`, replace `ReasoningModelSelector` with a simplified cloud model picker:

```
┌─────────────────────────────────────────────────┐
│  AI Model                                        │
│                                                  │
│  ┌──────┐ ┌──────────┐ ┌─────────┐              │
│  │ Fast │ │ Balanced │ │ Quality │              │  ← ProviderTabs (3 tiers)
│  └──────┘ └──────────┘ └─────────┘              │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │  Llama 3.3 70B                            │   │  ← Select dropdown
│  │  ─────────────────────                    │   │
│  │  Llama 3.3 70B       Recommended          │   │
│  │  Llama 3.1 8B        Fastest              │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  No API key needed. Powered by OpenWhispr.       │  ← text-xs text-neutral-400
│                                                  │
└─────────────────────────────────────────────────┘
```

- `ProviderTabs` reused with tier labels: "Fast" (Groq), "Balanced" (OpenRouter), "Quality" (OpenRouter)
- Each tier has a simple `Select` dropdown (not full ModelCardList — keep it minimal)
- "Recommended" badge on the default model per tier
- Model data from `modelRegistryData.json` `openwhisprCloudModels` section (ships with app, works offline)

**When BYOK mode:** Show existing `ReasoningModelSelector` unchanged.

---

### 5f. UpgradePrompt Dialog

Shown when transcription returns `limitReached: true`. Text is already pasted — this is not blocking work.

```
┌─────────────────────────────────────────────────────┐
│                                                ╳    │
│                                                     │
│         You've reached today's limit                │  ← text-xl font-semibold, centered
│                                                     │
│    2,000 of 2,000 words used.                       │  ← text-sm text-neutral-500
│    Your transcription was saved and pasted.          │
│                                                     │
│    ┌─────────────────────────────────────────────┐  │
│    │                                             │  │
│    │   Upgrade to Pro                        →   │  │  ← Card, from-indigo-50 to-purple-50/50
│    │   Unlimited transcriptions. $X/month.       │  │     border-indigo-200
│    │                                             │  │     hover: shadow-md transition
│    └─────────────────────────────────────────────┘  │
│    ┌─────────────────────────────────────────────┐  │
│    │   Use your own API key                  →   │  │  ← Card, bg-neutral-50, border-neutral-200
│    │   Bring your own key for unlimited use.     │  │     hover: border-neutral-300
│    └─────────────────────────────────────────────┘  │
│    ┌─────────────────────────────────────────────┐  │
│    │   Switch to local                       →   │  │  ← Card, bg-neutral-50, border-neutral-200
│    │   Offline transcription. No limits.         │  │
│    └─────────────────────────────────────────────┘  │
│                                                     │
│    Resets at midnight UTC                           │  ← text-xs text-neutral-400 centered
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- "Upgrade to Pro" → IPC → checkout URL → `shell.openExternal()` → dialog stays open (user returns after checkout)
- "Use your own API key" → sets `cloudTranscriptionMode = "byok"`, closes dialog, opens Settings to Transcription section
- "Switch to local" → sets `useLocalWhisper = true`, closes dialog (if model downloaded) or opens Settings to download model
- Dialog is dismissible (X button or click outside) — user can just close it and continue working until midnight reset
- Shown max once per limit-hit session (don't re-show on every subsequent failed attempt — just show a toast after the first dialog)

---

### 5g. Toast Notifications

All using existing `useToast` hook. Concise, actionable, never annoying.

| Event | Variant | Message | Frequency |
|-------|---------|---------|-----------|
| Offline + cloud mode attempt | `destructive` | "You're offline. Switch to local transcription or reconnect." | Every attempt |
| Cloud transcription network error | `destructive` | "Transcription failed. Retrying..." / "Transcription failed." | Per error |
| Session expired (401) | `destructive` | "Session expired. Sign in again in Settings." | Once per session |
| Approaching limit (>80%) | `default` | "{n} words remaining today." | Once per session |
| Limit hit (after first dialog dismissed) | `default` | "Daily limit reached. Resets at midnight UTC." | Per attempt |
| Post-upgrade (usage refetch detects Pro) | `success` | "Pro activated. Unlimited transcriptions." | Once |
| Provider switch (BYOK/local) | `success` | "Switched to [mode]. No usage limits." | Once per switch |

---

### 5h. Main Dictation Overlay (App.jsx)

**No changes to the overlay UI.** The floating button stays minimal:
- No usage meter (too distracting during active work)
- No plan badges (irrelevant during dictation)
- No upgrade prompts in the overlay

**Behavioral changes only:**
- When `limitReached` returns: paste text normally → after paste completes, show `UpgradePrompt` dialog in the Control Panel window (not the overlay)
- When offline + cloud mode: show toast in Control Panel before recording starts. If user is in overlay-only mode, the toast appears there.
- When session expired: transcription fails → toast → user opens Control Panel to re-auth

---

### 5i. Control Panel — Transcription History Enhancement

Minor addition to `ControlPanel.tsx`:

- **Cloud transcriptions**: Show a subtle cloud icon (Cloud, size-3, text-neutral-400) next to timestamp for cloud-transcribed items
- **Source indicator**: `source` field from transcription result → tiny pill: "cloud" | "local" | "byok" in text-xs text-neutral-400
- No other changes to the history UI

---

### 5j. Micro-Interactions & Polish

| Element | Detail |
|---------|--------|
| Usage progress bar | Color transitions smoothly (CSS `transition-colors duration-500`) between indigo → amber → red as usage increases |
| Mode toggle cards | Selected card has subtle `shadow-sm` + `ring-1 ring-indigo-500/20` — feels "pressed in" |
| UpgradePrompt option cards | `hover:shadow-md transition-shadow duration-150` — cards lift slightly on hover |
| Plan badge | `Badge` component with `transition-colors` — swaps from outline to success variant when Pro activates |
| Onboarding Step 1 (signed in) | Content fades in with `animate-in fade-in-0 duration-300` when step loads |
| Advanced section expand | `transition-[max-height] duration-200 ease-out` — smooth expand/collapse |
| Toast notifications | Existing slide-in animation from bottom-right (already implemented) |
| Model tier tabs | Existing `ProviderTabs` sliding indicator animation (already implemented) |

---

## Step 6: UX Flows

### New User — Signed In (primary path)
1. Open app → Onboarding Step 0: Create account (Google or email)
2. Step 1: "You're ready to go" — defaults pre-selected, click Next
3. Steps 2-4: Permissions → Hotkey → Agent Name (unchanged)
4. Complete → Start dictating. Zero config. Audio → IPC → Vercel → text pasted.

### New User — No Account
1. Open app → Onboarding Step 0: "Continue without an account"
2. Step 1: Full setup — ProcessingModeSelector (Local/Cloud) + model config + API key
3. Steps 2-4: unchanged
4. Complete → dictating works via BYOK or local

### Power User — Switch to BYOK
1. Settings → Transcription → "Bring Your Own Key"
2. Existing TranscriptionModelPicker appears → enter key, pick model
3. Audio goes direct to provider — no word limit, no usage tracking

### Free → Pro Conversion
1. User hits 80% usage → one-time toast: "370 words remaining"
2. User hits limit → text pastes normally → UpgradePrompt dialog
3. User clicks "Upgrade to Pro" → Stripe Checkout in browser
4. After payment → webhook updates DB → app polls /api/usage → Pro detected
5. Toast: "Pro activated. Unlimited transcriptions."
6. Settings shows Pro badge, "Manage Subscription" button. No more usage meter.

### Stripe Checkout
1. Upgrade CTA (settings or dialog) → IPC → Vercel creates Stripe Checkout session
2. `shell.openExternal(url)` → browser opens Stripe-hosted checkout
3. After payment → static "Payment successful, close this tab" page on Vercel
4. Electron app polls `/api/usage` every 3s for up to 60s after opening checkout
5. Detects plan change → success toast → UI updates

### Offline
1. `navigator.onLine` check before cloud transcription
2. Toast: "You're offline. Switch to local transcription or reconnect."
3. Local mode always works. BYOK may work depending on provider accessibility.

---

## Implementation Order

### Phase 1: Dead Code Cleanup (prerequisite PR) ✅ COMPLETE
1. ✅ Remove dead `onOAuthCallback` in `preload.js:171`
2. ✅ Remove stale comment in `AuthenticationStep.tsx:64`
3. ✅ Merge to main

### Phase 2: API Foundation ✅ COMPLETE
4. ✅ `git init` new repo at `~/Projects/OpenWhispr/openwhispr-api/`
5. ✅ Set up Vercel project, TypeScript, dependencies
6. ✅ Create Neon Postgres schema (run SQL in console)
7. ✅ Implement `lib/auth.ts`, `lib/db.ts`, `lib/usage.ts`, `lib/providers.ts`
8. ✅ Implement Groq transcription provider + OpenRouter reasoning provider
9. ✅ Implement `POST /api/transcribe` + `GET /api/usage`
10. ✅ Implement `POST /api/reason`
11. ✅ Test with curl

### Phase 3: Electron → API Integration ✅ COMPLETE
12. ✅ Add IPC handlers for `cloud-transcribe`, `cloud-reason`, `cloud-usage` to `ipcHandlers.js`
13. ✅ Add IPC channels to `preload.js`
14. ✅ Add `cloudTranscriptionMode` to `useSettings.ts`
15. ✅ Add `processWithOpenWhisprCloud()` to `audioManager.js`
16. ✅ Wire transcription routing in `processAudio()`
17. ✅ Add `"openwhispr"` provider to `ReasoningService.ts`
18. ⏳ Test: sign in → dictate → transcription + reasoning via API

### Phase 4: Usage Tracking & UI ✅ COMPLETE
19. ✅ Create `useUsage.ts` hook
20. ✅ Create `UsageDisplay.tsx` + `UpgradePrompt.tsx`
21. ✅ Update `SettingsPage.tsx` — mode toggle + usage display
22. ✅ Update `OnboardingFlow.tsx` — simplified step 1 for signed-in users
23. ✅ Add cloud model tiers to `modelRegistryData.json`
24. ✅ Integrate UpgradePrompt into ControlPanel for limit-reached events
25. ✅ Add IPC channels for limit-reached cross-window communication
26. ✅ Add TypeScript types for cloud API methods

### Phase 5: Stripe ❌ NOT STARTED
27. ❌ Set up Stripe product/price in dashboard
28. ❌ Implement checkout, portal, webhook endpoints
29. ❌ Add `/checkout/success` and `/checkout/cancel` pages
30. ❌ Add IPC handlers for `cloud-checkout`, `cloud-portal`
31. ❌ Wire upgrade/manage buttons to Stripe in UsageDisplay + UpgradePrompt
32. ❌ Test full payment flow with Stripe CLI

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Session cookies not forwardable from main process | Electron's `session.cookies.get()` API provides access. Already used for `authClearSession`. |
| Vercel 4.5MB body limit | Dictation audio is typically 50-200KB. Client already optimizes. |
| Vercel function timeout (10s free) | Transcription takes 1-5s. Use Vercel Pro plan (60s) if needed. |
| Stripe can't redirect back to Electron | Static success/cancel pages on Vercel. App polls `/api/usage`. |
| Provider outage | Provider registry makes switching providers a config change. No code deploy needed. |
| Offline users on cloud mode | `navigator.onLine` check + clear toast with actionable options. |

---

## Verification

1. **API auth**: `curl` with session cookie → `/api/usage` returns usage
2. **Default transcription**: Sign in → dictate → text appears (no API key configured)
3. **Default reasoning**: Enable reasoning → dictate "Hey Agent, ..." → AI-processed text returned
4. **Model selection**: Change reasoning model in settings → verify different model used
5. **BYOK mode**: Switch to BYOK → enter key → dictate → works with no word limit
6. **Local mode**: Switch to local → dictate → works offline, no API calls
7. **Usage limit**: Transcribe >2000 words → text still pastes → `UpgradePrompt` appears
8. **Stripe**: `stripe listen --forward-to localhost:3000/api/stripe/webhook` → checkout → plan updates
9. **Offline**: Disconnect network → cloud mode → offline toast → switch to local → works
10. **Sign-out**: Cloud features disabled, local data preserved, BYOK keys retained
11. **Provider swap**: Change `TRANSCRIPTION_PROVIDER` env var → verify new provider used (no code change)
