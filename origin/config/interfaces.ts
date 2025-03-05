export interface Domain {
    host: string;
    a_record?: string[];
    cname?: string;
    dns_provider?: "cloudflare" | "route53" | "google" | "digitalocean";
    env_vars?: any;
    email?: string;
}

export interface Provider {
    wallet_address?: `0x${string}`;
    mnemonic?: string;
    accountIndex?: number;
    privateKey?: `0x${string}`;
    supportedChains?: Network[];
    domains: Domain[];
}

export interface Network {
    id: number;
    URL?: string;
}

export interface Env {
    MARKETPLACE_ID: number;
    dbName: string;
    dbUser: string;
    dbPassword: string;
    dbHost: string;
    dbPort: number;
    dbDialect: "postgres" | "mysql" | "sqlite" | "mariadb" | "mssql";
    caddyUrl: string;
    elasticSearchUrl: string;
    debug?: boolean;
    providers: Provider[];
}