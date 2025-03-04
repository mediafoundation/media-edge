import acmeDnsCloudflare from "acme-dns-01-cloudflare";
import { DNSProvider } from "./DNSProvider";
import { Domain } from "../../config/interfaces";

export class CloudflareProvider implements DNSProvider {
  private dns: any;

  private constructor(dns: any) {
    this.dns = dns;
  }

  /**
   * Factory method to create a CloudflareProvider.
   * The user configuration is simplified: you supply either an API token or email + global API key,
   * plus the domain (which will be used for zone lookup internally by the package).
   */
  public static async create(domain: Domain): Promise<CloudflareProvider> {
    const env = domain.env_vars;
    const config: any = { ttl: 120, zone: domain };

    if (env.CF_API_TOKEN) {
      config.token = env.CF_API_TOKEN;
    } else if (env.CF_EMAIL && env.CF_API_KEY) {
      config.email = env.CF_EMAIL;
      config.key = env.CF_API_KEY;
    } else {
      throw new Error("Missing Cloudflare credentials: provide either CF_API_TOKEN or both CF_EMAIL and CF_API_KEY");
    }

    // Initialize the acme-dns-01-cloudflare adapter.
    const dns = acmeDnsCloudflare(config);
    return new CloudflareProvider(dns);
  }

  async setChallenge(keyAuthorization: string): Promise<string> {
    // The acme-dns-01-cloudflare package is designed to be compatible with ACME.js/Greenlock,
    // so we simply pass the keyAuthorization.
    // Assume the returned object has an "id" property that we can use to remove the record later.
    const result = await this.dns.setChallenge(keyAuthorization);
    return result.id;
  }

  async removeChallenge(keyAuthorization: string): Promise<void> {
    await this.dns.removeChallenge(keyAuthorization);
  }
}
