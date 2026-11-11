import credentialRuntimeSource from './vault-runtime.js.txt';
import type { Page } from '@cloudflare/playwright';

export const VAULT_CAPABILITY = 'vault.fill_login_guarded.v1';
export const VAULT_IMPLEMENTATION = 'galera-vault-2026-11-11.1';
export type CredentialField = 'username' | 'password' | 'totp';
export const vaultCapabilities = () => ({ capability: VAULT_CAPABILITY, implementation: VAULT_IMPLEMENTATION, privacy: 'content-hidden' });
export const guardFailure = () => new Error('The credential target could not be verified.');

export function exactOrigin(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw guardFailure();
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.origin !== value || u.username || u.password) throw guardFailure();
  return value;
}
export function credentialField(value: unknown): CredentialField {
  if (value !== 'username' && value !== 'password' && value !== 'totp') throw guardFailure();
  return value;
}

/** Browser runtime is loaded as text to keep bundler name helpers out of the isolated world.
 * The runtime runs only in a CDP isolated world. Page scripts cannot replace these native prototypes or
 * access the closure's document, node and form identities. The final validation and setter run
 * synchronously in one browser task, without any locator lookup or asynchronous gap. */

type Session = { send(method: string, args?: Record<string, unknown>): Promise<any>; detach(): Promise<void> };
export class PreparedCredential {
  private constructor(private cdp: Session, private objectId: string) {}
  static async create(page: Page, origin: string, field: CredentialField): Promise<PreparedCredential> {
    let cdp: Session | undefined;
    try {
      cdp = await page.context().newCDPSession(page) as unknown as Session;
      const tree = await cdp.send('Page.getFrameTree');
      if (new URL(tree.frameTree.frame.url).origin !== origin) throw guardFailure();
      const world = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'galera-vault-v1' });
      const installed = await cdp.send('Runtime.evaluate', { expression: `(${credentialRuntimeSource})()`, contextId: world.executionContextId, returnByValue: false, silent: true });
      if (installed.exceptionDetails || !installed.result?.objectId) throw guardFailure();
      const result = await cdp.send('Runtime.callFunctionOn', { objectId: installed.result.objectId, functionDeclaration: 'function(origin, field) { return this.prepare(origin, field); }', arguments: [{ value: origin }, { value: field }], returnByValue: true, silent: true });
      if (result.exceptionDetails || result.result?.value?.ok !== true) throw guardFailure();
      return new PreparedCredential(cdp, installed.result.objectId);
    } catch { await cdp?.detach().catch(() => {}); throw guardFailure(); }
  }
  async fill(value: string): Promise<void> {
    try {
      const result = await this.cdp.send('Runtime.callFunctionOn', { objectId: this.objectId, functionDeclaration: 'function(value) { return this.fill(value); }', arguments: [{ value }], returnByValue: true, silent: true });
      if (result.exceptionDetails || result.result?.value?.ok !== true) throw guardFailure();
    } catch { throw guardFailure(); }
    finally { await this.close(); }
  }
  async close() { await this.cdp.send('Runtime.releaseObject', { objectId: this.objectId }).catch(() => {}); await this.cdp.detach().catch(() => {}); }
}
