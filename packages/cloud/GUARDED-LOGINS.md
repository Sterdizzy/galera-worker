# Guarded website logins

This fork adds the credential guard used by [Galera](https://github.com/Sterdizzy/galera). Existing cloud computers, device authentication, namespaces and container settings are retained. No new class migration is required.

## Browser boundary

Authenticated clients prepare a field before reading a secret. Preparation returns a single-use challenge, valid for 60 seconds, bound to the device-owned seat, current page, document, input, form and control generation. Filling rechecks everything in one synchronous browser task inside a CDP isolated world. The native setter bypasses page prototype replacements.

The guard requires an exact HTTPS security origin, an unambiguous visible and enabled top-document input, and a same-origin POST form. Password fields exclude new-password controls. Two-factor fields require the one-time-code autocomplete token. Username fields require username autocomplete or email input type. Changed nodes, form actions, submit overrides, frame targets, documents, origins, expired challenges and replay are refused. It neither navigates nor submits the form.

Prepare, fill, ordinary browser actions and disposal share a seat queue. Human takeover changes its generation immediately and waits for in-flight work before acknowledging control. An earlier failed operation cannot make that acknowledgement fail.

The browser runtime is a text asset so Wrangler cannot introduce closure-dependent compiler helpers into the isolated world. Tests exercise that asset in real Chromium.

## Content secrecy

Before setting a credential, the Durable Object persists a latch containing only the public origin. It stores no password, two-factor code, setup key or digest of a low-entropy secret. Once latched, Bot-visible content and screenshots are suppressed for the entire sandbox seat lifetime, including later actions, files, errors and receipt replays. Page-derived content is not collected for subsequent browser observations, and screenshots are not captured. A page can encode a secret arbitrarily, so string replacement is not the security boundary.

This deliberately limits autonomous browsing after login. The authenticated human live viewer remains available, and further saved fields can still be filled by reference. Restarting the browser closes the old browser but retains the latch because sandbox files and outstanding commands can retain credential content. A fresh Bot with a separate sandbox is required for public observations. A cold Durable Object retains content suppression without needing any secret in storage. Direct requests to another origin are refused while the credential session is active. The approved site itself necessarily receives the filled credential and is trusted with it.

## Verification

Run the cloud package typecheck and unit tests using installed dependencies. Galera's explicit cross-repository test uses the real Worker fetch handler, SQLite statements, browser implementation and Chromium; only the Cloudflare transport is local. It checks authenticated approval-to-fill, stale origins and nodes, changed forms, duplicate fields, takeover ordering, replay, prototype tampering, encoded page echoes, cold starts, content suppression and persisted receipts.

```sh
node tests/vault-worker-e2e.mjs /path/to/galera-worker/packages/cloud /path/to/installed/chrome
```

That command runs from the Galera repository. It uses synthetic credentials and fulfills browser requests locally. The separately invoked live verifier creates and disposes only a newly generated synthetic seat on the existing Worker.

## Existing Worker rollout

Use `wrangler.galera.jsonc` and explicitly select the verified account through `CLOUDFLARE_ACCOUNT_ID`. The configuration keeps the existing remote image, `lite` size, maximum two instances, class names, bindings and migration tag `v1`. Upload a version with `--keep-vars --strict`, inspect its resource metadata against the current version, then activate that exact version. Version upload and activation avoid container builds, container rollouts and route changes. Never pass a secrets file or replace existing secret values.

The captured rollback baseline is Worker version `b887ad0b-1c63-4410-9db4-89a03e0fa901`. Before activation, confirm that it is still the deployed baseline. Additive SQL tables survive a code rollback. During verification, destroy every synthetic credential-bearing sandbox before reverting to a pre-guard version. After real users adopt guarded filling, a rollback must retain the privacy boundary or destroy affected sandboxes first; reverting to old code alone could expose a retained page.
