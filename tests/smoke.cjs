const fs=require('fs'), crypto=require('crypto'), vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','server.js'),'utf8');
const body=src.slice(src.indexOf('const rooms = new Map();'),src.indexOf("io.on('connection'"));
const queue=new Map();let next=1;
const fakeSetTimeout=(f,ms)=>{const n=next++;queue.set(n,{f,ms});return n;};
const fakeClearTimeout=id=>queue.delete(id);
const io={sockets:{sockets:new Map()}};
const lib=new Function('io','crypto','setTimeout','clearTimeout',body+';return {rooms,makePlayer,start,advance,resolveNight,living,presets,mafiaCount,view,roles,scheduleBots,enter};')(io,crypto,fakeSetTimeout,fakeClearTimeout);
const r={code:'ABCDEF',host:'X',players:[],phase:'lobby',messages:[],day:0,deadline:null,mafiaVotes:{},mediumPair:[],nominees:[],tally:{},botTimers:[],testMode:false};
const human=lib.makePlayer({id:'s1'},'Om');human.ready=true;r.host=human.id;r.players.push(human);
for(let i=1;i<=4;i++)r.players.push(lib.makePlayer(null,`Bot ${i}`,true));
lib.start(r);
console.log('Roluri 5:',r.players.map(p=>`${p.name}: ${p.role}`).join('; '));
console.log('Start',r.phase,'durata',(r.deadline-Date.now())/1000);
let phases=[];
for(let i=0;i<65&&r.phase!=='end';i++){
  const work=[...queue.entries()].filter(([id,v])=>id!==r.timer).sort((a,b)=>a[1].ms-b[1].ms);
  for(const [id,{f}] of work){if(queue.has(id)){queue.delete(id);f();}}
  const timer=queue.get(r.timer);if(!timer)throw Error('missing phase timer '+r.phase);
  queue.delete(r.timer);timer.f();phases.push(r.phase);
}
console.log('Progress:',phases.join(' -> '));
console.log('Victor:',r.winner,'zi',r.day,'mesaje',r.messages.slice(-12));
if(r.phase!=='end')throw Error('Failed to terminate test');
for(const n of [6,7,8,9,10,12,15,20]){
  const rr={...r,players:Array.from({length:n},(_,i)=>lib.makePlayer(null,'bot'+i,true)),messages:[],mafiaVotes:{},botTimers:[],nominees:[],mediumPair:[],phase:'lobby'};
  lib.start(rr);const roles=rr.players.map(p=>p.role);if(roles.length!==n)throw Error('Incorrect count '+n);
  console.log(n,roles.filter(role=>lib.roles[role][0]==='Mafia').length,roles.join(', '));
}
