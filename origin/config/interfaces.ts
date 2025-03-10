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
    addressIndex?: number;
    privateKey?: `0x${string}`;
    supportedChains: Network[];
    domains: Domain[];
}

export interface Network {
    id: number;
    URL?: string;
}

export interface Env {
    marketplace_id: number;
    db_name: string;
    db_user: string;
    db_password: string;
    db_host: string;
    db_port: number;
    db_dialect: "postgres" | "mysql" | "sqlite" | "mariadb" | "mssql";
    caddy_url: string;
    elasticsearch_url: string;
    email: string;
    providers: Provider[];
    debug?: boolean;
}