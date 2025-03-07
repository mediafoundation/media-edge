# Available DNS Providers

This is a list of DNS providers that are supported.

- [Cloudflare](#cloudflare)
- Google Cloud DNS (coming soon)
- AWS Route 53 (coming soon)
- Azure DNS (coming soon)
- DigitalOcean (coming soon)
- [Your own plugin](#your-own-plugin)


## Cloudflare
To use Cloudflare as a DNS provider, you need to set `cloudflare` in the `dns_provider` field of the `provider.domain` object in your `user_config.yaml` file.

Example:

```yaml
providers:
  -    
    (...)
    domains:
      - 
        host: "yourdomain.com"
        (...)
        dns_provider: "cloudflare"
        env_vars:
          - CF_API_EMAIL=you@example.com
          - CF_API_KEY=b9841238feb177a84330febba8a83208921177bffe733
            # or
          - CF_DNS_API_TOKEN=1234567890abcdefghijklmnopqrstuvwxyz
```


### Credentials

| Environment Variable Name | Description |
|-----------------------|-------------|
| `CF_API_EMAIL` | Account email |
| `CF_API_KEY` | API key |
| `CF_DNS_API_TOKEN` | API token with DNS:Edit permission


## Custom DNS Povider
You can add your own custom dns provider by implementing the `DNSProvider` interface. The code should be placed in the `dnsProviders` directory, and the reference should be added to the `factory.ts` file.

```go
src/
└── services/
    └── dnsProviders/
        ├── DNSProvider.ts // interface
        ├── CustomProvider.ts // code here
        └── factory.ts // add reference here
```