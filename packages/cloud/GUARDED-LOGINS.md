# Guarded website logins

This fork adds the credential guard used by [Galera](https://github.com/Sterdizzy/galera). Existing cloud computers, device authentication, namespaces and container settings are retained. No new class migration is required.

## Browser boundary

Authenticated clients prepare a field before reading a secret. Preparation returns a single-use challenge, valid for 60 seconds, bound to the device-owned seat, current page, document, input, form and control generation. Filling rechecks everything in one synchronous browser task inside a CDP isolated world. The native setter bypasses page prototype replacements.

The guard requires an exact HTTPS security origin, an unambiguous visible and enabled top-document input, and a same-origin POST form. Password fields exclude new-password controls. Two-factor fields require the one-time-code autocomplete token. Username fields require username autocomplete or email input type. Changed nodes, form actions, submit overrides, frame targets, documents, origins, expired challenges and replay are refused.

`/vault/fill` accepts an optional boolean `submit`. With `submit: true` the Worker writes the value, lets page input handlers run, then reruns every preparation check on the same control and form and submits that form with the native `requestSubmit`, using the form's first enabled submit button. It then waits up to 8 seconds for a main-frame navigation or for the filled control to leave the page. The response adds `submitted` and `stillOnForm`. `stillOnForm` is true when the filled control is still shown, or after navigation when a visible password or one-time-code field is present, such as a rejected password or a next sign-in step. Without `submit`, `submitted` is false and `stillOnForm` is true.

Prepare, fill, ordinary browser actions and disposal share a seat queue. Human takeover changes its generation immediately and waits for in-flight work before acknowledging control. A takeover that lands between the write and the submit refuses the submit. An earlier failed operation cannot make that acknowledgement fail.

The browser runtime is a text asset so Wrangler cannot introduce closure-dependent compiler helpers into the isolated world. Tests exercise that asset in real Chromium.

## Fill window

Capability `vault.fill_login_guarded.v2` (implementation `galera-vault-2026-11-12.1`) reports `privacy: "fill-window"`. A short, in-memory privacy window replaces the v1 latch. It opens when a preparation succeeds and holds until the fill completes, and with `submit` until the page settles. While it is open, every Bot-visible browser observation, screenshot, command, file result and receipt replay for that seat returns `Sandbox action failed: Signing in, try again in a moment.` Browser actions are refused at once rather than queued behind the fill.

The window never blocks indefinitely. It ends when the fill completes or fails, when the challenge expires (60 seconds), on takeover, on browser reset, and on a cold start, because nothing is persisted. After a successful fill the Bot sees the page again, including the signed-in page after a submit. Password and one-time-code values stay redacted in semantic observations.

When anything fails after the value may have been written (validation, a changed form before submit, takeover before submit, a submit error or a timeout), the Worker clears the filled controls and the credential controls of their forms before the window ends. A submit that was already dispatched is not undone.

The value never appears in a response, error or log, and is not stored. The approved site receives the filled credential and is trusted with it.

### Accepted risk

Decided by the owner on 2026-11-12. A script on the approved origin can read a filled password, and once the window ends the Bot can observe whatever that page shows, including signed-in content and anything the page derives from the credential. Seats latched by v1 are released by v2: the `credential_privacy` table is dropped on the next start, so their retained pages and sandbox files become observable again. The cross-origin request block that v1 applied for the seat lifetime is also removed, since post-login redirects and API calls routinely leave the form's origin.

## Verification

Run the cloud package typecheck and unit tests using installed dependencies. Galera's explicit cross-repository test uses the real Worker fetch handler, SQLite statements, browser implementation and Chromium; only the Cloudflare transport is local. For v2 it checks the capability, release of a v1 latch, refusal during the window and in-flight fills, recovery after success, expiry and takeover, validated submit and settle, `stillOnForm`, clearing after a failed submit, stale origins and nodes, changed forms, duplicate fields, takeover ordering, replay, prototype tampering, cold starts and the absence of the value from responses, logs and persisted receipts.

```sh
node tests/vault-worker-e2e.mjs /path/to/galera-worker/packages/cloud /path/to/installed/chrome
```

That command runs from the Galera repository. It uses synthetic credentials and fulfills browser requests locally. The separately invoked live verifier creates and disposes only a newly generated synthetic seat on the existing Worker.

## Existing Worker rollout

Use `wrangler.galera.jsonc` and explicitly select the verified account through `CLOUDFLARE_ACCOUNT_ID`. The configuration keeps the existing remote image, `lite` size, maximum two instances, class names, bindings and migration tag `v1`. Upload a version with `--keep-vars --strict`, inspect its resource metadata against the current version, then activate that exact version. Version upload and activation avoid container builds, container rollouts and route changes. Never pass a secrets file or replace existing secret values.

The v1 guard runs as Worker version `27c7acd3-9c25-423b-97f1-63ab05ed30b2`; the pre-guard rollback baseline is `b887ad0b-1c63-4410-9db4-89a03e0fa901`. Before activation, confirm that `27c7acd3` is still the active version. Additive SQL tables survive a code rollback. During verification, destroy every synthetic credential-bearing sandbox before reverting to a pre-guard version. Rolling v2 back to v1 recreates an empty latch table, so seats filled under v2 stay observable under v1 until their next fill. Rolling back to the pre-guard version removes the vault endpoints; Galera then fails closed because the capability is missing.
