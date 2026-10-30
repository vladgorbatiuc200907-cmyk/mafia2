const socket=io();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleNames={detective:'Detectiv',doctor:'Doctor',guardian:'Gardian',watcher:'Observator',jailer:'Temnicer',judge:'Judecător',journalist:'Jurnalist',hunter:'Vânător',medium:'Medium',trapper:'Capcanier',boss:'Nașul',assassin:'Asasin',infiltrator:'Infiltrat',forger:'Falsificator',spy:'Spion'};
const roleIcons={detective:'🔎',doctor:'💊',guardian:'🛡️',watcher:'👁️',jailer:'🔒',judge:'⚖️',journalist:'📰',hunter:'🎯',medium:'🕯️',trapper:'🪤',boss:'👑',assassin:'🔪',infiltrator:'🎭',forger:'🧪',spy:'🕵️'};
const fallbackRoles={
 detective:['Oraș','Investighezi facțiunea unei ținte sau împuști o singură dată. Dacă împuști un orășean, pierzi investigațiile.'],
 doctor:['Oraș','Protejezi noaptea o țintă. Nu o poți proteja consecutiv; o autoprotecție.'],
 guardian:['Oraș','Două scuturi împotriva atacurilor sau blocărilor. Nu te poți proteja singur.'],
 watcher:['Oraș','Vezi cine vizitează noaptea jucătorul ales.'],
 jailer:['Oraș','Închizi și protejezi o țintă, de două ori pe partidă.'],
 judge:['Oraș','Anulezi o execuție prin vot, o singură dată.'],
 journalist:['Oraș','Compari doi jucători, de două ori. Rezultatul facțiunilor devine public.'],
 hunter:['Oraș','Atacatorul direct moare odată cu tine. La vot nu contraataci.'],
 medium:['Oraș','De două ori poți comunica privat cu un jucător mort în timpul nopții.'],
 trapper:['Oraș','Pui o capcană în Noaptea 0. Primul mafiot vizitator este blocat.'],
 boss:['Mafia','Conduci alegerea victimei colective; departajezi votul Mafiei.'],
 assassin:['Mafia','Un atac colectiv special ignoră Doctorul, o singură dată.'],
 infiltrator:['Mafia','Detectivul te vede drept membru al Orașului.'],
 forger:['Mafia','Inversezi de două ori rezultatul unei investigații.'],
 spy:['Mafia','Afli categoria abilității unei ținte de trei ori.']
};
const useNames={investigate:'Investigații',shoot:'Glonț',self:'Autoprotecție',guard:'Scuturi',jail:'Închisori',journal:'Comparații',medium:'Legături',special:'Atac special',forge:'Falsificări',spy:'Spionaje',judge:'Grațiere'};
const roleUses={detective:['investigate','shoot'],doctor:['self'],guardian:['guard'],jailer:['jail'],journalist:['journal'],medium:['medium'],assassin:['special'],forger:['forge'],spy:['spy'],judge:['judge']};
const phaseInfo={lobby:['✦','Pregătiri','Strânge jucători și distribuie linkul'],night0:['☾','Noaptea zero','Mafia își cunoaște membrii, se pregătesc capcanele'],day:['☀','Orașul discută','Cine minte? Ascultă și descoperă adevărul'],dayVote:['⚖','Alege un suspect','Discuțiile continuă și voturile sunt deschise'],defend:['♜','Ultimele cuvinte','Doar suspecții au voie să vorbească'],finalVote:['⚖','Verdictul final','Alege vinovatul sau abține-te'],judge:['⚖','Decizia Judecătorului','O ultimă șansă de grațiere'],night:['☾','Orașul doarme','Fiecare își alege ținta în secret'],dawn:['☀','Se crapă de ziuă','Orașul află ce s-a întâmplat noaptea'],end:['♛','Partida s-a încheiat','Cine a învins?']};
let state=null,channel='public',lastPhase=null,selectedMode='investigate',identity=null,clockSpeaker=null,toastTimer=null;
let audioCtx=null,soundOn=false;
const sessionKey='mafia-session-v2';
function sound(name){if(!soundOn)return;try{
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audioCtx=audioCtx||new Ctx();if(audioCtx.state==='suspended')audioCtx.resume();
 const now=audioCtx.currentTime;const notes=name==='night'?[94,78,62]:name==='dawn'?[440,587,740]:name==='dayVote'?[390,310]:name==='defend'?[170,135]:name==='end'?[329,493,659]:[230];
 notes.forEach((hz,i)=>{const osc=audioCtx.createOscillator(),vol=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();
 osc.type=name==='night'||name==='defend'?'triangle':'sine';osc.frequency.setValueAtTime(hz,now+i*.12);filter.type='lowpass';filter.frequency.value=name==='night'?480:1800;
 vol.gain.setValueAtTime(.0001,now+i*.12);vol.gain.exponentialRampToValueAtTime(name==='night'?.026:.035,now+i*.12+.045);vol.gain.exponentialRampToValueAtTime(.0001,now+i*.12+.5);
 osc.connect(filter);filter.connect(vol);vol.connect(audioCtx.destination);osc.start(now+i*.12);osc.stop(now+i*.12+.55);});
 }catch(e){console.warn('Audio indisponibil',e);}}
