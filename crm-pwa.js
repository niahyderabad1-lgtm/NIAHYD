'use strict';
const installButton=document.querySelector('#install-crm');
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.hidden=false;});
window.addEventListener('appinstalled',()=>{installButton.hidden=true;installPrompt=null;});
installButton.addEventListener('click',async()=>{
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;installButton.hidden=true;return;}
 const message='On your phone, open the browser menu and choose Add to Home Screen.';
 window.alert(message);
});
if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!navigator.standalone)installButton.hidden=false;
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./crm-sw.js',{scope:'./'}).catch(()=>{}));
