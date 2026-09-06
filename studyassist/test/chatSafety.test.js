import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessages,reportableId,storePreferences } from '../src/utils/chatSafety.js';
test('invalid message histories cannot reach the chat renderer',()=>{
 for(const input of [null,{},'bad',42]) assert.deepEqual(normalizeMessages(input),[]);
 const valid={id:1,role:'assistant',content:'Saved answer'};
 assert.deepEqual(normalizeMessages([null,{role:'assistant',content:{}},valid]),[valid]);
});
test('numeric and temporary message IDs do not crash the report control',()=>{
 for(const id of [5,null,undefined,{},'stream-1']) assert.equal(reportableId(id),false);
 assert.equal(reportableId('00000000-0000-4000-8000-000000000001'),true);
});
test('blocked storage does not crash the preference effect',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage disabled');}});
 try{assert.equal(storePreferences({defaultMode:'ask'}),false);}finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});