function toggleSound(){soundOn=!soundOn;$('soundToggle').textContent=soundOn?'♫ Sunete: ON':'♫ Sunete: OFF';localStorage.setItem('mafia-sounds',String(soundOn));if(soundOn)sound('dawn');}
$('soundToggle').onclick=toggleSound;$('help').onclick=showRules;
function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),4400);}
function getRoomFromUrl(){return (new URLSearchParams(location.search).get('room')||'').toUpperCase();}
function home(){const room=esc(getRoomFromUrl());$('content').innerHTML=`
 <div class="hero"><div class="eyebrow">Un oraș. Două tabere. Nenumărate minciuni.</div><h1>MAFIA</h1><h2>POWER & DECEPTION</h2><div class="ornament">♠</div><p>În fiecare noapte cineva dispare. În fiecare zi, orașul votează. Tu vei afla cine minte... sau vei fi cel care minte cel mai bine.</p></div>
 <div class="card narrow highlight"><div class="center"><div class="eyebrow">INTRĂ ÎN ORAȘUL UMBRELOR</div><h2 style="margin-top:12px">Începe partida</h2></div>
 <div class="field"><label for="playerName">Cum te numești?</label><input id="playerName" maxlength="24" autocomplete="off" placeholder="Numele din joc" /></div>
 <div class="field"><label for="roomCode">Cod cameră (dacă ai fost invitat)</label><input id="roomCode" maxlength="6" spellcheck="false" autocomplete="off" placeholder="ex. A4C92F" value="${room}" /></div>
 <div class="actions"><button class="btn gold" onclick="createRoom()">✦ Creează cameră</button><button class="btn primary" onclick="joinRoom()">↳ Intră în cameră</button></div>
 <p class="muted tiny center" style="margin:16px 0 0">Fără cont sau instalare · 5–20 jucători · Poți testa cu boți</p></div>
 <div class="center" style="margin-bottom:20px"><button class="helpInline" onclick="showRules()">✧ Vezi toate cele 15 roluri și regulile de joc</button></div>`;
}
function createRoom(){const name=$('playerName')?.value.trim();if(!name)return toast('Introdu un nume înainte de a crea camera.');socket.emit('create',{name});}
function joinRoom(){const name=$('playerName')?.value.trim(),code=$('roomCode')?.value.trim().toUpperCase();if(!name||!code)return toast('Introdu numele și codul camerei.');socket.emit('join',{name,code});}
function showRules(){const roles=state?.roles||fallbackRoles;const modal=$('rules');modal.className='helpOverlay';
 modal.innerHTML=`<section class="helpInner"><button class="btn secondary helpClose" onclick="hideRules()">✕ Închide</button><div class="eyebrow">Manualul locuitorului</div><h1>Reguli & puteri</h1>
 <p>Orașul trebuie să elimine toată Mafia. Mafia câștigă atunci când are cel puțin la fel de mulți membri în viață precum Orașul. Rolul unui jucător mort se dezvăluie public.</p>
 <div class="tip"><b>Repartizare:</b> aproximativ 67% Oraș și 33% Mafia, cu rotunjire la numere întregi. De exemplu, 5 jucători = 3 Oraș + 2 Mafia; 9 = 6 + 3. Boții se numără ca jucători.</div>
 <h2>⌛ Ritmul partidei</h2><p><b>Noaptea 0:</b> Mafia își vede echipa; Capcanierul plasează capcana. Fără atac.</p>
 <p><b>Ziua — 50 secunde:</b> primele 30 s sunt pentru discuții, ultimele 20 s pentru discuții și vot în paralel. La 5–8 jucători acesta este votul de execuție. Dacă partida a pornit cu 9+ jucători, votul selectează doi suspecți.</p>
 <p><b>Pentru 9+ jucători:</b> cei doi suspecți pot vorbi simultan timp de 15 s; restul pot doar asculta/citi. Urmează votul final de 10 s între cei doi sau Nimeni.</p>
 <p><b>Execuția:</b> necesită peste jumătate dintre voturile posibile ale jucătorilor vii. Judecătorul poate grația o dată, în următoarele 10 s.</p>
 <p><b>Noaptea — 45 s:</b> alegeri secrete și chat privat Mafia. Mafia are un singur atac colectiv. La 5–6 participanți nu poate ucide în prima noapte activă.</p>
 <p><b>Voce:</b> microfon opțional și chat text. Vocea este experimentală prin WebRTC și poate să nu funcționeze între toate rețelele; boții nu folosesc vocea. În timpul apărării, doar suspectul la rând poate vorbi. Morții sunt separați de cei vii.</p>
 <h2>🛡️ Cele 10 roluri ale Orașului</h2><div class="rolebook-grid">${Object.entries(roles).filter(([k,v])=>v[0]==='Oraș').map(([k,v])=>roleBook(k,v)).join('')}</div>
 <h2>🔪 Cele 5 roluri ale Mafiei</h2><div class="rolebook-grid">${Object.entries(roles).filter(([k,v])=>v[0]==='Mafia').map(([k,v])=>roleBook(k,v)).join('')}</div>
 <div style="text-align:right;margin-top:20px"><button class="btn gold" onclick="hideRules()">Am înțeles</button></div></section>`;
 document.body.style.overflow='hidden';}
