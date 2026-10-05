'use strict';
const form=document.querySelector('#lead-form'),status=document.querySelector('#status');
const config=window.NIA_CONFIG||{};let requestId=crypto.randomUUID(),busy=false;
const params=new URLSearchParams(location.search),attribution={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])attribution[k]=(params.get(k)||'').slice(0,200);
const testPayments=params.get('test_payment')==='1';
const api=async body=>{const r=await fetch(config.supabaseUrl+'/functions/v1/visitor-intake',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error||'Unable to complete this request.');return result;};
const checkoutScript=()=>new Promise((resolve,reject)=>{if(window.Razorpay)return resolve();const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=()=>resolve();script.onerror=()=>reject(Error('Unable to open Razorpay. Please retry.'));document.head.append(script);});
if(testPayments){document.querySelector('.preview').textContent='TEST CHECKOUT · No real money is collected and no event seat is reserved.';form.querySelector('button[value="payment"]').textContent='Try test checkout · ₹2,600';form.querySelector('.micro').textContent='Test payments simulate checkout only. Your enquiry is saved in the CRM. No seat is reserved.';}
const openTestCheckout=async data=>{
 const paymentRequestId=requestId;
 const order=await api({action:'create_order',request_id:paymentRequestId});
 if(order.test_mode!==true)throw Error('Test checkout is unavailable.');
 if(order.already_verified){status.textContent='This test payment is already verified. No real money was collected and no seat is reserved.';return;}
 await checkoutScript();
 await new Promise(resolve=>{
  const checkout=new window.Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,order_id:order.order_id,name:'NIA Hyderabad',description:'TEST ONLY · Visitor meeting · 14 October 2026',prefill:{name:data.name,contact:data.phone,...(data.email?{email:data.email}:{})},theme:{color:'#041c43'},modal:{ondismiss:()=>{status.textContent='Test checkout closed. Your enquiry remains saved. No seat is reserved.';resolve();}},handler:async result=>{
   status.textContent='Checking test payment with Razorpay…';
   try{const verified=await api({action:'verify_payment',request_id:paymentRequestId,...result});if(!verified.verified||!verified.test_mode)throw Error('Test payment verification is incomplete.');status.textContent='Test payment verified. Reference: '+verified.payment_id+'. No real money was collected and no event seat is reserved.';}
   catch(e){status.textContent=e.message+' If checkout reported success, contact NIA before trying again.';}
   resolve();
  }});
  checkout.on('payment.failed',()=>{status.textContent='Test payment failed. You can retry checkout or speak to NIA.';});checkout.open();
 });
};
form.addEventListener('input' ,()=>{requestId=crypto.randomUUID();document.querySelector('#whatsapp-next')?.remove()});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const data=Object.fromEntries(new FormData(form));const route=event.submitter?.value||'whatsapp';let saved=false;
 const phone=String(data.phone).replace(/\D/g,'');if(!/^(91)?[6-9][0-9]{9}$/.test(phone)){status.textContent='Enter a valid 10-digit Indian mobile number, with optional +91.';return}
 for(const k of ['name','company','category'])if(!data[k].trim()){status.textContent='Please complete your name and business details.';return}
 busy=true;for(const b of form.querySelectorAll('button'))b.disabled=true;document.querySelector('#whatsapp-next')?.remove();
 try{
  if(config.intakeEnabled){status.textContent='Saving your visitor enquiry…';const response=await fetch(config.supabaseUrl+'/functions/v1/visitor-intake',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify({...data,route,consent:true,request_id:requestId,attribution})});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save your enquiry. Please try again.');saved=true;}
  if(route==='payment'&&testPayments){await openTestCheckout(data);}else if(route==='payment'){status.textContent=(saved?'Your enquiry is saved. ':'')+'Online payment is being configured. No payment has been taken and no seat is reserved. You can speak with NIA before booking.';}
  else status.textContent=(saved?'Your enquiry is saved in the NIA CRM. ':'')+'Continue to WhatsApp, then press Send to share your message. An enquiry does not reserve a seat.';
  const message=`Hello NIA Hyderabad! I am interested in the visitor meeting on 14 October 2026, 6–9 PM followed by dinner, at Novotel HICC Hyderabad (₹2,600 including taxes and dinner).\nName: ${data.name}\nWhatsApp: ${data.phone}\nBusiness: ${data.company}\nCategory: ${data.category}${data.email?'\nEmail: '+data.email:''}\nPlease help me with the visitor booking.`;
  const a=document.createElement('a');a.id='whatsapp-next';a.className='button';a.textContent='Continue to WhatsApp ↗';a.href='https://wa.me/917997994493?text='+encodeURIComponent(message);a.target='_blank';a.rel='noopener';status.after(a);
 }catch(e){status.textContent=e.message+' Your booking is not confirmed.';}finally{busy=false;for(const b of form.querySelectorAll('button'))b.disabled=false;status.scrollIntoView({block:'nearest',behavior:'smooth'})}
});

const panel=document.querySelector('.booking-panel');let frame;function fitPanel(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(matchMedia('(min-width:761px)').matches){const top=Math.max(16,panel.getBoundingClientRect().top);panel.style.maxHeight=Math.max(240,innerHeight-top-16)+'px'}else panel.style.maxHeight=''})}addEventListener('scroll',fitPanel,{passive:true});addEventListener('resize',fitPanel);fitPanel();
