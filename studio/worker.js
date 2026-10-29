/**
 * NEXUS STUDIO — Cloudflare Worker entry.
 *
 * The Worker exists only to add honest headers to a static bundle. All rendering
 * happens in the browser, so there is nothing to compute here and nothing to pay
 * for per export.
 */
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    // WebCodecs + MediaRecorder run same-origin; no external hosts are needed.
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
