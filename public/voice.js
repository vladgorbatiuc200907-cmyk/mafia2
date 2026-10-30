// Voce P2P experimentală. HTTPS necesar pe internet. Fără server TURN nu este garantată conexiunea.
(() => {
 'use strict';
 const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
 const peers=new Map();
 let joined=false,local=null,current=null,connectionGroup='',status='Voce dezactivată';
 const name='MAFIA';
 const self=()=>current?.me?.id;
 const canSend=s=>{
   if(!s?.me?.alive)return !!s&&!s.me.alive;
   if(['day','dayVote'].includes(s.phase))return true;
   if(s.phase==='defend')return s.nominees.includes(s.me.id);
   if(s.phase==='night')return s.me.team==='Mafia'||s.mediumPair.includes(s.me.id);
   return false;
 };
 const group=s=>{
   if(!s||s.phase==='lobby'||s.phase==='end')return 'off';
   if(!s.me.alive)return s.phase==='night'&&s.mediumPair.includes(s.me.id)?'medium':'dead';
   if(['day','dayVote','defend'].includes(s.phase))return 'public';
   if(s.phase==='night'&&s.me.team==='Mafia')return 'mafia';
   if(s.phase==='night'&&s.mediumPair.includes(s.me.id))return 'medium';
   return 'off';
 };
 const setStatus=t=>{status=t;const el=document.getElementById('voiceInfo');if(el)el.textContent=t;};
 function removePeer(id){const p=peers.get(id);if(!p)return;try{p.pc.close();}catch{}p.audio?.remove();peers.delete(id);}
 function clearPeers(){for(const id of [...peers.keys()])removePeer(id);}
 function paint(){
   const btn=document.getElementById('micButton');if(btn)btn.textContent=joined?'⏹️ Ieși din voce':'🎙️ Intră în canalul vocal';
   const text=!joined?'Voce dezactivată':group(current)==='off'?'Canal închis: așteaptă o etapă de comunicare.':
     `${local&&canSend(current)?'Microfon activ':'Asculți / microfon oprit'} · ${peers.size} conexiuni P2P`;
   setStatus(joined?text:status);
 }
 async function toggle(){
   if(joined){joined=false;socket.emit('voiceJoin',{joined:false});clearPeers();local?.getTracks().forEach(t=>t.stop());local=null;setStatus('Voce dezactivată');paint();return;}
   if(!current||current.phase==='lobby'||current.phase==='end'){setStatus('Intră întâi într-o partidă.');return;}
   if(!window.RTCPeerConnection){setStatus('Browserul nu suportă WebRTC.');return;}
   if(!window.isSecureContext){setStatus('Vocea necesită HTTPS (sau localhost).');return;}
   // Utilizatorul poate asculta și fără a acorda acces microfonului.
   try{local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});}
   catch{local=null;setStatus('Microfon indisponibil; te poți conecta ca ascultător.');}
   joined=true;socket.emit('voiceJoin',{joined:true});paint();
 }
 function makePeer(id){
   if(peers.has(id)||!joined||!current)return peers.get(id);
   const pc=new RTCPeerConnection(rtcConfig),audio=document.createElement('audio');
   audio.autoplay=true;audio.playsInline=true;audio.style.display='none';audio.dataset.peer=id;
   document.body.appendChild(audio);
   const peer={pc,audio,pending:[]};peers.set(id,peer);
   if(local&&canSend(current))for(const track of local.getAudioTracks())pc.addTrack(track,local);
   else pc.addTransceiver('audio',{direction:'recvonly'});
   pc.onicecandidate=e=>{if(e.candidate)socket.emit('rtcSignal',{to:id,signal:{type:'ice',candidate:e.candidate}});};
   pc.ontrack=e=>{audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.play().catch(()=>setStatus('Apasă pe ecran pentru a permite redarea audio.'));};
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){setStatus('Conexiune vocală eșuată. Unele rețele necesită TURN.');removePeer(id);}};
   return peer;
 }
 async function offer(id){const p=makePeer(id);if(!p)return;
   try{const o=await p.pc.createOffer();await p.pc.setLocalDescription(o);socket.emit('rtcSignal',{to:id,signal:{type:'sdp',description:p.pc.localDescription}});}
   catch(err){console.warn(name,'offer',err);}
 }
 async function handle({from,signal}={}){
   if(!joined||!current||!current.voicePeers.some(p=>p.id===from))return;
   const peer=makePeer(from);if(!peer)return;
   const pc=peer.pc;
   try{
     if(signal?.type==='sdp'){
       const desc=new RTCSessionDescription(signal.description);
       if(desc.type==='offer'){
         await pc.setRemoteDescription(desc);
         for(const c of peer.pending.splice(0))await pc.addIceCandidate(c);
         const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
         socket.emit('rtcSignal',{to:from,signal:{type:'sdp',description:pc.localDescription}});
       }else if(desc.type==='answer'&&pc.signalingState==='have-local-offer'){
         await pc.setRemoteDescription(desc);for(const c of peer.pending.splice(0))await pc.addIceCandidate(c);
       }
     }else if(signal?.type==='ice'){
       if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate);
       else peer.pending.push(signal.candidate);
     }
   }catch(err){console.warn(name,'signal',err);}
 }
 function sync(s){
   const oldGroup=connectionGroup;current=s;
   connectionGroup=group(s);
   if(!joined){paint();return;}
   if(oldGroup!==connectionGroup)clearPeers();
   // La schimbarea modului de vorbire (apărare) conexiunile se recreează cu drepturi noi.
   const allowedIds=new Set((s.voicePeers||[]).map(p=>p.id));
   for(const id of [...peers.keys()])if(!allowedIds.has(id))removePeer(id);
   if(connectionGroup!=='off')for(const other of (s.voicePeers||[]))if(self()<other.id&&!peers.has(other.id))offer(other.id);
   updatePermissions(s);paint();
 }
 function updatePermissions(s){
   if(!local||!s)return;
   const active=joined&&canSend(s)&&group(s)!=='off';
   for(const t of local.getAudioTracks())t.enabled=active;
   // Re-negociem când un ascultător devine vorbitor sau invers (ex. discuție -> apărare).
   for(const [id,p] of peers){
     const audioSender=p.pc.getSenders().find(x=>x.track?.kind==='audio');
     if(audioSender?.track)audioSender.track.enabled=active;
   }
 }
 window.MafiaVoice={toggle,sync,updatePermissions};
 socket.on('rtcSignal',handle);
 socket.on('disconnect',()=>{clearPeers();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&joined)paint();});
})();