function roleBook(k,v){return `<article class="rolebook-card"><h3>${roleIcons[k]} ${esc(roleNames[k])}</h3><div class="micro ${v[0]==='Mafia'?'mafia':'town'}">${esc(v[0])}</div><p>${esc(v[1])}</p></article>`;}
function hideRules(){$('rules').className='hidden';document.body.style.overflow='';}
function captureEditing(){const el=document.activeElement;if(!el?.id||!['INPUT','SELECT','TEXTAREA'].includes(el.tagName))return null;
 let caret=null;try{caret=[el.selectionStart,el.selectionEnd];}catch{}return{id:el.id,value:el.value,caret};}
function restoreEditing(saved){if(!saved)return;const el=$(saved.id);if(!el)return;if(el.value!==saved.value&&!(el.type==='radio'))el.value=saved.value;
 el.focus({preventScroll:true});if(saved.caret?.[0]!=null)try{el.setSelectionRange(...saved.caret);}catch{}}
function render(){if(!state)return home();const prev=captureEditing();const log=$('chatlog'),stickToBottom=!!log&&(log.scrollHeight-log.scrollTop-log.clientHeight<45);
 const s=state;let content='';
 if(s.phase==='lobby')content=renderLobby(s);
 else content=renderGame(s);
 $('content').innerHTML=content;restoreEditing(prev);
 const newLog=$('chatlog');if(newLog){newLog.scrollTop=stickToBottom||!log?newLog.scrollHeight:Math.min(log.scrollTop,newLog.scrollHeight);}
 updateClock();window.MafiaVoice?.sync(s);
}
function renderLobby(s){const self=s.players.find(p=>p.id===s.me.id),mafia=Math.round(s.players.length/3),town=s.players.length-mafia;
 return `<div class="status-strip"><div class="status-title"><div class="phase-mark">✦</div><div><div class="eyebrow">CAMERĂ PRIVATĂ</div><h1>Sala de așteptare</h1></div></div><span class="pill">Cod: <b>${esc(s.code)}</b></span></div>
 <div class="game-grid"><section><div class="card highlight"><div class="eyebrow">INVITĂ-ȚI PRIETENII</div><h2 style="margin-top:10px">Partida ta începe aici</h2><div class="copyline"><input id="inviteLink" readonly value="${esc(location.origin+'/?room='+s.code)}"><button class="btn gold" onclick="copyLink()">⧉ Copiază</button></div><p class="muted tiny">Trimite linkul prin WhatsApp, Telegram sau orice altă aplicație.</p>
 <div class="separator"></div><div class="line"><span>${s.players.length} / 20 participanți</span><span class="pill">${town} Oraș / ${mafia} Mafia*</span></div><p class="muted tiny">*Distribuția devine relevantă de la 5 jucători.</p>
 <div class="actions"><button class="btn ${self.ready?'secondary':'gold'}" onclick="socket.emit('ready')">${self.ready?'↶ Anulează pregătirea':'✓ Sunt pregătit'}</button>${s.host?'<button class="btn primary" onclick="socket.emit(\'start\')">▶ Începe partida</button>':''}</div>
 ${s.host?`<div class="bot-panel"><div class="line"><b>🤖 Testează chiar și singur</b><span class="pill bot">BOȚI ACTIVI</span></div><p class="tiny muted">Poți adăuga jucători controlați automat, fără să inviți oameni.</p><div class="actions"><button class="btn small gold" onclick="socket.emit('addBot',{fill:true})">Completează până la 5</button><button class="btn small secondary" onclick="socket.emit('addBot',{fill:false})">+ 1 bot</button><button class="btn small ghost" onclick="socket.emit('removeBots')">Șterge boții</button></div>
 <label class="switch tiny"><input type="checkbox" ${s.fast?'checked':''} onchange="socket.emit('setFast',{fast:this.checked})"> Mod rapid pentru test (timere scurtate)</label></div>`:''}</div></section>
 <section><div class="card"><div class="card-header"><h3>Locuitorii camerei</h3><span class="pill">${s.players.filter(p=>p.ready).length}/${s.players.length} pregătiți</span></div><div class="roster">${s.players.map(p=>person(p,s.me.id)).join('')}</div><div class="separator"></div><div class="tip">Fiecare participant primește un rol secret. Nimeni, nici măcar gazda, nu îl poate alege sau vedea înainte de începere.</div></div>
 <div class="card"><h3>Înainte de joc</h3><p class="muted lead">📖 Nu știi ce face un rol? Manualul este disponibil oricând în partea de sus. <button class="helpInline" onclick="showRules()">Deschide manualul</button>.</p></div></section></div>`;}
