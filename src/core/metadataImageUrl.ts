/** Reviewed image hosts, separate from API hosts. Empty policy fails closed.
 * This pure check does not resolve DNS or control redirects in native/web Image.
 */
export type MetadataImageHostPolicy = Readonly<{
  exactHosts: readonly string[];
  subdomainHosts?: readonly string[];
}>;

export const NO_METADATA_IMAGE_HOSTS: MetadataImageHostPolicy = Object.freeze({ exactHosts: Object.freeze([]) });

export function metadataImageUrl(value: unknown, policy: MetadataImageHostPolicy): string | null {
  if (typeof value !== "string" || value.length > 4096 ||
      /[\s\u0000-\u001f\u007f-\u009f\\]/u.test(value) || /%(?![0-9a-f]{2})/i.test(value) ||
      !/^https:\/\//i.test(value)) return null;
  const authority = /^https:\/\/([^/?#]+)/i.exec(value)?.[1];
  if (!authority || /[@%]/.test(authority)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    // Reject IP literals altogether, including URL-normalized octal/hex IPv4 and mapped IPv6.
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !host.includes(".") || host.endsWith(".") || host.includes(":") || host.includes("[") ||
        /^[0-9.]+$/.test(host) ||
        /(?:^|\.)(?:localhost|local|internal|home|lan)$/.test(host) ||
        !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
    const matches = policy.exactHosts.some(allowed => host === allowed.toLowerCase()) ||
      (policy.subdomainHosts ?? []).some(allowed => {
        const canonical = allowed.toLowerCase();
        return canonical.includes(".") && (host === canonical || host.endsWith(`.${canonical}`));
      });
    // Return the received URL, not a fabricated/rewritten variant.
    return matches ? value : null;
  } catch { return null; }
}
