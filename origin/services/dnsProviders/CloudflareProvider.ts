import { DNSProvider } from "./DNSProvider";
import { Domain } from "../../config/interfaces";

// Import the plugin via require (CommonJS)
const acmeDnsCloudflare = require("acme-dns-01-cloudflare");

export class CloudflareProvider implements DNSProvider {
  private dns: any;

  private constructor(dns: any) {
    this.dns = dns;
  }

  /**
   * Factory method to create a CloudflareProvider.
   * It uses the domain's env_vars to configure the provider.
   * The user can supply either an API token or email + global API key.
   */
  public static async create(domain: Domain): Promise<CloudflareProvider> {
    const env = domain.env_vars;
    let config: any = {}; // Only credentials are needed

    if (env.CF_API_TOKEN) {
      config.token = env.CF_API_TOKEN;
    } else if (env.CF_EMAIL && env.CF_API_KEY) {
      config.email = env.CF_EMAIL;
      config.key = env.CF_API_KEY;
    } else {
      throw new Error("Missing Cloudflare credentials: provide either CF_API_TOKEN or both CF_EMAIL and CF_API_KEY");
    }

    //config.verifyPropagation = true;
    config.verbose = true;

    // Instantiate the acme-dns-01-cloudflare adapter using "new".
    console.log("acme-dns-01-cloudflare", acmeDnsCloudflare);
    const dns = new acmeDnsCloudflare(config);
    console.log("Cloudflare DNS provider initialized", dns);
    const provider = new CloudflareProvider(dns);
    console.log("Cloudflare provider created", provider);
    return provider;
  }

  async set(keyAuthorization: string, domain: Domain): Promise<void> {
    const host = domain.host.replace(/^\*\./, "");
    await this.dns.set({ challenge: {
      // The plugin will compute dnsPrefix and dnsZone internally.
      dnsAuthorization: keyAuthorization,
      //remove *. from the *.domain.host
      dnsZone: host,
      dnsPrefix: "_acme-challenge"
    }});
  }

  async remove(keyAuthorization: string, domain: Domain): Promise<void> {
    const host = domain.host.replace(/^\*\./, "");
    await this.dns.remove({ challenge: {
      dnsAuthorization: keyAuthorization,
      dnsZone: host,
      dnsPrefix: "_acme-challenge"
    }});
  }
}
