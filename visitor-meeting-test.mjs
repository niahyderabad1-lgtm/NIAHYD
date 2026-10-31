import assert from 'node:assert/strict';
let handler,lookupFails=false,publishedDate='2026-11-11',order=null,captured=[],rpOrders=[],requests=[];
const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'fixture-secret',RAZORPAY_WEBHOOK_SECRET:'fixture-hook'};
globalThis.Deno={env:{get:k=>env[k]},serve:h=>handler=h};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
globalThis.fetch=async(url,opt={})=>{requests.push([url,opt.method||'GET']);
 if(url.includes('/rpc/nia_config_read'))return json(null);
 if(url.includes('/meeting_settings?'))return lookupFails?json({},503):json([{meeting_date:publishedDate,start_time:'18:00:00',end_time:'21:00:00',venue:'Novotel HICC Hyderabad',address:'',revision:2}]);
 if(url.includes('/rpc/capture_visitor')){captured.push(JSON.parse(opt.body));return json('11111111-1111-4111-8111-111111111111');}
 if(url.includes('/visitor_requests?')&&url.includes('select=leads'))return json([{leads:{attribution:{event:'2026-11-11'}}}]);
 if(url.includes('/visitor_requests?'))return json([{request_id:rid,created_at:new Date().toISOString()}]);
 if(url.includes('/visitor_test_orders?'))return json(order?[order]:[]);
 if(url.endsWith('/visitor_test_orders')){order=JSON.parse(opt.body);return json(null,201);}
 if(url==='https://api.razorpay.com/v1/orders'){rpOrders.push(JSON.parse(opt.body));return json({id:'order_fixture',amount:260000,currency:'INR'});}
 throw Error('Unexpected mocked request: '+url);
};
await import('./visitor-intake.ts');
const rid='22222222-2222-4222-8222-222222222222';
const data={request_id:rid,name:'Fictional QA',company:'Fictional company',category:'QA',phone:'9999999998',consent:true,route:'whatsapp',attribution:{event:'1900-01-01',utm_campaign:'fixture'}};
const req=b=>new Request('https://function.invalid',{method:'POST',headers:{origin:'https://niahyderabad1-lgtm.github.io','content-type':'application/json'},body:JSON.stringify(b)});
assert.equal((await handler(req(data))).status,200);
assert.equal(captured[0].p_attribution.event,'2026-11-11');assert.equal(captured[0].p_attribution.event_revision,'2');assert.equal(captured[0].p_attribution.event_venue,'Novotel HICC Hyderabad');assert.equal(captured[0].p_attribution.utm_campaign,'fixture');
lookupFails=true;assert.equal((await handler(req({...data,request_id:'33333333-3333-4333-8333-333333333333'}))).status,503);assert.equal(captured.length,1);lookupFails=false;
assert.equal((await handler(req({...data,consent:false}))).status,400);assert.equal(captured.length,1);
publishedDate='2026-11-18';
assert.equal((await handler(req({action:'create_order',request_id:rid}))).status,200);assert.equal(rpOrders[0].notes.event,'NIA Hyderabad visitor 2026-11-11');
// Retrying an existing order must reuse it, even if the meeting lookup is unavailable.
lookupFails=true;assert.equal((await handler(req({action:'create_order',request_id:rid}))).status,200);assert.equal(rpOrders.length,1);
assert(!requests.some(([url,method])=>method==='PATCH'&&url.includes('/leads')));
assert.equal((await handler(new Request('https://function.invalid?webhook=razorpay',{method:'POST',body:'{}'}))).status,400);
console.log('PASS: server-owned meeting attribution, browser event spoof ignored, unavailable meeting prevents mislabelled leads, consent gate, enquiry-linked test order notes, order reuse and invalid webhook rejection. All requests mocked; no contacts or payments created.');
