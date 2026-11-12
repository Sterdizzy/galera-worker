/** Bot-visible result while a guarded fill is in progress. */
export const SIGNING_IN = 'Signing in, try again in a moment.';

/** A short, in-memory privacy window around one guarded fill. It opens when a preparation
 * succeeds and closes when the fill completes or fails, when the challenge expires, or when
 * control changes. Nothing is persisted, so a cold Durable Object never stays blocked. */
export class FillWindow {
  private until = 0;
  private busy = 0;
  constructor(private now: () => number = () => Date.now()) {}
  /** A prepared challenge holds the window until its expiry at most. */
  open(expiresAt: number) { this.until = expiresAt; }
  /** A fill holds the window regardless of expiry until end(). */
  begin() { this.busy++; }
  end() { this.busy = Math.max(0, this.busy - 1); if (!this.busy) this.until = 0; }
  /** Ends a prepared-but-unused window. An in-flight fill still holds it until end(). */
  close() { this.until = 0; }
  get active(): boolean { return this.busy > 0 || this.until > this.now(); }
}