function person(p,myId){const desc=p.alive===false?esc(roleNames[p.role]):p.ready?'Pregătit':'Așteaptă';return `<div class="person ${p.alive?'':'dead'}"><span class="avatar">${p.bot?'🤖':p.alive?'♟':'☠'}</span><div style="min-width:0"><div class="person-name">${esc(p.name)}${p.id===myId?' (tu)':''}</div><small>${desc}${p.bot?' · BOT':''}</small></div></div>`;}
function renderGame(s){const me=s.me,phase=phaseInfo[s.phase]||['✦',s.phase,''];const now=Date.now();const phaseStart=s.phaseStart||now;
 let description=phase[2];if(s.phase==='dayVote')description=s.largeRoom?'Selectează cine merită să se apere. Vorbește în continuare!':'Votează cine ar trebui eliminat. Poți vorbi în continuare!';
 if(s.phase==='defend')description=`Au cuvântul: ${s.players.filter(p=>s.nominees.includes(p.id)).map(p=>esc(p.name)).join(' și ')}`;
 const track=['day','dayVote','defend','finalVote','night','dawn'];const isDark=['night','night0'].includes(s.phase);
 let html=`<div class="status-strip"><div class="status-title"><div class="phase-mark">${phase[0]}</div><div><div class="eyebrow">${isDark?'NOAPTEA':s.phase==='end'?'DEZNODĂMÂNT':'ZIUA'} ${s.day} · CAMERA ${esc(s.code)}</div><h1>${phase[1]}</h1><span class="muted tiny" id="phaseSummary">${description}</span></div></div><div class="time-circle" id="timerRing"><div class="time-inner"><b id="clock">--</b><span>secunde</span></div></div></div>
 <div class="phase-track">${track.filter(t=>!['defend','finalVote'].includes(t)||s.largeRoom).map((t,i)=>(i?'<span class="arrow">›</span>':'')+`<span class="${s.phase===t?'active':''}">${({day:'Discuții',dayVote:'Vot deschis',defend:'Apărare',finalVote:'Verdict',night:'Noapte',dawn:'Zori'})[t]}</span>`).join('')}</div>`;
 if(s.phase==='end')return html+renderEnd(s);
 if(s.phase==='dayVote')html+=`<div class="banner good">🗳️ <b>Votarea este deschisă!</b> Ai 20 de secunde să alegi sau să schimbi votul; discuțiile continuă.</div>`;
 if(s.phase==='defend')html+=`<div class="banner">♜ <b>Ultimele cuvinte.</b> Doar cei ${s.nominees.length} suspecți pot vorbi sau scrie timp de 15 secunde. Ceilalți ascultă.</div>`;
 if(s.phase==='night')html+=`<div class="banner">☾ <b>Liniștea nopții.</b> Acțiunile sunt secrete. Nu dezvălui ce vezi pe ecran.</div>`;
 if(s.phase==='judge')html+=`<div class="banner">⚖️ <b>${esc(s.pendingName)}</b> este condamnat. Judecătorul poate decide grațierea.</div>`;
 if(!me.alive)html+=`<div class="banner">☠️ Ai murit. Poți urmări partida, dar nu poți influența voturile sau comunica cu cei vii, cu excepția Mediumului.</div>`;
 const uses=(roleUses[me.role]||[]).map(key=>`<span class="pill">${esc(useNames[key])}: ${me.uses[key]??0}</span>`).join('');
 html+=`<div class="game-grid"><div><div class="card role-identity ${me.team==='Mafia'?'mafia-role':'town-role'}"><div class="team-label ${me.team==='Mafia'?'mafia':'town'}">${me.team==='Mafia'?'🔪 FACȚIUNEA MAFIA':'🛡️ FACȚIUNEA ORAȘ'}</div><div class="role-name">${roleIcons[me.role]} ${esc(roleNames[me.role])}</div><p>${esc(s.roles[me.role]?.[1]||'')}</p><div class="role-foot">${uses||'<span class="pill">Putere pasivă</span>'}</div></div>
 <div class="card"><div class="card-header"><h3>Locuitorii</h3><span class="pill">${s.players.filter(p=>p.alive).length} în viață</span></div><div class="roster">${s.players.map(p=>person(p,me.id)).join('')}</div></div>
 ${me.private?.length?`<div class="card"><h3>✦ Informații secrete</h3>${me.private.slice(-5).reverse().map(text=>`<div class="announce">${esc(text)}</div>`).join('')}</div>`:''}</div>
 <div><div class="card highlight"><div class="card-header"><h3>Ce trebuie să faci?</h3><span class="pill">${s.phase==='night'?'Putere':'Decizie'}</span></div>${actions(s)}</div>
 <div class="card"><div class="card-header"><h3>💬 Conversație</h3><span class="pill">${s.phase==='night'?'Noapte':'Oraș'}</span></div>${chat(s)}</div>
 <div class="card"><div class="card-header"><h3>🎙️ Voce (beta)</h3><span class="pill">Opțional</span></div><div class="voice-status"><button class="btn secondary small" id="micButton" onclick="window.MafiaVoice?.toggle()">🎙️ Intră în canalul vocal</button><small id="voiceInfo">Vocea cere permisiune din browser.</small></div><p class="tiny warning" style="margin-bottom:0">WebRTC experimental: necesită HTTPS și poate eșua între anumite rețele. Pentru camere cu peste 8 oameni reali, folosește chat text sau un apel extern.</p></div></div></div>`;
 return html;}
