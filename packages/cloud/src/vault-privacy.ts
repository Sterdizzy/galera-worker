/** The durable latch contains no secrets. Page-controlled text can encode or transform a
 * credential arbitrarily, so replacing known strings is not a secrecy boundary. Once a
 * credential is filled, all Bot-visible content stays hidden for the entire sandbox seat lifetime, including browser resets.
 * The independently authenticated human viewer remains available. */
export class CredentialPrivacy {
  constructor(public latched = false) {}
  add(_value?: string) { this.latched = true; }
  get opaque() { return this.latched; }
  text(value: string): string {
    return this.latched ? '[Credential session content hidden. Use Take over. A fresh Bot is required for public computer observations.]' : value;
  }
}
