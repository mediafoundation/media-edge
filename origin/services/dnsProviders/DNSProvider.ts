export interface DNSProvider {
  /**
   * Sets up the DNS-01 challenge.
   * The provider should handle computing the required TXT record name and value.
   * Returns a record identifier (or any value needed to later remove the record).
   */
  setChallenge(keyAuthorization: string): Promise<string>;

  /**
   * Removes the DNS-01 challenge record.
   */
  removeChallenge(keyAuthorization: string): Promise<void>;
}
