import { LIMITS } from "@/config/limits";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "169.254.169.254",
  "[::1]",
  "0.0.0.0",
]);

const PUSH_HOST_ALLOWLIST = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "wns2-".toLowerCase(), // prefix match handled separately
];

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "::1" || host === "::") {
    return true;
  }
  // Unique-local and link-local IPv6 only (not hostnames that merely start with "fc").
  return (
    /^f[cd][0-9a-f]{2}:/i.test(host) ||
    host.startsWith("fe80:")
  );
}

function isAllowedPushHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === "fcm.googleapis.com" ||
    host.endsWith(".fcm.googleapis.com") ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host === "web.push.apple.com" ||
    host.endsWith(".web.push.apple.com") ||
    /^wns\d*-[a-z0-9.-]+\.notify\.windows\.com$/.test(host) ||
    host.endsWith(".notify.windows.com")
  ) {
    return true;
  }
  // Residual: unknown hosts are rejected. DNS rebinding remains a residual risk
  // for any host that later resolves privately; prefer platform egress controls.
  void PUSH_HOST_ALLOWLIST;
  return false;
}

export type PushEndpointValidation =
  | { ok: true; endpoint: string }
  | { ok: false; error: string };

export function validatePushEndpoint(raw: string): PushEndpointValidation {
  const endpoint = raw.trim();
  if (!endpoint || endpoint.length > LIMITS.pushEndpoint) {
    return { ok: false, error: "Invalid push endpoint." };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, error: "Invalid push endpoint." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Push endpoint must use HTTPS." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Invalid push endpoint." };
  }
  if (url.hash) {
    return { ok: false, error: "Invalid push endpoint." };
  }

  const hostname = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost") ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  ) {
    return { ok: false, error: "Invalid push endpoint." };
  }

  if (!isAllowedPushHost(hostname)) {
    return { ok: false, error: "Unsupported push service host." };
  }

  return { ok: true, endpoint };
}

export function validatePushKeys(p256dh: string, auth: string) {
  if (
    !p256dh ||
    p256dh.length > LIMITS.pushP256dh ||
    p256dh.length < 16 ||
    !auth ||
    auth.length > LIMITS.pushAuth ||
    auth.length < 8
  ) {
    return { ok: false as const, error: "Invalid push keys." };
  }
  return { ok: true as const };
}
