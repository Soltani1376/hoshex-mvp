# Hoshex Cloud V1

## Goal

Hoshex Cloud turns the existing local Journey into one persistent business record shared by App V2, the Hoshex website, and embeddable website integrations.

Core loop remains:

`Diagnosis → Priority 01 → Today Action → Execution → Check-in → Feedback → Next Step`

Cloud changes persistence, not product focus.

## Supabase project

- Project: `hoshex-cloud`
- Project ref: `ihxbwyqmmzbyolsdryec`
- Region: `eu-west-1`
- Browser clients use the project publishable key only.
- Secret/service-role keys remain inside Supabase Edge Functions.

## Data model

- `businesses`: stable business identity, keyed by `(user_id, client_key)`
- `journeys`: one active Journey record per user/business
- `cycles`: diagnosis and follow-up cycles
- `executions`: the one execution-ready artifact for a cycle
- `feedback`: result feedback for a cycle
- `events`: cloud-side product events when needed
- `guest_bootstrap_attempts`: server-only rate-limit records

Every exposed business table has RLS and an ownership predicate based on `auth.uid() = user_id`.

## Guest session

The app does not depend on Supabase Anonymous Auth being enabled.

`guest-bootstrap` creates a regular Auth user with:

- a random internal email under `guest.hoshex.invalid`
- a cryptographically random password
- email auto-confirmed by the server
- `user_metadata.guest=true`

The function then returns a normal user session. The browser never receives a service-role/secret key.

The endpoint is IP-hash rate-limited and stores only a salted hash, not the raw address.

## Local → Cloud migration

Existing `hx_business_journey_v1` stays as the offline cache and migration source.

On Cloud initialization:

1. acquire/refresh a user session
2. pull the newest cloud Journey
3. if cloud is newer, rebuild local Journey
4. upsert local Journey back to Cloud
5. watch local Journey changes and sync them idempotently

A stable `hx_cloud_business_key_v1` prevents duplicate Business rows on repeated sync.

## Account upgrade

Guest data is never discarded during signup.

1. user creates a normal email/password account
2. user confirms the email
3. user signs in to that account
4. the browser keeps the previous guest token as a temporary backup
5. `claim-guest` verifies both sessions
6. `hx_claim_guest_data()` transfers all business records to the permanent UID
7. the temporary guest Auth user is deleted
8. Cloud data is pulled into the current device

The transfer RPC can only be executed by `service_role`.

## Brain memory

`assets/hoshex-cloud.js` creates a compact memory from the latest six cycles and routes diagnosis requests through `/api/chat-cloud`.

`api/chat-cloud.js` runs the existing deterministic V2 diagnosis first, then optionally uses AvalAI to refine the next action with history.

Memory rules:

- current evidence outranks history
- `no_result`: do not repeat the exact failed action without adjustment
- `improved`: preserve useful patterns when relevant
- not executed: reduce execution friction rather than inventing a new problem
- irrelevant history should leave the base diagnosis nearly unchanged

## Website integration

`assets/hoshex-cloud-widget.js` is an embeddable read surface. A user signs in with the same Hoshex account and sees:

- Priority 01
- current action
- success metric
- Jalali check-in date

The widget reads the same Supabase Journey as App V2.

## WordPress plugin

Plugin path:

`plugins/wordpress/hoshex-cloud/hoshex-cloud.php`

Shortcode:

`[hoshex_business_path]`

The plugin loads the hosted widget from `https://hoshex-app.vercel.app/assets/hoshex-cloud-widget.js`.

## Security decisions

- no service-role/secret key in browser source
- RLS on every public business table
- authenticated ownership policies include `auth.uid() = user_id`
- guest claim runs server-side after validating both sessions
- guest claim RPC is revoked from `public`, `anon`, and `authenticated`
- rate-limit table is explicitly inaccessible to user roles
- Supabase Security Advisor was run after schema changes

## Verification

CI contract: `tests/run-cloud-tests.cjs`

It validates:

- Cloud JS/widget syntax
- no service-role string in browser bundle
- guest bootstrap + claim integration
- local Journey migration contract
- idempotent upsert contract
- Brain Memory routing/rules
- Jalali website widget
- WordPress shortcode integration
- App V2 loader order
