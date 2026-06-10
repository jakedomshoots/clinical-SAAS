# Hosted Demo Environment

Canonical path: `docs/operations/hosted-demo-environment.md`

This guide describes how to run or host a Concierge OS buyer demo without PHI,
clinic credentials, or live vendor accounts. The demo environment is intended
for acquisition review, product diligence, and synthetic workflow walkthroughs.

## Demo Rules

- Use synthetic patient, staff, schedule, document, billing, and operations data
  only.
- Do not enter real patient names, dates of birth, phone numbers, chart notes,
  payer IDs, claim data, documents, or staff credentials.
- Keep `APP_ENV=production` and live vendor credentials out of buyer demos unless
  a real pilot has signed BAAs and go-live approvals.
- Keep `USE_SANDBOX_ADAPTERS=false` for normal buyer demos. Enable it only when
  intentionally demonstrating local adapter contract rehearsal.
- Label the demo as synthetic-data review in the meeting invite, opening slide,
  and handoff email.

## Fast Local Demo

Use this when presenting from the development machine:

```sh
pnpm install
pnpm dev:web
```

Open `http://localhost:5173`.

Demo mode is enabled automatically during Vite development. The login screen
pre-fills:

- Email: `admin@clinic.example.com`
- Password: `admin123!`

The browser stores demo changes in local storage under the Concierge OS demo
data key. Use the Setup route to reseed the workspace before a buyer meeting.

## Static Hosted Demo

Use this when a buyer needs a stable link and the review can run entirely from
the web app's synthetic demo API.

Set the hosted web environment variable:

```sh
VITE_ENABLE_DEMO_MODE=true
```

Build the web app:

```sh
pnpm --filter @concierge-os/web build
```

Deploy `apps/web/dist` to the static host of choice. The demo does not need API
secrets when it uses the browser-local demo API.

Recommended hosting options:

- Netlify static site with `apps/web/dist` as the publish directory.
- Vercel static build with `pnpm --filter @concierge-os/web build`.
- S3/CloudFront static site for a controlled private review link.

Buyer-demo hosting controls:

- password-protect the preview link when the host supports it;
- disable search indexing;
- include a synthetic-data banner or meeting disclaimer;
- reset browser demo data before each recorded walkthrough;
- do not connect production vendor keys to the static demo.

## Full-Stack Demo

Use this only when the buyer needs to inspect API behavior, auth, audit events,
or operational packets against a running backend.

Start the app stack locally:

```sh
docker compose -f docker/docker-compose.yml --profile app up --build
```

Open `http://localhost:8080`.

Required demo constraints:

- use `.env.example` or a demo-only derivative;
- keep `APP_ENV=development` or another non-production value;
- keep `ALLOW_SEED_ENDPOINT=true` only for demo setup;
- keep all vendor credentials empty or demo/sandbox-only;
- do not import clinic DrChrono exports.

## Demo Walkthrough Order

Use `docs/operations/buyer-demo-script.md` as the source script. The short path:

1. Login and Command Center.
2. Patient search and chart summary.
3. Native AI command entry and staged proposal review.
4. Documents or faxes workflow.
5. Scheduling and task handoff.
6. Billing queue and claim readiness.
7. Operations readiness packet and live-use blockers.

## Demo Reset Checklist

Before each buyer walkthrough:

- Confirm the browser is using demo mode.
- Clear or reseed local demo data from Setup.
- Confirm no real patient data is present.
- Confirm Assistant Review has no confusing old proposals.
- Confirm Operations shows production blockers as external and expected.
- Run:

  ```sh
  pnpm --filter @concierge-os/web audit:frontend
  pnpm --filter @concierge-os/web smoke
  ```

## Success Criteria

- Buyer can reach the app from a stable URL or local machine.
- Demo data loads without API credentials.
- The command layer can stage a proposal and require confirmation.
- Operations shows clear go-live blockers instead of pretending live readiness.
- No PHI or real clinic credentials are used.
