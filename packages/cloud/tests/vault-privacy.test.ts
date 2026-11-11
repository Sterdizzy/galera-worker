import {test,expect} from 'vitest';
import {CredentialPrivacy} from '../src/vault-privacy';
test('credential latch suppresses arbitrary plaintext, encoded content and future cold state',()=>{
 const privacy=new CredentialPrivacy();expect(privacy.text('ordinary page')).toBe('ordinary page');
 privacy.add('synthetic-password');expect(privacy.opaque).toBe(true);
 for(const value of ['synthetic-password',btoa('synthetic-password'),'654321','an unrelated page label'])expect(privacy.text(value)).toMatch(/content hidden/);
 expect(JSON.stringify(privacy)).not.toContain('synthetic-password');
 const cold=new CredentialPrivacy(true);cold.add('new-value');expect(cold.opaque).toBe(true);expect(cold.text('older-value')).toMatch(/content hidden/);
});
