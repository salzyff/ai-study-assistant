import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequireAuth } from '../src/middleware/requireAuth.js';
const uid='11111111-1111-4111-8111-111111111111', sid='22222222-2222-4222-8222-222222222222';
const token=(sub=uid)=>`h.${Buffer.from(JSON.stringify({sub,session_id:sid})).toString('base64url')}.s`;
async function run({allowed=true, authError=null, rpcError=null, bearer=token(), userFields={}}={}) {
 let next=false, calls=0;
 const client={auth:{getUser:async()=>({data:{user:{id:uid,...userFields}},error:authError})},rpc:async(name,args)=>{
  calls++; assert.equal(name,'check_app_session'); assert.deepEqual(args,{p_session_id:sid,p_user_id:uid}); return {data:allowed,error:rpcError};
 }};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 await createRequireAuth(client)({headers:{authorization:`Bearer ${bearer}`}},res,()=>{next=true;}); return {res,next,calls};
}
test('verified live session reaches route with no-store',async()=>{const r=await run();assert.equal(r.next,true);assert.equal(r.res.headers['Cache-Control'],'no-store');});
test('expired or revoked session denied',async()=>{const r=await run({allowed:false});assert.equal(r.res.statusCode,401);assert.equal(r.next,false);});
test('database outage fails closed',async()=>{const r=await run({rpcError:{code:'offline'}});assert.equal(r.res.statusCode,503);assert.equal(r.next,false);});
test('invalid token cannot reach RPC',async()=>{const r=await run({authError:{}});assert.equal(r.calls,0);assert.equal(r.res.statusCode,401);});
test('mismatched user cannot reach RPC',async()=>{const r=await run({bearer:token('other')});assert.equal(r.calls,0);assert.equal(r.res.statusCode,401);});
test('malformed JWT fails closed',async()=>{const r=await run({bearer:'bad'});assert.equal(r.calls,0);assert.equal(r.res.statusCode,401);});
test('soft-deleted user is denied before session RPC',async()=>{const r=await run({userFields:{deleted_at:'2026-09-10T00:00:00Z'}});assert.equal(r.calls,0);assert.equal(r.res.statusCode,401);});
test('suspended user is denied before session RPC',async()=>{const r=await run({userFields:{banned_until:new Date(Date.now()+3600000).toISOString()}});assert.equal(r.calls,0);assert.equal(r.res.statusCode,401);});
test('expired suspension does not block a live session',async()=>{const r=await run({userFields:{banned_until:'2000-01-01T00:00:00Z'}});assert.equal(r.next,true);});
