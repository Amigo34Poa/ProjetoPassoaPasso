import {describe,it,expect} from 'vitest';
// @ts-expect-error Plain JavaScript server module.
import {validOrigin,sessionStore,publicError} from '../../server/security.mjs';
describe('local API protection',()=>{
  it('rejects another origin while accepting the local application origin',()=>{expect(validOrigin({headers:{host:'127.0.0.1:4317',origin:'https://attacker.example'}})).toBe(false);expect(validOrigin({headers:{host:'127.0.0.1:4317',origin:'http://127.0.0.1:4317'}})).toBe(true);});
  it('does not recover an invented cookie as an authenticated session',()=>{const store=sessionStore();expect(store.fromCookie({headers:{cookie:`playbook_session=${'a'.repeat(48)}`}})).toBeUndefined();let cookie='';const s=store.get({headers:{}},{cookie:(_name:string,value:string)=>{cookie=value;}});expect(s.apiKeys).toEqual({gemini:'',openai:''});expect(store.fromCookie({headers:{cookie:`playbook_session=${cookie}`}})).toBe(s);});
  it('never includes upstream errors or keys in public failures',()=>{const text=publicError({message:'SECRET-API-KEY',status:401});expect(text).not.toContain('SECRET');expect(text).toContain('credencial');});
});
