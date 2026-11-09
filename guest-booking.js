'use strict';
window.NiaGuestBooking={paymentsOpen:false};
(()=>{
 const config=window.NIA_CONFIG||{};
 const button=document.querySelector('button[data-route="payment"]');
 const paid=document.querySelectorAll('[data-paid-only]');
 const intro=document.querySelector('#booking-intro');
 const bookingTitle=document.querySelector('.booking-panel .eyebrow');
 const officeButton=document.querySelector('button[data-route="office_meetup"]');
 const notice=document.createElement('p');notice.className='form-note';notice.id='booking-availability';intro.after(notice);
 function show(open){window.NiaGuestBooking.paymentsOpen=open;button.hidden=!open;paid.forEach(el=>el.hidden=!open);bookingTitle.textContent=open?'NIA Hyderabad’s monthly meet':'Visit the NIA Office';intro.textContent=open?'Choose a guest meeting booking or a one-to-one office visit.':'Book a one-to-one visit to the NIA Office. Choose an available date and time below.';officeButton.textContent=open?'Have more questions? Visit NIA Office ↗':'Book an office visit ↗';notice.textContent=open?'Guest payment closes automatically 28 hours before the meeting starts.':'Guest payment is closed. Office visits remain available.';const faq=document.querySelectorAll('.faq details');if(!open){faq[3].querySelector('summary').textContent='Can I talk to someone before a guest meeting?';faq[3].querySelector('p').textContent='Yes. Book a one-to-one office visit to discuss NIA - Network In Action and the next guest meeting.';faq[5].hidden=true;}else faq[5].hidden=false;}
 async function refresh(){try{const [meeting,settings]=await Promise.all([NiaMeeting.refresh(),fetch(config.supabaseUrl+'/rest/v1/guest_booking_settings?id=eq.1&select=accept_payments',{headers:{apikey:config.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error('Settings unavailable');return (await r.json())[0]})]);const cutoff=Date.parse(meeting.meeting_date+'T'+meeting.start_time.slice(0,5)+':00+05:30')-28*60*60*1000;show(settings?.accept_payments===true&&Number.isFinite(cutoff)&&Date.now()<cutoff);}catch{show(false);}}
 show(false);refresh();setInterval(refresh,60000);
})();
