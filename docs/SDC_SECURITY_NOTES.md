# Dashboard password and upload security

## Password

`server/index.ts` used to fall back to `aaaa` whenever `DASHBOARD_PASSWORD` was unset. That fallback still exists for a local tracker. When `TRUST_PROXY=1`, the process now exits unless `DASHBOARD_PASSWORD` is set, is at least 8 characters, and is not `aaaa`, `password`, `admin`, or `changeme`.

The tracker that is already running was started with the old password and was not restarted. Sign-in on that process is unchanged. `start-eepydog.ps1` no longer writes `aaaa` into the environment. The next time that public process has to start, set a new password first:

1. Sign in to the current dashboard and use Change password. The form requires 8 or more characters.
2. Set that same value as `DASHBOARD_PASSWORD` in the environment used by `start-eepydog.ps1`.
3. Restart the tracker.

The stored hash is used after the first boot. A new environment password does not replace an existing hash; change it in the dashboard, then keep the environment value for a fresh data directory.

Do not commit the password or the `data/` directory.

## Uploads

Photo upload is not enabled. A file input on GitHub Pages would only preview a picture in the browser. A real club gallery needs private pending storage, type and size checks, EXIF removal, rate limits, moderation before anything is public, and a way for someone to report or delete a photo. No service keys were added.
