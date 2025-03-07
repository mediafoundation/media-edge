import { DNSProvider } from "./DNSProvider";
import { CloudflareProvider } from "./CloudflareProvider";

/**
 * Returns an instance of the configured DNS provider.
 * Note: This function is asynchronous because the Cloudflare provider
 * needs to look up the zone ID.
 */
export async function getDNSProvider(domain): Promise<DNSProvider> {
  switch (domain.dns_provider) {
    case "cloudflare": {
      return await CloudflareProvider.create(domain);
    }
    // Add cases for other providers as needed.
    default:
      throw new Error("Unsupported DNS provider");
  }
}
