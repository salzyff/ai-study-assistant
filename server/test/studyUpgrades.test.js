import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY='test';
process.env.GEMINI_API_KEY='test';
const {supabase}=await import('../src/supabase.js');
const {default:router}=await import('../src/routes/studyUpgradeRoutes.js');
const id='00000000-0000-4000-8000-000000000001';
test('quiz recovery and reporting enforce ownership, hide answers and protect admin queue',async()=>{
 const original=supabase.from; let owner=false,submitted=false; const filters=[];
 supabase.from=table=>{ const query={select(){return this;},eq(k,v){filters.push([table,k,v]);return this;},order(){return this;},limit(){return this;},range(){return this;},maybeSingle(){return this;},upsert(){return this;},then(resolve){let data=null;if(table==='quizzes'||table==='conversations')data=owner?{id,mode:'practice'}:null;if(table==='quiz_attempts')data=submitted?{id}:null;if(table==='quiz_questions')data=[{id,question:'Q',options:['a','b','c','d']}];if(table==='answer_reports')data=[];return Promise.resolve({data,error:null}).then(resolve);}};return query;};
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:'student',app_metadata:{role:req.headers['x-role']||'member'}};next();});app.use(router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=(path,method='GET',body,role='member')=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'content-type':'application/json','x-role':role},...(body?{body:JSON.stringify(body)}:{})});
 try{
 assert.equal((await call('/answer-reports')).status,403);
 assert.equal((await call(`/answer-reports/${id}`,'PATCH',{status:'reviewed'})).status,403);
 assert.equal((await call(`/quiz/${id}`)).status,404);
 assert.equal((await call('/answer-reports','POST',{kind:'chat',sourceId:id,containerId:id,reason:'Incorrect'})).status,404);
 owner=true;const recovered=await(await call(`/quiz/${id}`)).json();assert.equal(recovered.questions[0].correct_option,undefined);assert.ok(filters.some(([t,k,v])=>t==='quizzes'&&k==='user_id'&&v==='student'));
 submitted=true;assert.equal((await call(`/quiz/${id}`)).status,409);
 assert.equal((await call('/quiz/invalid')).status,400);
 assert.equal((await call('/answer-reports','POST',{kind:'invalid',sourceId:id,containerId:id,reason:'x'})).status,400);
 assert.equal((await call('/answer-reports?status=invalid','GET',null,'admin')).status,400);
 assert.equal((await call('/answer-reports','GET',null,'admin')).status,200);
 }finally{supabase.from=original;await new Promise(r=>server.close(r));}
});
