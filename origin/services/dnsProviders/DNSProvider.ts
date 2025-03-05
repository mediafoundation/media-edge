import { Domain } from "../../config/interfaces";

export interface DNSProvider {
  /**
   * Sets up the DNS-01 challenge.
   * The provider should handle computing the required TXT record name and value.
   * Returns a record identifier (or any value needed to later remove the record).
   */
  set(keyAuthorization: string, domain: Domain): Promise<void>;

  /**
   * Removes the DNS-01 challenge record.
   */
  remove(keyAuthorization: string, domain: Domain): Promise<void>;
}
