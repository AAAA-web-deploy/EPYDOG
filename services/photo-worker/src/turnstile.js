const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const PASS_SECRET = '1x0000000000000000000000000000000AA'
const DUMMY_SECRETS = new Set([
  PASS_SECRET,
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
])

/** Real secrets always call Cloudflare. Test mode only accepts Cloudflare's published dummy secret. */
export async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET_KEY || ''
  if (!secret) return { ok: false, error: 'Photo checks are not configured yet. Nothing was stored.' }
  if (!token || token.length > 2048) return { ok: false, error: 'Please complete the human check and try again.' }
  if (env.TURNSTILE_TEST_MODE === '1' && DUMMY_SECRETS.has(secret)) {
    const pass = secret === PASS_SECRET && token === DUMMY_TOKEN
    return pass ? { ok: true } : { ok: false, error: 'The human check was rejected.' }
  }
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (ip && ip !== 'unknown') body.set('remoteip', ip)
  let response
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch {
    return { ok: false, error: 'The human check could not be verified. Nothing was stored.' }
  }
  if (!response.ok) return { ok: false, error: 'The human check could not be verified. Nothing was stored.' }
  const payload = await response.json().catch(() => null)
  if (!payload?.success) return { ok: false, error: 'The human check was rejected.' }
  return { ok: true }
}
