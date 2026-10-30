import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import crypto from 'node:crypto';

const app = express();
app.disable('x-powered-by');
app.use(express.static('public', { maxAge: 0 }));
app.get('/health', (_req,res)=>res.json({ok:true,game:'Mafia Power & Deception'}));
const http = createServer(app);
const io = new Server(http,{maxHttpBufferSize:12000});
const rooms = new Map();
const id = () => crypto.randomBytes(12).toString('hex');
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const sample = a => a[Math.floor(Math.random()*a.length)];
const shuffled = a => { const result=[...a]; for(let i=result.length-1;i>0;i--){const j=crypto.randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;};
const roles = {
 detective:['Oraș','Noaptea afli facțiunea unui jucător, nu rolul (1 investigație la 5–6 persoane; altfel 2). Alternativ ai un glonț. Dacă împuști un orășean, pierzi investigațiile rămase.'],
 doctor:['Oraș','Protejezi în fiecare noapte o persoană împotriva atacului normal. Nu poți alege aceeași persoană două nopți la rând. Te poți proteja o dată.'],
 guardian:['Oraș','Ai 2 scuturi care anulează un atac sau o blocare. Nu te poți alege pe tine. Scutul se consumă dacă oprește un efect.'],
 watcher:['Oraș','Alegi noaptea o persoană și vezi cine a vizitat-o, fără să vezi rolurile vizitatorilor.'],
 jailer:['Oraș','De 2 ori poți închide un jucător: îl protejezi de atacul normal, dar îi blochezi puterea. Nu aceeași țintă consecutiv.'],
 judge:['Oraș','O singură dată poți anula execuția după vot, în fereastra de grațiere.'],
 journalist:['Oraș','De două ori compari noaptea doi jucători. Dimineața se anunță public dacă sunt din aceeași facțiune.'],
 hunter:['Oraș','Dacă ești ucis prin atac direct, ucigașul moare împreună cu tine. Nu se activează la execuția prin vot.'],
 medium:['Oraș','De două ori pe partidă poți deschide un chat privat cu un jucător mort, doar în timpul nopții.'],
 trapper:['Oraș','În Noaptea 0 alegi un aliat de protejat prin capcană. Primul mafiot care îl vizitează este blocat și descoperit.'],
 boss:['Mafia','Participi la alegerea victimei comune a Mafiei. La egalitate decizi tu ținta. Mafia ucide o singură dată pe noapte.'],
 assassin:['Mafia','O dată pe partidă poți face atacul Mafiei să ignore Doctorul, dar nu Gardianul sau Temnicerul.'],
 infiltrator:['Mafia','Detectivul te vede ca Oraș la investigație. Participi la atacul colectiv.'],
 forger:['Mafia','De două ori poți inversa rezultatul Detectivului asupra unei ținte. Nu modifici raportul Jurnalistului.'],
 spy:['Mafia','De trei ori poți afla categoria de putere a unui jucător, nu rolul exact.']
};
const roleNames={detective:'Detectiv',doctor:'Doctor',guardian:'Gardian',watcher:'Observator',jailer:'Temnicer',judge:'Judecător',journalist:'Jurnalist',hunter:'Vânător',medium:'Medium',trapper:'Capcanier',boss:'Nașul',assassin:'Asasin',infiltrator:'Infiltrat',forger:'Falsificator',spy:'Spion'};
const towns=['detective','doctor','hunter','watcher','judge','guardian','journalist','jailer','medium','trapper','watcher','doctor','guardian'];
const mafias=['boss','infiltrator','forger','assassin','spy','infiltrator','spy'];
// Proporția 2/3 Oraș, 1/3 Mafia: pentru numere care nu se împart la trei rotunjim.
const mafiaCount=n=>Math.round(n/3);
const presets=Object.fromEntries(Array.from({length:16},(_,i)=>{const n=i+5,m=mafiaCount(n);return [n,[...mafias.slice(0,m),...towns.slice(0,n-m)]];}));
// 50 s total: 30 discutăm, ultimele 20 votăm și continuăm să comunicăm.
const durationsNormal={night0:9,day:30,dayVote:20,defend:15,finalVote:10,judge:10,night:45,dawn:7};
// Opțiune explicită de test, nu se activează automat când există boți.
const durationsFast={night0:3,day:9,dayVote:7,defend:6,finalVote:5,judge:4,night:10,dawn:3};
const living=r=>r.players.filter(p=>p.alive);
const find=(r,pid)=>r.players.find(p=>p.id===pid);
const team=p=>roles[p?.role]?.[0];
const push=(r,text,channel='public',from='Sistem')=>{r.messages.push({text,channel,from,time:Date.now(),audience:channel==='medium'?[...r.mediumPair]:undefined});if(r.messages.length>250)r.messages.shift();};
const getDuration=(r,phase)=>(r.fast?durationsFast:durationsNormal)[phase]||0;
const largeRoom=r=>r.players.length>8;
const defendSpeaker=r=>r.phase==='defend'?'ambii suspecți':null;
const publicChatAllowed=(r,p)=>p.alive && (['day','dayVote'].includes(r.phase)||(r.phase==='defend'&&r.nominees.includes(p.id)));
const voicePeers=(r,p)=>r.players.filter(q=>q.id!==p.id&&!q.bot&&q.voiceJoined&&canVoiceConnect(r,p,q)).map(q=>({id:q.id,name:q.name}));
const canVoiceConnect=(r,a,b)=>{if(!a.voiceJoined||!b.voiceJoined)return false;if(!a.alive&&!b.alive)return true;if(!a.alive||!b.alive)return r.phase==='night'&&r.mediumPair.includes(a.id)&&r.mediumPair.includes(b.id);if(['day','dayVote','defend'].includes(r.phase))return true;if(r.phase==='night'&&team(a)==='Mafia'&&team(b)==='Mafia')return true;return r.phase==='night'&&r.mediumPair.includes(a.id)&&r.mediumPair.includes(b.id);};

function view(r,p){return {
 code:r.code,host:r.host===p.id,phase:r.phase,deadline:r.deadline,phaseStart:r.phaseStart,day:r.day,fast:r.fast,testMode:r.players.some(q=>q.bot),
 largeRoom:largeRoom(r),speaker:defendSpeaker(r),voiceJoined:!!p.voiceJoined,voicePeers:voicePeers(r,p),
 players:r.players.map(q=>({id:q.id,name:q.name,bot:q.bot,alive:q.alive,ready:q.ready,
 online:q.bot||!!io.sockets.sockets.get(q.sid),role:!q.alive||(team(p)==='Mafia'&&team(q)==='Mafia')?q.role:undefined,
 team:!q.alive||(team(p)==='Mafia'&&team(q)==='Mafia')?team(q):undefined})),
 me:{id:p.id,role:p.role,team:team(p)||null,uses:{...p.uses},alive:p.alive,choice:p.choice,action:p.action,trapTarget:p.trapTarget,
 private:p.private.slice(-12)},
 messages:r.messages.slice(-100).filter(m=>m.channel==='public'||(m.channel==='mafia'&&team(p)==='Mafia')||(m.channel==='medium'&&m.audience?.includes(p.id))||(m.channel==='dead'&&!p.alive)),
 roles,roleNames,nominees:r.nominees||[],tally:r.tally||{},winner:r.winner,mafiaVotes:team(p)==='Mafia'?r.mafiaVotes:{},mediumPair:r.mediumPair.includes(p.id)?r.mediumPair:[],
 pendingName:r.pending?find(r,r.pending)?.name:null,chatAllowed:publicChatAllowed(r,p)
};}
function emit(r){for(const p of r.players){if(p.bot)continue;const sock=io.sockets.sockets.get(p.sid);if(sock)sock.emit('state',view(r,p));}}
function error(sock,msg){sock.emit('errorMessage',msg);}
function makePlayer(s,name,bot=false){return {id:id(),sid:s?.id??null,bot,token:bot?null:id()+id(),name:name.slice(0,24),ready:bot,
 alive:true,role:null,uses:{},private:[],choice:null,action:null,trapTarget:null,trapUsed:false,lastHeal:null,lastJail:null,knownMafia:[],voiceJoined:false};}
function resetSelections(r){for(const p of r.players){p.choice=null;p.action=null;}r.mafiaVotes={};r.executor=null;r.mediumPair=[];}
function winner(r){const town=living(r).filter(p=>team(p)==='Oraș').length;const mafia=living(r).filter(p=>team(p)==='Mafia').length;
 if(mafia===0)return 'Oraș';if(mafia>=town)return 'Mafia';return null;}
function end(r,winning){clearTimeout(r.timer);for(const t of r.botTimers||[])clearTimeout(t);r.phase='end';r.winner=winning;r.deadline=null;
 push(r,`🏆 Partida s-a terminat: câștigă ${winning}!`);emit(r);}
function checkWin(r){const result=winner(r);if(result){end(r,result);return true;}return false;}
function kill(r,v,killer=null,reason='atac'){if(!v?.alive)return;v.alive=false;
 push(r,`${v.name} a murit (${reason}). Rolul era ${roleNames[v.role]}.`);
 if(v.role==='hunter'&&killer?.alive&&killer.id!==v.id){killer.alive=false;push(r,`Vânătorul l-a luat cu el pe ${killer.name}. Rol: ${roleNames[killer.role]}.`);}}
function enter(r,phase){clearTimeout(r.timer);for(const t of r.botTimers||[])clearTimeout(t);r.botTimers=[];
 r.phase=phase;r.phaseStart=Date.now();r.deadline=r.phaseStart+getDuration(r,phase)*1000;
 if(phase==='night0'){resetSelections(r);push(r,'Noaptea 0: Mafia își vede echipa. Capcanierul plasează capcana. Nimeni nu poate ucide.');}
 if(phase==='day'){resetSelections(r);r.day++;r.nominees=[];r.tally={};push(r,`Ziua ${r.day}: 30 secunde de discuții, apoi votul începe pentru încă 20 secunde. Puteți vorbi și în timpul votului.`);}
 if(phase==='dayVote'){for(const p of r.players)p.choice=null;push(r,largeRoom(r)?'Nominalizare deschisă! Votează un suspect; continuă discuțiile.':'Vot deschis! Votează cine ar trebui eliminat; discuțiile continuă.');}
 if(phase==='defend'){for(const p of r.players)p.choice=null;push(r,'Apărarea: cei doi suspecți pot vorbi simultan timp de 15 secunde. Restul ascultă.');}
 if(phase==='finalVote'){for(const p of r.players)p.choice=null;push(r,'Vot FINAL: alege unul dintre suspecți sau Nimeni. Aveți 10 secunde.');}
 if(phase==='judge'){push(r,`Judecătorul poate anula condamnarea lui ${find(r,r.pending)?.name} în 10 secunde.`);}
 if(phase==='night'){resetSelections(r);push(r,`Noaptea ${r.day}: alegeți țintele, Mafia are chat privat.`);}
 if(phase==='dawn'){push(r,'Soarele răsare peste oraș...');}
 emit(r);scheduleBots(r);
 const duration=getDuration(r,phase);if(duration)r.timer=setTimeout(()=>advance(r),duration*1000);
}
function start(r){const n=r.players.length;
 const pool=presets[n];if(!pool||pool.length!==n)throw new Error('Configurație incorectă');
 const picked=shuffled(pool);r.players.forEach((p,i)=>{p.role=picked[i];p.alive=true;p.private=[];p.choice=null;p.action=null;
 p.trapTarget=null;p.trapUsed=false;p.lastHeal=null;p.lastJail=null;p.knownMafia=[];
 p.uses={investigate:n<=6?1:2,shoot:1,self:1,guard:2,jail:2,journal:2,medium:2,forge:2,spy:3,special:1,judge:1};});
 r.day=0;r.messages=[];r.winner=null;r.pending=null;r.nominees=[];r.mafiaVotes={};r.mediumPair=[];
 push(r,`Partida începe: ${n-mafiaCount(n)} Oraș (${Math.round(100*(n-mafiaCount(n))/n)}%) și ${mafiaCount(n)} Mafia (${Math.round(100*mafiaCount(n)/n)}%).`);
 enter(r,'night0');}
function abilityCategory(role){return ({detective:'investigație/atac',doctor:'protecție',guardian:'protecție',watcher:'investigație',jailer:'control',judge:'control',journalist:'investigație',hunter:'atac',medium:'comunicare',trapper:'protecție',boss:'atac',assassin:'atac',infiltrator:'control',forger:'control',spy:'investigație'})[role]||'control';}
function resolveNight(r){
 const active=living(r),raw=active.filter(p=>p.action).map(p=>({p,...p.action}));
 const blocked=new Set(),guarded=new Set(),jailed=new Set(),doc=new Set(),visits=[];
 const guards=raw.filter(a=>a.type==='guard'&&a.p.uses.guard>0&&a.target!==a.p.id);
 for(const a of guards)guarded.add(a.target);
 for(const a of raw.filter(a=>a.type==='jail'&&a.p.uses.jail>0&&a.target!==a.p.lastJail)){
   if(guarded.has(a.p.id))continue; if(!guarded.has(a.target))blocked.add(a.target);
   jailed.add(a.target);a.p.uses.jail--;a.p.lastJail=a.target;visits.push(a);
 }
 for(const a of raw)if(a.target&&!blocked.has(a.p.id)&&a.type!=='jail')visits.push(a);
 const counts={};for(const pid of Object.values(r.mafiaVotes)){const t=find(r,pid);if(t?.alive&&team(t)==='Oraș')counts[pid]=(counts[pid]||0)+1;}
 const best=Math.max(0,...Object.values(counts));const tied=Object.keys(counts).filter(k=>counts[k]===best);
 const boss=active.find(p=>p.role==='boss');const bossChoice=boss?.id?r.mafiaVotes[boss.id]:null;
 const victimId=tied.includes(bossChoice)?bossChoice:tied.sort()[0];
 const mafiaAlive=active.filter(p=>team(p)==='Mafia');
 const executor=mafiaAlive.find(p=>p.id===r.executor)||mafiaAlive[0];
 const victim=find(r,victimId);if(victim&&executor)visits.push({p:executor,type:'mafiaAttack',target:victim.id});
 for(const trapper of active.filter(p=>p.role==='trapper'&&p.trapTarget&&!p.trapUsed)){
  const bad=visits.find(a=>a.target===trapper.trapTarget&&team(a.p)==='Mafia'&&!blocked.has(a.p.id));
  if(bad){blocked.add(bad.p.id);trapper.trapUsed=true;trapper.private.push(`Capcana l-a blocat pe ${bad.p.name}.`);}
 }
 for(const a of raw.filter(a=>a.type==='doctor'&&!blocked.has(a.p.id))){
  if(a.target===a.p.lastHeal||!find(r,a.target)?.alive)continue;
  if(a.p.id===a.target){if(a.p.uses.self<1)continue;a.p.uses.self--;}
  a.p.lastHeal=a.target;doc.add(a.target);
 }
 const forgeries=new Set();for(const a of raw.filter(a=>a.type==='forge'&&!blocked.has(a.p.id)&&a.p.uses.forge>0)){
  forgeries.add(a.target);a.p.uses.forge--;}
 for(const a of raw){if(blocked.has(a.p.id))continue;
  const target=find(r,a.target);
  if(a.type==='investigate'&&a.p.uses.investigate>0&&target){a.p.uses.investigate--;
   let result=target.role==='infiltrator'?'Oraș':team(target);
   if(forgeries.has(target.id))result=result==='Oraș'?'Mafia':'Oraș';
   a.p.private.push(`${target.name}: facțiunea raportată este ${result}.`);
   if(a.p.bot&&result==='Mafia')a.p.knownMafia.push(target.id);
  }
  if(a.type==='spy'&&a.p.uses.spy>0&&target){a.p.uses.spy--;a.p.private.push(`${target.name}: categorie ${abilityCategory(target.role)}.`);}
  if(a.type==='watch'&&target){const names=visits.filter(v=>v.target===target.id&&!blocked.has(v.p.id)&&v.p.id!==a.p.id).map(v=>v.p.name);a.p.private.push(`Vizitatori ai lui ${target.name}: ${[...new Set(names)].join(', ')||'niciunul'}.`);}
  if(a.type==='journal'&&a.p.uses.journal>0){const second=find(r,a.target2);if(target&&second){a.p.uses.journal--;push(r,`Jurnalist: ${target.name} și ${second.name} sunt din ${team(target)===team(second)?'aceeași facțiune':'facțiuni diferite'}.`);}}
 }
 const assassin=active.find(p=>p.role==='assassin'&&!blocked.has(p.id)&&p.action?.type==='special'&&p.uses.special>0);
 const special=!!assassin;if(assassin)assassin.uses.special--;
 const attacks=[];
 if(victim&&executor&&!blocked.has(executor.id)&&!(r.day===1&&r.players.length<=6))attacks.push({target:victim,killer:executor,special});
 for(const a of raw.filter(a=>a.type==='shoot'&&!blocked.has(a.p.id)&&a.p.uses.shoot>0)){
  const t=find(r,a.target);a.p.uses.shoot--;if(t?.alive){attacks.push({target:t,killer:a.p,special:false});if(team(t)==='Oraș')a.p.uses.investigate=0;}
 }
 for(const a of guards){if(blocked.has(a.p.id))continue;
  const threatened=attacks.some(x=>x.target.id===a.target)||blocked.has(a.target);
  if(threatened&&a.p.uses.guard>0){a.p.uses.guard--;a.p.private.push('Scutul tău a fost activat.');}
 }
 // Efectele tuturor atacurilor sunt determinate înainte de aplicarea morților.
 const lethal=attacks.filter(atk=>atk.target.alive&&!guarded.has(atk.target.id)&&!jailed.has(atk.target.id)&&(atk.special||!doc.has(atk.target.id)));
 for(const atk of lethal)kill(r,atk.target,atk.killer,atk.special?'atac special':'atac nocturn');
}
function voteResolution(r,final=false){
 const candidates=final?r.nominees:null;
 const count={};for(const p of living(r))if(p.choice&&(!candidates||candidates.includes(p.choice)))count[p.choice]=(count[p.choice]||0)+1;
 r.tally=count;const top=Object.entries(count).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
 r.pending=top&&top[1]>living(r).length/2?top[0]:null;
 if(!r.pending){push(r,'Nimeni nu a primit majoritatea absolută. Nu este executat nimeni.');enter(r,'night');return;}
 push(r,`${find(r,r.pending)?.name} a fost condamnat prin vot.`);
 if(living(r).some(p=>p.role==='judge'&&p.uses.judge>0)){enter(r,'judge');return;}
 executeAndNext(r);
}
function executeAndNext(r){if(r.pending){kill(r,find(r,r.pending),null,'vot');r.pending=null;}
 if(!checkWin(r))enter(r,'night');}
function advance(r){switch(r.phase){
 case 'night0':enter(r,'day');break;
 case 'day':enter(r,'dayVote');break;
 case 'dayVote':if(!largeRoom(r)){voteResolution(r);break;}{
  const tally={};for(const p of living(r))if(p.choice)tally[p.choice]=(tally[p.choice]||0)+1;
  r.nominees=Object.keys(tally).sort((a,b)=>tally[b]-tally[a]||r.players.findIndex(p=>p.id===a)-r.players.findIndex(p=>p.id===b)).slice(0,2);
  if(!r.nominees.length){push(r,'Nu au fost nominalizări.');enter(r,'night');}else enter(r,'defend');break;}
 case 'defend':enter(r,'finalVote');break;
 case 'finalVote':voteResolution(r,true);break;
 case 'judge':executeAndNext(r);break;
 case 'night':resolveNight(r);if(!checkWin(r))enter(r,'dawn');break;
 case 'dawn':enter(r,'day');break;
}}
function pickBotChoice(r,p,candidates){const known=p.knownMafia?.find(x=>candidates.includes(x));return known||sample(candidates);}
function scheduleBots(r){const bots=living(r).filter(p=>p.bot);if(!bots.length||['lobby','end'].includes(r.phase))return;
 const phase=r.phase;const add=(ms,cb)=>r.botTimers.push(setTimeout(()=>{if(r.phase===phase){cb();emit(r);}},ms));
 if(phase==='night0'){for(const b of bots.filter(p=>p.role==='trapper'))add(250,()=>{const targets=living(r).filter(p=>p.id!==b.id);if(targets.length)b.trapTarget=sample(targets).id;});return;}
 if(phase==='day'){for(const [i,b] of bots.entries())add(600+i*200,()=>{
  const others=living(r).filter(p=>p.id!==b.id&&(team(b)!=='Mafia'||team(p)!=='Mafia'));
  if(others.length)push(r,`Eu îl suspectez pe ${sample(others).name}. Trebuie să discutăm!`,'public',b.name);
 });return;}
 if(phase==='dayVote'||phase==='finalVote'){
  for(const [i,b] of bots.entries())add(350+i*120,()=>{
   const pool=phase==='finalVote'?r.nominees:living(r).filter(p=>p.id!==b.id).map(p=>p.id);
   const candidates=pool.filter(pid=>pid!==b.id&&find(r,pid)?.alive&&(team(b)!=='Mafia'||team(find(r,pid))!=='Mafia'));
   b.choice=candidates.length?pickBotChoice(r,b,candidates):null;
  });return;}
 if(phase==='defend'){
  for(const [i,pid] of r.nominees.entries()){
   const b=find(r,pid);if(!b?.bot)continue;
   add(350+i*250,()=>push(r,'Nu sunt Mafia! Aveți grijă pe cine eliminați.','public',b.name));
  }return;}
 if(phase==='judge'){for(const b of bots.filter(p=>p.role==='judge'&&p.uses.judge>0))add(450,()=>{
  if(r.pending&&Math.random()<.5){b.uses.judge--;r.pending=null;push(r,'Judecătorul a anulat execuția!');enter(r,'night');}
 });return;}
 if(phase==='night'){
  for(const [i,b] of bots.entries())add(350+i*140,()=>{
   const others=living(r).filter(p=>p.id!==b.id),enemies=others.filter(p=>team(p)==='Oraș');
   if(team(b)==='Mafia'){
    if(enemies.length)r.mafiaVotes[b.id]=sample(enemies).id;
    if(!r.executor)r.executor=sample(living(r).filter(p=>team(p)==='Mafia'))?.id;
    if(b.role==='forger'&&b.uses.forge>0&&enemies.length)b.action={type:'forge',target:sample(enemies).id};
    if(b.role==='spy'&&b.uses.spy>0&&enemies.length)b.action={type:'spy',target:sample(enemies).id};
    if(b.role==='assassin'&&b.uses.special>0&&Math.random()<.45)b.action={type:'special'};
    return;
   }
   if(!others.length)return;const someone=sample(others).id;
   if(b.role==='detective')b.action=b.uses.investigate>0?{type:'investigate',target:someone}:(b.uses.shoot>0&&Math.random()<.3?{type:'shoot',target:someone}:null);
   if(b.role==='doctor'){const pool=living(r).filter(p=>p.id!==b.lastHeal&&(p.id!==b.id||b.uses.self>0));if(pool.length)b.action={type:'doctor',target:sample(pool).id};}
   if(b.role==='watcher')b.action={type:'watch',target:someone};
   if(b.role==='guardian'&&b.uses.guard>0)b.action={type:'guard',target:someone};
   if(b.role==='jailer'&&b.uses.jail>0){const pool=others.filter(p=>p.id!==b.lastJail);if(pool.length)b.action={type:'jail',target:sample(pool).id};}
   if(b.role==='journalist'&&b.uses.journal>0){const second=sample(others.filter(p=>p.id!==someone));if(second)b.action={type:'journal',target:someone,target2:second.id};}
   if(b.role==='medium'&&b.uses.medium>0){const dead=r.players.filter(p=>!p.alive);if(dead.length){const t=sample(dead);b.uses.medium--;r.mediumPair=[b.id,t.id];}}
  });
 }
}

io.on('connection',socket=>{
 socket.on('create',({name}={})=>{
  if(typeof name!=='string'||!name.trim()||name.trim().length>24)return error(socket,'Introdu un nume de maximum 24 caractere.');
  let c;do{c=code();}while(rooms.has(c));const p=makePlayer(socket,name.trim());
  const r={code:c,host:p.id,players:[p],phase:'lobby',messages:[],day:0,deadline:null,mafiaVotes:{},mediumPair:[],nominees:[],tally:{},botTimers:[],fast:false};
  rooms.set(c,r);socket.join(c);socket.data={code:c,pid:p.id};socket.emit('identity',{token:p.token,code:c});emit(r);
 });
 socket.on('join',({code:c,name,token}={})=>{
  const r=rooms.get(String(c||'').toUpperCase());if(!r)return error(socket,'Camera nu există sau serverul a repornit.');
  let p=typeof token==='string'&&r.players.find(x=>x.token===token&&!x.bot);
  if(!p){if(r.phase!=='lobby')return error(socket,'Partida a început; pentru a reveni, folosește același browser.');
   if(r.players.length>=20)return error(socket,'Camera este plină.');
   if(typeof name!=='string'||!name.trim()||name.trim().length>24)return error(socket,'Introdu un nume valid.');
   if(r.players.some(x=>x.name.toLowerCase()===name.trim().toLowerCase()))return error(socket,'Numele este deja folosit.');
   p=makePlayer(socket,name.trim());r.players.push(p);
  }else{const old=io.sockets.sockets.get(p.sid);if(old&&old.id!==socket.id)old.disconnect(true);p.sid=socket.id;p.voiceJoined=false;}
  socket.join(r.code);socket.data={code:r.code,pid:p.id};socket.emit('identity',{token:p.token,code:r.code});emit(r);
 });
 function withPlayer(callback){return (...args)=>{const r=rooms.get(socket.data?.code),p=r?.players.find(q=>q.id===socket.data.pid);
  if(!r||!p||p.bot)return error(socket,'Nu ești într-o cameră.');callback(r,p,...args);};}
 socket.on('addBot',withPlayer((r,p,{fill=false}={})=>{
  if(r.phase!=='lobby'||r.host!==p.id)return;
  const amount=fill?Math.max(0,5-r.players.length):1;
  if(r.players.length+amount>20)return error(socket,'Maximum 20 de jucători.');
  for(let i=0;i<amount;i++){let k=1;while(r.players.some(x=>x.name===`Bot ${k}`))k++;r.players.push(makePlayer(null,`Bot ${k}`,true));}emit(r);
 }));
 socket.on('removeBots',withPlayer((r,p)=>{if(r.phase!=='lobby'||r.host!==p.id)return;r.players=r.players.filter(x=>!x.bot);emit(r);}));
 socket.on('setFast',withPlayer((r,p,{fast}={})=>{if(r.host!==p.id||r.phase!=='lobby')return;r.fast=!!fast;emit(r);}));
 socket.on('voiceJoin',withPlayer((r,p,{joined}={})=>{p.voiceJoined=!!joined&&r.phase!=='lobby'&&r.phase!=='end';emit(r); }));
 socket.on('ready',withPlayer((r,p)=>{if(r.phase!=='lobby')return;p.ready=!p.ready;emit(r);}));
 socket.on('start',withPlayer((r,p)=>{if(r.host!==p.id||r.phase!=='lobby')return;
  if(r.players.length<5||r.players.length>20||r.players.some(x=>!x.ready))return error(socket,'Ai nevoie de 5–20 jucători și toți Ready.');start(r);
 }));
 const lastChat=new Map();
 socket.on('chat',withPlayer((r,p,{text,channel='public'}={})=>{
  if(typeof text!=='string'||!text.trim()||text.length>500)return;
  if(Date.now()-(lastChat.get(p.id)||0)<650)return;
  if(channel==='public'&&!publicChatAllowed(r,p))return error(socket,'În această fază nu ai dreptul să vorbești.');
  if(channel==='mafia'&&!(p.alive&&team(p)==='Mafia'&&r.phase==='night'))return;
  if(channel==='medium'&&!(r.phase==='night'&&r.mediumPair.includes(p.id)))return;
  if(channel==='dead'&&p.alive)return;
  if(!['public','mafia','medium','dead'].includes(channel))return;
  lastChat.set(p.id,Date.now());push(r,text.trim(),channel,p.name);emit(r);
 }));
 socket.on('choice',withPlayer((r,p,{target}={})=>{
  if(!p.alive||!['dayVote','finalVote'].includes(r.phase))return;
  if(target!==null){const q=find(r,target);if(!q?.alive||q.id===p.id)return;
   if(r.phase==='finalVote'&&!r.nominees.includes(target))return;}
  p.choice=target;emit(r);
 }));
 socket.on('action',withPlayer((r,p,a={})=>{
  if(!p.alive||!['night','night0','judge'].includes(r.phase))return;
  if(r.phase==='judge'){
   if(p.role==='judge'&&p.uses.judge>0&&r.pending&&a.type==='pardon'){
    p.uses.judge--;r.pending=null;push(r,'Judecătorul a anulat execuția!');enter(r,'night');}return;
  }
  const target=find(r,a.target);
  if(r.phase==='night0'){
   if(p.role==='trapper'&&target?.alive&&target.id!==p.id){p.trapTarget=target.id;p.private.push(`Ai pus capcana pe ${target.name}.`);emit(r);}return;
  }
  const allowed={detective:['investigate','shoot'],doctor:['doctor'],guardian:['guard'],watcher:['watch'],jailer:['jail'],journalist:['journal'],medium:['medium'],forger:['forge'],spy:['spy'],assassin:['special']};
  if(!allowed[p.role]?.includes(a.type))return;
  if(a.type!=='special'&&!target)return error(socket,'Selectează o țintă.');
  if(a.type!=='medium'&&target&&!target.alive)return error(socket,'Ținta nu mai este în viață.');
  if(a.type!=='medium'&&a.type!=='doctor'&&target?.id===p.id)return error(socket,'Nu te poți alege pe tine.');
  const key={investigate:'investigate',shoot:'shoot',guard:'guard',jail:'jail',journal:'journal',medium:'medium',forge:'forge',spy:'spy',special:'special'}[a.type];
  if(key&&p.uses[key]<=0)return error(socket,'Nu mai ai utilizări.');
  if(a.type==='journal'&&(!find(r,a.target2)?.alive||a.target===a.target2))return error(socket,'Alege două persoane diferite.');
  if(a.type==='medium'&&target?.alive)return error(socket,'Alege un jucător mort.');
  if(a.type==='doctor'&&(p.lastHeal===target.id||(p.id===target.id&&p.uses.self<=0)))return error(socket,'Doctorul nu poate proteja această țintă.');
  if(a.type==='jail'&&p.lastJail===target.id)return error(socket,'Nu poți închide aceeași țintă consecutiv.');
  if(a.type==='medium'){
   if(!target||target.alive||r.mediumPair[0]===p.id)return;
   p.uses.medium--;r.mediumPair=[p.id,target.id];p.private.push(`Poți vorbi cu ${target.name} în canalul Medium până se termină noaptea.`);
  }else p.action={type:a.type,target:a.target,target2:a.target2};
  emit(r);
 }));
 socket.on('mafiaVote',withPlayer((r,p,{target,executor}={})=>{
  if(r.phase!=='night'||!p.alive||team(p)!=='Mafia')return;
  const q=find(r,target);if(!q?.alive||team(q)==='Mafia')return;
  r.mafiaVotes[p.id]=target;
  if(executor&&living(r).some(x=>x.id===executor&&team(x)==='Mafia'))r.executor=executor;
  emit(r);
 }));
 // WebRTC signaling: doar mesaje între jucători umani din aceeași cameră.
 socket.on('rtcSignal',withPlayer((r,p,{to,signal}={})=>{
  const peer=find(r,to);if(!peer||peer.bot||!peer.sid||!signal||!canVoiceConnect(r,p,peer)||JSON.stringify(signal).length>12000)return;
  const receiver=io.sockets.sockets.get(peer.sid);if(receiver)receiver.emit('rtcSignal',{from:p.id,signal});
 }));
 socket.on('disconnect',()=>{
  const r=rooms.get(socket.data?.code);if(!r)return;
  const player=find(r,socket.data?.pid);if(player&&player.sid===socket.id)player.voiceJoined=false;
  emit(r);if(r.phase==='lobby'&&r.players.filter(p=>!p.bot).every(p=>!io.sockets.sockets.get(p.sid))){
   clearTimeout(r.timer);for(const t of r.botTimers||[])clearTimeout(t);rooms.delete(r.code);}
 });
});
if(process.env.NODE_ENV!=='test')http.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log(`Mafia pornită pe portul ${process.env.PORT||3000}`));
