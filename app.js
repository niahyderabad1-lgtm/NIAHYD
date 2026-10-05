'use strict';
document.querySelector('#lead-form').addEventListener('submit',event=>{
 event.preventDefault();
 const status=document.querySelector('#status');
 if(event.submitter?.value==='payment'){
 status.textContent='Online payment is being configured. No payment has been taken and no seat has been reserved. Choose “Speak to NIA before booking” to contact our team.';
 }else{
 const data=new FormData(event.currentTarget);
 const message=`Hello NIA Hyderabad! I am interested in the visitor meeting on 14 October 2026 from 6:00–9:00 PM IST, followed by dinner, at Novotel HICC Hyderabad (₹2,600 including taxes and dinner).\nName: ${data.get('name')}\nWhatsApp: ${data.get('phone')}\nBusiness: ${data.get('company')}\nCategory: ${data.get('category')}${data.get('email')?'\nEmail: '+data.get('email'):''}\nPlease help me with the visitor booking.`;
 const a=document.createElement('a');a.href='https://wa.me/917997994493?text='+encodeURIComponent(message);a.target='_blank';a.rel='noopener';a.click();
 status.textContent='Press Send in WhatsApp to share your enquiry with NIA. Opening WhatsApp does not send the message or reserve a seat. Your details have not been saved in the CRM.';
 }
 status.scrollIntoView({block:'nearest',behavior:'smooth'});
});