function renderEnd(s){return `<div class="card end-screen highlight"><div class="trophy">${s.winner==='Oraș'?'🏆':'♠'}</div><div class="eyebrow">VERDICTUL NOPȚII</div><h1>A câștigat ${esc(s.winner)}!</h1><p class="muted">Rolurile tuturor participanților:</p><div class="roster" style="margin:23px auto;max-width:600px">${s.players.map(p=>`<div class="person"><div class="avatar">${roleIcons[p.role]}</div><div><strong>${esc(p.name)}</strong><small>${esc(roleNames[p.role])}</small></div></div>`).join('')}</div><button class="btn gold" onclick="newGame()">♠ Creează o nouă partidă</button></div>`;}
function options(players){return players.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');}
function voting(s,people,title){const self=s.me;let opts=people.filter(p=>p.id!==self.id),choice=self.choice;
 return `<p class="action-hint">${title}</p><div class="voting-list">${opts.map(p=>`<label class="voting-option"><input type="radio" name="voteChoice" value="${esc(p.id)}" ${choice===p.id?'checked':''} onchange="sendVote(this.value)"><span>${esc(p.name)} ${p.bot?'🤖':''}</span></label>`).join('')}
 <label class="voting-option"><input type="radio" name="voteChoice" value="" ${choice===null?'checked':''} onchange="sendVote(null)"><span>Nimeni / Abținere</span></label></div>
 <p class="stage-note">Votul se înregistrează imediat. Îl poți schimba oricând înainte să expire timpul.</p>${choice?`<div class="action-confirm">✓ Ai votat: ${esc(s.players.find(p=>p.id===choice)?.name)}</div>`:'<div class="action-confirm">Nu ai ales pe nimeni.</div>'}`;}
function actions(s){const me=s.me,alive=s.players.filter(p=>p.alive),others=alive.filter(p=>p.id!==me.id),dead=s.players.filter(p=>!p.alive);
 if(!me.alive)return `<p class="action-hint">👁️ Ești spectator. Așteaptă să vezi cine supraviețuiește.</p>`;
 if(s.phase==='night0')return me.role==='trapper'?`<p class="action-hint">Alege acum unde pui capcana. Nu o vei putea muta mai târziu.</p><div class="field"><label>Protejează</label><select id="target">${options(others)}</select></div><button class="btn gold" onclick="sendAction('trap')">🪤 Plasează capcana</button>${me.trapTarget?'<div class="action-confirm">✓ Capcana este plasată.</div>':''}`:'<p class="action-hint">Memorează rolul tău. Mafia își descoperă echipa. Nu există atacuri în această noapte.</p>';
 if(s.phase==='day')return `<p class="action-hint">🗣️ Discută cu ceilalți. Mai întâi ascultă, apoi pune întrebări. Votul apare automat în ultimele 20 de secunde.</p><div class="tip">Ai grijă: orice jucător poate minți despre rolul său.</div>`;
 if(s.phase==='dayVote')return voting(s,others,s.largeRoom?'Cine sunt cei mai suspecți? Nominalizează o persoană.':'Pe cine vrei să elimini din joc?');
 if(s.phase==='defend')return `<p class="action-hint">Cei mai votați suspecți sunt:</p><div class="roster">${s.players.filter(p=>s.nominees.includes(p.id)).map(p=>person(p,me.id)).join('')}</div><p class="stage-note" id="defendInfo">Doar cei doi suspecți pot vorbi. Ceilalți ascultă.</p>`;
 if(s.phase==='finalVote')return voting(s,s.players.filter(p=>s.nominees.includes(p.id)),'Verdict: pe cine execuți? Ai doar 10 secunde.');
 if(s.phase==='judge')return me.role==='judge'&&me.uses.judge>0?`<p class="action-hint">Îl salvezi pe ${esc(s.pendingName)} sau accepți execuția?</p><button class="btn gold" onclick="socket.emit('action',{type:'pardon'})">⚖️ Grațiază jucătorul</button>`:`<p class="action-hint">Așteptăm hotărârea Judecătorului. Dacă nu intervine, execuția se aplică.</p>`;
 if(s.phase==='dawn')return `<div class="tip">☀️ Vezi anunțurile în conversația publică. Un rol mort se dezvăluie întotdeauna.</div>`;
 if(s.phase!=='night')return '<p>Se așteaptă următoarea etapă.</p>';
 if(me.team==='Mafia'){const targets=others.filter(p=>p.team!=='Mafia');const executors=alive.filter(p=>p.team==='Mafia');let html=`<p class="action-hint">🔪 Mafia alege împreună <b>o singură victimă</b>. Comunicarea este privată.</p><div class="field"><label>Victima propusă</label><select id="mafiaTarget">${options(targets)}</select></div><div class="field"><label>Executantul</label><select id="executor">${options(executors)}</select></div><button class="btn gold" onclick="sendMafia()">Confirmă votul Mafiei</button>${s.mafiaVotes[me.id]?`<div class="action-confirm">✓ Ai ales: ${esc(s.players.find(p=>p.id===s.mafiaVotes[me.id])?.name)}</div>`:''}`;
  if(me.role==='assassin'&&me.uses.special>0)html+='<div class="separator"></div><button class="btn primary" onclick="sendAction(\'special\')">🔪 Activează atacul special</button>';
  if(['forger','spy'].includes(me.role))html+=`<div class="separator"></div>${nightForm(me,others,dead)}`;
  return html;}
 return nightForm(me,others,dead);
}
function nightForm(me,others,dead){const map={detective:[['investigate','🔎 Investighează'],['shoot','🔫 Împușcă']],doctor:[['doctor','💊 Protejează']],guardian:[['guard','🛡️ Folosește scut']],watcher:[['watch','👁️ Urmărește']],jailer:[['jail','🔒 Închide']],journalist:[['journal','📰 Compară']],medium:[['medium','🕯️ Cheamă un mort']],forger:[['forge','🧪 Falsifică']],spy:[['spy','🕵️ Spionează']]};
 const abilities=(map[me.role]||[]).filter(([key])=>me.uses[key]===undefined||me.uses[key]>0);
 if(!abilities.length)return '<div class="tip">Puterea ta este pasivă sau nu mai ai utilizări. Poți să urmărești evenimentele.</div>';
 const targets=me.role==='medium'?dead:me.role==='doctor'?[...others,{id:me.id,name:'Eu însumi'}]:others;
 if(!targets.length)return '<p class="action-hint">Nu există ținte disponibile pentru această abilitate.</p>';
 return `<p class="action-hint">Alege abilitatea și ținta. Poți schimba selecția până când expiră noaptea.</p><div class="field"><label>Superputere</label><select id="ability">${abilities.map(([v,label])=>`<option value="${v}">${label}</option>`).join('')}</select></div>
 <div class="field"><label>${me.role==='medium'?'Jucător mort':'Ținta'}</label><select id="target">${options(targets)}</select></div>
 ${me.role==='journalist'?`<div class="field"><label>Al doilea jucător</label><select id="target2">${options(others)}</select></div>`:''}
 <button class="btn gold" onclick="sendAction()">⚡ Confirmă abilitatea</button>${me.action?`<div class="action-confirm">✓ Abilitate selectată: ${esc(me.action.type)}. Va fi rezolvată la sfârșitul nopții.</div>`:''}`;}
function currentSpeaker(s){return s.phase==='defend'?s.nominees:null;}
function channelPermissions(s){const me=s.me;const chans=[];
 if(['day','dayVote','defend','finalVote','judge','dawn'].includes(s.phase))chans.push(['public','📢 Oraș',s.phase==='day'||s.phase==='dayVote'?me.alive:s.phase==='defend'&&me.alive&&s.nominees.includes(me.id)]);
 if(me.alive&&me.team==='Mafia'&&s.phase==='night')chans.push(['mafia','🔪 Mafia',true]);
 if(!me.alive)chans.push(['dead','☠ Morți',true]);
 if(s.mediumPair.includes(me.id)&&s.phase==='night')chans.push(['medium','🕯 Medium',true]);
 return chans;}
function chat(s){const available=channelPermissions(s);if(!available.length)return '<p class="muted">Conversațiile sunt închise. Așteaptă următoarea etapă.</p>';
 if(!available.some(x=>x[0]===channel))channel=available[0][0];const writable=available.find(x=>x[0]===channel)?.[2];
 return `<div class="actions">${available.map(([key,label])=>`<button class="btn small ${channel===key?'gold':'secondary'}" onclick="setChannel('${key}')">${label}</button>`).join('')}</div>
 <div class="chatlog" id="chatlog">${s.messages.filter(m=>m.channel===channel).map(m=>`<div class="msg ${m.from==='Sistem'?'system':''}"><strong>${esc(m.from)}:</strong><span>${esc(m.text)}</span></div>`).join('')||'<p class="muted tiny">Încă nu există mesaje. Fii primul care vorbește.</p>'}</div>
 ${writable?`<div class="message-row"><input id="chatInput" autocomplete="off" maxlength="500" placeholder="Scrie mesajul aici..." onkeydown="if(event.key==='Enter')sendChat()"><button class="btn gold" onclick="sendChat()">Trimite ↗</button></div>`:
 `<div class="chat-locked">${s.phase==='defend'?'🔒 Doar cei doi suspecți pot vorbi acum.':'🔒 Nu ai drept de trimitere a mesajelor în această fază.'}</div>`}`;}
function setChannel(c){channel=c;render();}function sendChat(){const box=$('chatInput');const text=box?.value.trim();if(!text)return;socket.emit('chat',{text,channel});box.value='';}
function sendVote(target){socket.emit('choice',{target:target||null});}
function sendMafia(){const target=$('mafiaTarget')?.value,executor=$('executor')?.value;if(target)socket.emit('mafiaVote',{target,executor});}
function sendAction(type){const ability=type||$('ability')?.value;socket.emit('action',{type:ability,target:$('target')?.value,target2:$('target2')?.value});}
function copyLink(){const link=location.origin+'/?room='+state.code;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(()=>toast('Link copiat!')).catch(()=>toast('Selectează și copiază linkul manual.'));else toast('Selectează și copiază linkul manual.');}
function newGame(){localStorage.removeItem(sessionKey);state=null;history.replaceState(null,'','/');home();}
function updateClock(){if(!state?.deadline||!$('clock'))return;const ms=Math.max(0,state.deadline-Date.now()),seconds=Math.ceil(ms/1000),total=Math.max(1,state.deadline-state.phaseStart);
 $('clock').textContent=seconds;$('timerRing').style.background=`conic-gradient(${seconds<=8?'#c95461':'#dfb981'} ${(ms/total)*360}deg, #333c47 0deg)`;
 if(state.phase==='defend'){const info=$('defendInfo');if(info)info.textContent='Cei doi suspecți vorbesc acum. Ceilalți ascultă.';}
 window.MafiaVoice?.updatePermissions(state);}
setInterval(updateClock,350);
function joinFromStorage(){let saved;try{saved=JSON.parse(localStorage.getItem(sessionKey)||'null');}catch{return;}
 const linkRoom=getRoomFromUrl();if(saved?.code&&saved?.token&&(!linkRoom||linkRoom===saved.code))socket.emit('join',{code:saved.code,token:saved.token});}
socket.on('identity',x=>{identity=x;localStorage.setItem(sessionKey,JSON.stringify(x));history.replaceState(null,'','/?room='+x.code);});
socket.on('state',s=>{const phaseChanged=!!state&&state.phase!==s.phase;if(phaseChanged)sound(s.phase);state=s;render();});
socket.on('errorMessage',toast);
socket.on('connect',joinFromStorage);
socket.on('connect_error',()=>toast('Conexiunea la server a eșuat. Verifică internetul.'));
socket.on('disconnect',()=>toast('Conexiune întreruptă. Se încearcă reconectarea...'));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('rules').classList.contains('hidden'))hideRules();});
home();
