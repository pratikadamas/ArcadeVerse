(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const overlays = ['start-overlay','map-overlay','journal-overlay','help-overlay','ending-overlay'].map($);
  const ui = {
    room:$('room-name'),relics:$('relic-count'),health:$('health'),abilities:$('abilities'),objective:$('objective'),
    checkpoint:$('checkpoint-label'),map:$('map-overlay'),mapGrid:$('map-grid'),start:$('start-overlay'),
    continue:$('continue-button'),bestTime:$('best-time'),savedRelics:$('saved-relics')
  };
  const W=canvas.width,H=canvas.height;
  const ABILITY_LABELS={grapple:'PULSE GRAPPLE',phase:'PHASE DASH',brake:'AIR BRAKE'};
  const ROOMS={
    'canopy-arrival':{district:'Canopy Blocks',name:'Arrival Deck',grid:[0,0],color:'#63987a',links:{right:{to:'canopy-roof'}},platforms:[[0,510,900,30],[115,420,170,16],[375,350,155,16],[650,285,150,16]],anchors:[],collectibles:[],journals:[],checkpoints:[[80,475,'Arrival Deck']],objective:'Find the rooftop route.'},
    'canopy-roof':{district:'Canopy Blocks',name:'Hanging Gardens',grid:[1,0],color:'#78a77b',links:{left:{to:'canopy-arrival'},right:{to:'canopy-garden',needs:['grapple']},down:{to:'flood-station'}},platforms:[[0,510,900,30],[80,430,170,16],[300,355,175,16],[565,290,145,16],[740,420,115,16]],anchors:[[445,220],[660,205]],collectibles:[],ability:['grapple',370,320],journals:[[125,405,'The Last Gardener','The roots have found the old transit cables. They are stronger than the steel they replaced.']],checkpoints:[[100,475,'Hanging Gardens']],objective:'Recover the Pulse Grapple module.'},
    'canopy-garden':{district:'Canopy Blocks',name:'Overgrown Spire',grid:[2,0],color:'#84b782',links:{left:{to:'canopy-roof'},down:{to:'transit-gantry',needs:['grapple','phase']}},platforms:[[0,510,900,30],[90,430,150,16],[320,360,150,16],[565,295,170,16],[745,420,110,16]],anchors:[[250,320],[510,230],[730,235]],collectibles:[[790,390,'relic','Canopy Relic']],journals:[[650,270,'Green Again','Rain returned first. Then moss, ferns, and a forest that no longer needed the city.']],checkpoints:[[85,475,'Overgrown Spire']],objective:'Swing through the canopy and recover its relic.'},
    'flood-station':{district:'Floodline',name:'Intake Station',grid:[0,1],color:'#4c9896',links:{up:{to:'canopy-roof'},right:{to:'flood-pump',needs:['phase']}},platforms:[[0,510,900,30],[100,430,155,16],[360,350,165,16],[650,290,170,16]],anchors:[[310,270]],ability:['phase',460,320],collectibles:[],journals:[[680,270,'Below the Waterline','The lower streets became canals. The station kept the pumps running long after the grid failed.']],checkpoints:[[80,475,'Intake Station']],objective:'Find the Phase Dash module.'},
    'flood-pump':{district:'Floodline',name:'Tidal Pumpworks',grid:[1,1],color:'#438b92',links:{left:{to:'flood-station'},right:{to:'transit-gantry',needs:['phase','grapple']}},platforms:[[0,510,900,30],[100,430,170,16],[355,360,150,16],[635,300,180,16]],anchors:[[280,270],[570,205]],hazards:[[0,474,900,36,'water']],barriers:[[500,335,24,175,'pump-gate']],switches:[[380,465,'pump-powered','Power the intake gate']],collectibles:[[730,390,'relic','Floodline Relic']],journals:[[125,405,'Pressure Map','The pump schedule was scratched into a door: low tide opens the passage toward the rail spine.']],checkpoints:[[85,475,'Tidal Pumpworks']],objective:'Activate the pump switch, then recover the Floodline relic.'},
    'transit-gantry':{district:'Transit Spine',name:'Rail Gantry',grid:[2,1],color:'#907d61',links:{left:{to:'flood-pump',needs:['grapple','phase']},down:{to:'transit-lift',needs:['brake']}},platforms:[[0,510,900,30],[90,435,150,16],[340,350,170,16],[600,275,160,16]],anchors:[[290,245],[545,190]],ability:['brake',420,320],collectibles:[],journals:[[665,250,'The Quiet Platforms','When the trains stopped, the city lost its rhythm. The birds learned the schedule instead.']],checkpoints:[[85,475,'Rail Gantry']],objective:'Recover the Air Brake module.'},
    'transit-lift':{district:'Transit Spine',name:'Sky Lift Terminal',grid:[2,2],color:'#a08b6c',links:{up:{to:'transit-gantry'},left:{to:'sky-archive',needs:['brake']}},platforms:[[0,510,900,30],[80,430,155,16],[355,340,150,16],[690,275,140,16]],moving:[[490,420,120,14,105,0.8]],anchors:[[300,235],[650,190]],collectibles:[[760,245,'relic','Transit Relic']],journals:[[120,405,'Final Departure','A single train was sent uphill carrying the archive key. No one recorded who was aboard.']],checkpoints:[[82,475,'Sky Lift Terminal']],objective:'Ride the lift and recover the Transit relic.'},
    'sky-archive':{district:'Sky Archive',name:'Cloud Library',grid:[1,2],color:'#73a7a0',links:{right:{to:'transit-lift'},left:{to:'archive-core',needs:['grapple','phase','brake'],relics:3}},platforms:[[0,510,900,30],[75,425,160,16],[320,345,180,16],[600,270,155,16]],anchors:[[260,235],[550,190],[765,220]],collectibles:[[150,395,'record','Glasswing Record']],journals:[[370,310,'The Curator','The archive did not preserve the city as it was. It preserved the choices that made it worth saving.']],checkpoints:[[80,475,'Cloud Library']],objective:'Bring the relic fragments to the archive core.'},
    'archive-core':{district:'Sky Archive',name:'Memory Engine',grid:[0,2],color:'#8eb7aa',links:{right:{to:'sky-archive'}},platforms:[[0,510,900,30],[95,420,160,16],[360,325,160,16],[650,235,155,16]],anchors:[[300,235],[560,150]],switches:[[650,205,'archive-awake','Restore the memory engine']],collectibles:[],journals:[[140,390,'A Living Archive','The city was not a monument. It was a promise to leave the next generation room to build.']],checkpoints:[[90,475,'Memory Engine']],objective:'Restore the memory engine to complete the expedition.'}
  };

  let progress={room:'canopy-arrival',checkpoint:'canopy-arrival',abilities:[],relics:[],discovered:['canopy-arrival'],flags:{},records:[],elapsed:0};
  let player={x:75,y:470,w:22,h:30,vx:0,vy:0,face:1,ground:false,wall:0,grapple:null,rope:0,dash:0,dashCooldown:0,invulnerable:0,brake:false};
  let keyState=Object.create(null),touchState=Object.create(null),particles=[];
  let active=false,muted=false,audio=null,worldTime=0,lastFrame=performance.now(),lastHurt=0,runStarted=0,toastTimer=0;
  let movingPlatforms=[],currentRoom=null,waterDamageAt=0;
  let saveExists=false,bestChallenge=0;
  try{
    const raw=localStorage.getItem('skyline_relic_save');
    if(raw){const saved=JSON.parse(raw);if(saved&&typeof saved==='object'){progress=Object.assign(progress,saved);saveExists=true;}}
    bestChallenge=Number(localStorage.getItem('skyline_relic_best_time'))||0;
    muted=localStorage.getItem('skyline_relic_muted')==='true';
  }catch(_){saveExists=false;}
  $('best-time').textContent=bestChallenge?formatTime(bestChallenge):'—';
  $('saved-relics').textContent=progress.relics.length+' / 3';
  $('sound-button').textContent=muted?'SOUND OFF':'SOUND ON';
  $('continue-button').textContent=saveExists?'CONTINUE EXPEDITION':'BEGIN EXPEDITION';

  function formatTime(seconds){const m=Math.floor(seconds/60);const s=Math.floor(seconds%60);return m+':'+String(s).padStart(2,'0');}
  function hasAbility(name){return progress.abilities.includes(name);}
  function nowRoom(){return ROOMS[progress.room];}
  function centerX(){return player.x+player.w/2;}
  function centerY(){return player.y+player.h/2;}

  function save(){
    try{localStorage.setItem('skyline_relic_save',JSON.stringify(progress));saveExists=true;}catch(_){}
  }
  function sound(freq,duration,type){
    if(muted||!audio)return;
    try{const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type||'sine';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.55),audio.currentTime+duration);gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch(_){}
  }
  function startAudio(){if(!audio){const C=window.AudioContext||window.webkitAudioContext;if(C)audio=new C();}if(audio&&audio.state==='suspended')audio.resume();}
  function notify(message){let el=document.getElementById('skyline-toast');if(!el){el=document.createElement('div');el.id='skyline-toast';el.className='skyline-toast';el.setAttribute('role','status');document.body.appendChild(el);}el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900);}

  function begin(continueRun){
    startAudio();
    if(!continueRun){progress={room:'canopy-arrival',checkpoint:'canopy-arrival',abilities:[],relics:[],discovered:['canopy-arrival'],flags:{},records:[],elapsed:0};save();}
    if(!ROOMS[progress.room])progress.room='canopy-arrival';
    if(!ROOMS[progress.checkpoint])progress.checkpoint='canopy-arrival';
    player.health=3;
    active=true;runStarted=performance.now();waterDamageAt=0;
    const spawn=spawnFor(progress.room,'start');player.x=spawn.x;player.y=spawn.y;player.vx=0;player.vy=0;player.grapple=null;
    overlays.forEach(el=>el.classList.remove('visible'));
    currentRoom=nowRoom();movingPlatforms=(currentRoom.moving||[]).map((m,i)=>({x:m[0],y:m[1],w:m[2],h:m[3],base:m[1],amp:m[4],speed:m[5],phase:i}));
    updateHud();
  }
  function spawnFor(roomId,edge){
    if(edge==='left')return{x:W-player.w-8,y:455};
    if(edge==='right')return{x:8,y:455};
    if(edge==='up')return{x:W/2-player.w/2,y:H-player.h-35};
    if(edge==='down')return{x:W/2-player.w/2,y:80};
    const cp=(ROOMS[roomId].checkpoints||[])[0];return{x:cp?cp[0]:70,y:cp?cp[1]:470};
  }

  function updateHud(){
    const room=nowRoom();if(!room)return;
    ui.room.textContent=room.district+' / '+room.name;
    ui.relics.textContent=progress.relics.length+' / 3';
    ui.health.textContent='◆ '.repeat(Math.max(0,player.health===undefined?3:player.health)).trim()||'0';
    ui.abilities.textContent=progress.abilities.length?progress.abilities.map(a=>ABILITY_LABELS[a]).join(' / '):'NO MODULES';
    ui.objective.textContent='OBJECTIVE: '+room.objective.toUpperCase();
    ui.checkpoint.textContent='CHECKPOINT: '+(ROOMS[progress.checkpoint]||room).name.toUpperCase();
    if(document.getElementById('map-overlay').classList.contains('visible'))renderMap();
  }
  player.health=3;

  function roomActive(){return active&&!overlays.some(el=>el.classList.contains('visible'));}
  function platforms(){
    const solids=[];
    (currentRoom.platforms||[]).forEach((p,i)=>{
      if(p[1]>=H-40&&currentRoom.links&&currentRoom.links.down)solids.push({x:p[0],y:p[1],w:400,h:p[3],id:'p'+i+'a'},{x:500,y:p[1],w:400,h:p[3],id:'p'+i+'b'});
      else solids.push({x:p[0],y:p[1],w:p[2],h:p[3],id:'p'+i});
    });
    movingPlatforms.forEach((p,i)=>solids.push({x:p.x,y:p.y,w:p.w,h:p.h,id:'m'+i}));
    (currentRoom.barriers||[]).forEach(b=>{if(!progress.flags[b[4]]&&player.dash<=0)solids.push({x:b[0],y:b[1],w:b[2],h:b[3],id:b[4],phase:true});});
    return solids;
  }
  function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function intersectsPlatform(x,y,p){return x<p.x+p.w&&x+player.w>p.x&&y<p.y+p.h&&y+player.h>p.y;}

  function update(dt){
    if(!roomActive())return;
    worldTime+=dt;progress.elapsed+=dt;
    player.dashCooldown=Math.max(0,player.dashCooldown-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);
    movingPlatforms.forEach((p,i)=>{const spec=currentRoom.moving[i];p.y=p.base+Math.sin(worldTime*p.speed)*p.amp;});
    const left=keyState.ArrowLeft||keyState.a||touchState.left;
    const right=keyState.ArrowRight||keyState.d||touchState.right;
    const jump=keyState[' ']||keyState.ArrowUp||keyState.w||touchState.jump;
    const brake=keyState.ArrowDown||keyState.s||touchState.brake;
    const speed=touchState.slow?175:260;
    if(player.dash>0){player.dash=Math.max(0,player.dash-dt);player.vx=player.face*700;player.vy*=.94;}
    else{
      if(left){player.vx-=1700*dt;player.face=-1;}
      if(right){player.vx+=1700*dt;player.face=1;}
      if(!left&&!right)player.vx*=Math.pow(.0009,dt);
      player.vx=Math.max(-speed,Math.min(speed,player.vx));
      const gravity=brake&&hasAbility('brake')&&player.vy>0?380:1450;
      player.vy=Math.min(brake&&hasAbility('brake')?170:730,player.vy+gravity*dt);
    }
    player.brake=!!(brake&&hasAbility('brake')&&player.vy>0);
    const solids=platforms();
    player.wall=0;
    const oldX=player.x;player.x+=player.vx*dt;
    for(const p of solids){if(intersectsPlatform(player.x,player.y,p)){
      if(oldX+player.w<=p.x+4){player.x=p.x-player.w;player.vx=0;player.wall=1;}
      else if(oldX>=p.x+p.w-4){player.x=p.x+p.w;player.vx=0;player.wall=-1;}
    }}
    const oldY=player.y;player.y+=player.vy*dt;player.ground=false;
    for(const p of solids){if(intersectsPlatform(player.x,player.y,p)){
      if(player.vy>=0&&oldY+player.h<=p.y+8){player.y=p.y-player.h;player.vy=0;player.ground=true;}
      else if(player.vy<0&&oldY>=p.y+p.h-5){player.y=p.y+p.h;player.vy=0;}
    }}
    if(jump&&!keyState._jumpLatch){
      if(player.ground){player.vy=-565;player.ground=false;sound(330,.08);}
      else if(player.wall){player.vy=-525;player.vx=player.wall*330;player.face=player.wall;sound(390,.09);}
      keyState._jumpLatch=true;
    }
    if(!jump)keyState._jumpLatch=false;
    updateGrapple(dt);
    if(player.y>H+55){damagePlayer('A missed ledge dropped you into the flood.');return;}
    handleDoors();
    updateHazards(dt);
    updateCollectibles();
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
    updateHud();
  }

  function updateGrapple(dt){
    if(!player.grapple)return;
    const a=player.grapple;const dx=(a.x-centerX()),dy=(a.y-centerY());const dist=Math.hypot(dx,dy)||1;
    if(dist>player.rope){
      const nx=dx/dist,ny=dy/dist;player.x+=dx*(dist-player.rope)/dist;player.y+=dy*(dist-player.rope)/dist;
      const radial=player.vx*nx+player.vy*ny;
      if(radial<0){player.vx-=radial*nx;player.vy-=radial*ny;}
    }
    if(keyState.ArrowUp||keyState.w)player.rope=Math.max(70,player.rope-90*dt);
    if(keyState.ArrowDown||keyState.s)player.rope=Math.min(230,player.rope+90*dt);
  }

  function handleDoors(){
    const links=currentRoom.links||{};let edge=null;
    if(player.x<-8)edge='left';else if(player.x+player.w>W+8)edge='right';else if(player.y<-8)edge='up';else if(player.y+player.h>H+8)edge='down';
    if(!edge)return;
    const link=links[edge];
    if(!link){player.x=Math.max(0,Math.min(W-player.w,player.x));player.y=Math.max(0,Math.min(H-player.h,player.y));player.vx=0;player.vy=0;return;}
    const missing=(link.needs||[]).filter(a=>!hasAbility(a));
    if(missing.length||((link.relics||0)>progress.relics.length)){
      player.x=Math.max(0,Math.min(W-player.w,player.x));player.y=Math.max(0,Math.min(H-player.h,player.y));player.vx=0;player.vy=0;
      notify(missing.length?'Route requires '+ABILITY_LABELS[missing[0]]+'.':'Recover '+link.relics+' relic fragments to open this route.');return;
    }
    enterRoom(link.to,edge);
  }

  function enterRoom(id,fromEdge,fastTravel){
    if(!ROOMS[id])return;
    progress.room=id;if(!progress.discovered.includes(id))progress.discovered.push(id);
    const targetEdge=fromEdge==='right'?'left':fromEdge==='left'?'right':fromEdge==='up'?'down':fromEdge==='down'?'up':'start';
    const spawn=spawnFor(id,targetEdge);player.x=spawn.x;player.y=spawn.y;player.vx=0;player.vy=0;player.grapple=null;player.dash=0;
    currentRoom=ROOMS[id];movingPlatforms=(currentRoom.moving||[]).map((m,i)=>({x:m[0],y:m[1],w:m[2],h:m[3],base:m[1],amp:m[4],speed:m[5],phase:i}));
    waterDamageAt=0;
    if(currentRoom.checkpoints&&currentRoom.checkpoints.length){progress.checkpoint=id;player.health=3;notify('Checkpoint reached: '+currentRoom.name+'.');}
    save();updateHud();renderMap();
    sound(fastTravel?430:560,.13);
  }

  function abilityDescription(a){return a==='grapple'?'Tap a ring anchor or press G to latch. Press G again or jump to release.':a==='phase'?'Press Shift or tap DASH to phase through glowing barriers. The dash briefly protects you.':'Hold S or DOWN while airborne to slow your fall and land precisely.';}
  function showJournal(title,copy){$('journal-title').textContent=title;$('journal-copy').textContent=copy;$('journal-overlay').classList.add('visible');}

  function updateHazards(dt){
    const px=centerX(),py=player.y+player.h-3;
    for(const hazard of currentRoom.hazards||[]){
      if(hazard[4]==='water'){
        const wave=hazard[1]+Math.sin(worldTime*1.2)*16;
        if(py>wave&&worldTime>waterDamageAt){damagePlayer('Cold floodwater drained one integrity.');waterDamageAt=worldTime+2.4;return;}
      }else if(rectHit({x:player.x,y:player.y,w:player.w,h:player.h},{x:hazard[0],y:hazard[1],w:hazard[2],h:hazard[3]})){damagePlayer('A hazard cost one integrity.');return;}
    }
  }
  function damagePlayer(message){
    if(player.invulnerable>0)return;
    player.health=Math.max(0,player.health-1);player.invulnerable=1.2;player.vy=-300;player.vx=-player.face*170;player.grapple=null;
    notify(message);sound(115,.3,'sawtooth');burst(centerX(),centerY(),'#ff8e79',12);
    if(player.health<=0){const cp=progress.checkpoint;player.health=3;enterRoom(cp,'start');notify('Recovered at '+ROOMS[cp].name+'.');}
    updateHud();
  }

  function updateCollectibles(){
    const coords=currentRoom.collectibles||[];
    for(let i=coords.length-1;i>=0;i--){const item=coords[i];if(item[4]||(item[2]==='relic'&&progress.relics.includes(item[3]))||(item[2]==='record'&&progress.flags['record-'+item[3]]))continue;
      if(Math.hypot(centerX()-(item[0]+10),centerY()-(item[1]+10))<27){
        if(item[2]==='relic'){
          if(!progress.relics.includes(item[3]))progress.relics.push(item[3]);item[4]=true;
          showJournal(item[3],relicStory(progress.relics.length));save();sound(780,.2);burst(item[0],item[1],'#f3cb83',18);
        }else{item[4]=true;progress.flags['record-'+item[3]]=true;notify('Hidden record found: '+item[3]+'.');save();sound(890,.16);burst(item[0],item[1],'#70e6dd',14);}
      }
    }
    if(currentRoom.ability){const [ability,x,y]=currentRoom.ability;if(!hasAbility(ability)&&Math.hypot(centerX()-x,centerY()-y)<30){progress.abilities.push(ability);save();showJournal('Traversal Module Recovered',ABILITY_LABELS[ability]+' is online. '+abilityDescription(ability));sound(940,.25);burst(x,y,'#8af0c0',20);}}
    for(const cp of currentRoom.checkpoints||[]){if(Math.hypot(centerX()-cp[0],centerY()-cp[1])<27&&progress.checkpoint!==progress.room){progress.checkpoint=progress.room;player.health=3;save();notify('Checkpoint activated: '+cp[2]+'.');}}
  }
  function relicStory(n){return ['A brass leaf sealed in glass. An inscription reads: “The garden was the first place we learned to share the light.”','A pump key etched with three flood marks. Someone kept the lower district alive through every rising tide.','A memory prism. The archive can open now; the last record is waiting above the clouds.'][Math.min(2,n-1)];}

  function interact(){
    if(!roomActive())return;
    const px=centerX(),py=centerY();
    for(const sw of currentRoom.switches||[]){
      if(Math.hypot(px-sw[0],py-sw[1])<70){progress.flags[sw[2]]=!progress.flags[sw[2]];save();notify(progress.flags[sw[2]]?'Circuit restored. Passage unlocked.':'Circuit disabled.');sound(progress.flags[sw[2]]?650:240,.14);burst(sw[0],sw[1],'#70e6dd',10);return;}
    }
    if(progress.room==='archive-core'&&!progress.flags.complete&&Math.hypot(px-780,py-205)<105){
      if(progress.relics.length>=3&&['grapple','phase','brake'].every(hasAbility)){finishExpedition();}
      else notify('The archive needs three relics and all traversal modules.');return;
    }
    if(currentRoom.journals){for(const j of currentRoom.journals){if(Math.hypot(px-j[0],py-j[1])<65){if(progress.records.includes(j[2])){notify('Archive entry already read.');return;}progress.records.push(j[2]);save();showJournal(j[2],j[3]);sound(520,.14);return;}}}
    if(progress.room==='canopy-arrival')showJournal('Expedition Brief','The Sunken City disappeared from the maps after the flood. Your instruments still detect a living archive above the clouds. Find three relic fragments and restore the memory engine.');
    else notify('Nothing nearby responds. Look for a switch or an archive marker.');
  }

  function finishExpedition(){
    active=false;progress.flags.complete=true;const seconds=progress.elapsed;if(!bestChallenge||seconds<bestChallenge){bestChallenge=seconds;try{localStorage.setItem('skyline_relic_best_time',String(bestChallenge));}catch(_){}$('best-time').textContent=formatTime(bestChallenge);}
    $('ending-copy').textContent='All three relics are restored. The archive opens its final record: “A city survives when its people leave room for one another.” Expedition time: '+formatTime(seconds)+'.';$('ending-overlay').classList.add('visible');sound(680,.2);setTimeout(()=>sound(920,.28),140);save();
  }

  function renderMap(){
    ui.mapGrid.textContent='';const entries=Object.entries(ROOMS);
    entries.sort((a,b)=>a[1].grid[1]-b[1].grid[1]||a[1].grid[0]-b[1].grid[0]);
    for(const [id,room] of entries){
      const btn=document.createElement('button');btn.type='button';btn.className='map-room';
      const visited=progress.discovered.includes(id);const isCurrent=progress.room===id;const linkReq=Object.values(ROOMS).flatMap(r=>Object.values(r.links||{})).find(l=>l.to===id&&!visited);
      if(visited)btn.classList.add('visited');if(isCurrent)btn.classList.add('current');
      const title=document.createElement('b');title.textContent=room.name;
      const meta=document.createElement('span');meta.textContent=visited?room.district:isLockedRoom(id)?'LOCKED ROUTE':room.district;
      btn.append(title,meta);
      if(!visited){btn.disabled=true;btn.classList.add('locked');}
      else if(!isCurrent)btn.addEventListener('click',()=>{ui.map.classList.remove('visible');enterRoom(id,'start',true);});
      else btn.disabled=true;
      ui.mapGrid.appendChild(btn);
    }
  }
  function isLockedRoom(id){for(const room of Object.values(ROOMS)){for(const link of Object.values(room.links||{})){if(link.to===id&&((link.needs||[]).some(a=>!hasAbility(a))||(link.relics||0)>progress.relics.length))return true;}}return false;}

  function grapple(){
    if(!roomActive())return;
    if(player.grapple){player.grapple=null;player.vy-=100;sound(410,.1);return;}
    if(!hasAbility('grapple')){notify('Pulse Grapple module not found.');return;}
    let best=null,dist=215;
    for(const [x,y] of currentRoom.anchors||[]){const d=Math.hypot(centerX()-x,centerY()-y);if(d<dist){best={x,y};dist=d;}}
    if(!best){notify('No anchor in grapple range.');return;}
    player.grapple=best;player.rope=Math.max(75,dist);sound(560,.13);burst(best.x,best.y,'#70e6dd',5);
  }
  function dash(){
    if(!roomActive())return;
    if(!hasAbility('phase')){notify('Phase Dash module not found.');return;}
    if(player.dashCooldown>0)return;
    player.grapple=null;player.dash=.22;player.dashCooldown=1.05;player.invulnerable=.28;player.vx=player.face*700;player.vy=-20;
    sound(760,.13,'sawtooth');burst(centerX(),centerY(),'#b7a3ff',9);
  }
  function burst(x,y,color,count){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*180,vy:(Math.random()-.7)*190,life:.35+Math.random()*.4,color});}

  function drawBackground(){
    const room=currentRoom||ROOMS['canopy-arrival'];const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,room.color);g.addColorStop(.45,'#294943');g.addColorStop(1,'#122b2e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Mist layers and a distant drowned skyline.
    ctx.globalAlpha=.2;for(let i=0;i<8;i++){const x=(i*147+worldTime*(i%2?7:-4))%1100-100;const bh=120+(i*43)%150;ctx.fillStyle=i%2?'#d3e7bb':'#183c40';ctx.fillRect(x,310-bh,85,bh+220);ctx.fillStyle='#c3ddb2';for(let yy=340-bh;yy<480;yy+=22)ctx.fillRect(x+13,yy,5,8);}ctx.globalAlpha=1;
    ctx.fillStyle='rgba(5,20,22,.18)';for(let y=0;y<H;y+=5)ctx.fillRect(0,y,W,1);
  }
  function drawWorld(){
    drawBackground();
    for(const p of platforms()){
      if(p.phase){ctx.fillStyle='#8377b8';ctx.shadowBlur=14;ctx.shadowColor='#ae9bff';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.shadowBlur=0;ctx.fillStyle='#d0c5ff';for(let x=p.x+4;x<p.x+p.w;x+=12)ctx.fillRect(x,p.y+3,4,p.h-6);continue;}
      ctx.fillStyle='#263e38';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#8cb995';ctx.fillRect(p.x,p.y,p.w,4);ctx.fillStyle='#40624c';for(let x=p.x+8;x<p.x+p.w;x+=29)ctx.fillRect(x,p.y+6,4,3);
    }
    drawDoors();drawAnchors();drawSwitches();drawHazards();drawCollectibles();drawPlayer();
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/0.75);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4);}ctx.globalAlpha=1;
    if(player.grapple){ctx.strokeStyle='#70e6dd';ctx.lineWidth=2;ctx.shadowBlur=10;ctx.shadowColor='#70e6dd';ctx.beginPath();ctx.moveTo(centerX(),centerY());ctx.lineTo(player.grapple.x,player.grapple.y);ctx.stroke();ctx.shadowBlur=0;}
    if(player.brake){ctx.fillStyle='#bce9ff';ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(centerX()-5,player.y+player.h);ctx.lineTo(centerX(),player.y+player.h+15);ctx.lineTo(centerX()+5,player.y+player.h);ctx.fill();ctx.globalAlpha=1;}
    drawRoomName();
  }
  function drawDoors(){
    for(const [edge,link] of Object.entries(currentRoom.links||{})){
      const missing=(link.needs||[]).filter(a=>!hasAbility(a));const relicMissing=(link.relics||0)>progress.relics.length;
      const locked=missing.length>0||relicMissing;ctx.fillStyle=locked?'#c4a7ff77':'#9af5ca99';ctx.strokeStyle=locked?'#c6a8ff':'#a7ffd1';ctx.lineWidth=3;ctx.shadowBlur=12;ctx.shadowColor=locked?'#b69aff':'#8af0c0';
      let x,y,w,h;if(edge==='left'){x=0;y=420;w=18;h=90;}else if(edge==='right'){x=W-18;y=420;w=18;h=90;}else if(edge==='up'){x=405;y=0;w=90;h=18;}else{x=405;y=H-18;w=90;h=18;}
      ctx.fillRect(x,y,w,h);ctx.strokeRect(x+3,y+3,w-6,h-6);ctx.shadowBlur=0;
      if(locked){ctx.font='9px Arial';ctx.fillStyle='#eee3ff';ctx.textAlign='center';ctx.fillText(missing.length?ABILITY_LABELS[missing[0]]:link.relics+' RELICS',edge==='left'?50:edge==='right'?W-55:W/2,edge==='up'?34:edge==='down'?H-28:450);}
    }
  }
  function drawAnchors(){for(const [x,y]of currentRoom.anchors||[]){const pulse=1+Math.sin(worldTime*3+x)*.12;ctx.beginPath();ctx.arc(x,y,12*pulse,0,Math.PI*2);ctx.strokeStyle='#70e6dd';ctx.lineWidth=2;ctx.shadowBlur=15;ctx.shadowColor='#70e6dd';ctx.stroke();ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#c4fff4';ctx.fill();ctx.shadowBlur=0;}}
  function drawSwitches(){for(const sw of currentRoom.switches||[]){const on=!!progress.flags[sw[2]];ctx.fillStyle=on?'#8af0c0':'#f3cb83';ctx.shadowBlur=15;ctx.shadowColor=on?'#8af0c0':'#f3cb83';ctx.fillRect(sw[0]-9,sw[1]-9,18,18);ctx.shadowBlur=0;ctx.fillStyle='#f2f4e8';ctx.font='9px Arial';ctx.textAlign='center';ctx.fillText(on?'POWER ON':'E / SWITCH',sw[0],sw[1]-17);}}
  function drawHazards(){for(const hz of currentRoom.hazards||[]){if(hz[4]==='water'){const surface=hz[1]+Math.sin(worldTime*1.2)*16;ctx.fillStyle='#307d8977';ctx.fillRect(hz[0],surface,hz[2],H-surface);ctx.strokeStyle='#72dbe0';ctx.lineWidth=2;ctx.beginPath();for(let x=hz[0];x<=hz[0]+hz[2];x+=8){const yy=surface+Math.sin(x*.03+worldTime*2)*4;if(x===hz[0])ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}else{ctx.fillStyle='#ff927e';ctx.beginPath();for(let x=hz[0];x<hz[0]+hz[2];x+=20){ctx.moveTo(x,hz[1]+hz[3]);ctx.lineTo(x+10,hz[1]);ctx.lineTo(x+20,hz[1]+hz[3]);}ctx.fill();}}}
  function drawCollectibles(){
    (currentRoom.collectibles||[]).forEach(item=>{if(item[4]||(item[2]==='relic'&&progress.relics.includes(item[3]))||(item[2]==='record'&&progress.flags['record-'+item[3]]))return;const x=item[0],y=item[1];ctx.save();ctx.translate(x+10,y+10);ctx.rotate(Math.sin(worldTime*1.4)*.12);ctx.shadowBlur=17;ctx.shadowColor=item[2]==='relic'?'#f3cb83':'#70e6dd';ctx.strokeStyle=item[2]==='relic'?'#f3cb83':'#70e6dd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(8,0);ctx.lineTo(0,10);ctx.lineTo(-8,0);ctx.closePath();ctx.stroke();ctx.restore();});
    if(currentRoom.ability){const [a,x,y]=currentRoom.ability;if(!hasAbility(a)){ctx.beginPath();ctx.arc(x,y,15+Math.sin(worldTime*3)*2,0,Math.PI*2);ctx.strokeStyle='#8af0c0';ctx.lineWidth=2;ctx.shadowBlur=18;ctx.shadowColor='#8af0c0';ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#baffd7';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(ABILITY_LABELS[a],x,y-24);}}
    for(const j of currentRoom.journals||[]){const found=progress.records.includes(j[2]);ctx.fillStyle=found?'#61776f':'#d4bd79';ctx.fillRect(j[0]-7,j[1]-7,14,14);ctx.fillStyle='#152b2a';ctx.fillRect(j[0]-3,j[1]-3,6,6);}
  }
  function drawPlayer(){
    if(player.invulnerable>0&&Math.floor(worldTime*17)%2)return;
    ctx.save();ctx.translate(centerX(),player.y+player.h/2);ctx.scale(player.face,1);ctx.shadowBlur=15;ctx.shadowColor='#a9f1ce';ctx.fillStyle='#d3f4dd';ctx.beginPath();ctx.roundRect(-9,-14,18,28,5);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#276b61';ctx.fillRect(0,-6,7,4);ctx.fillStyle='#f3cb83';ctx.fillRect(-6,9,5,5);ctx.restore();
  }
  function drawRoomName(){ctx.textAlign='right';ctx.font='bold 9px Arial';ctx.fillStyle='#d7e9dcaa';ctx.fillText(currentRoom.district.toUpperCase(),W-18,24);}

  function renderMap(){
    ui.mapGrid.textContent='';
    const ids=Object.keys(ROOMS).sort((a,b)=>ROOMS[a].grid[1]-ROOMS[b].grid[1]||ROOMS[a].grid[0]-ROOMS[b].grid[0]);
    for(const id of ids){const room=ROOMS[id],button=document.createElement('button');button.type='button';button.className='map-room';button.style.gridColumn=String(room.grid[0]+1);button.style.gridRow=String(room.grid[1]+1);const visited=progress.discovered.includes(id);if(visited)button.classList.add('visited');if(id===progress.room)button.classList.add('current');if(!visited)button.classList.add('locked');
      const title=document.createElement('b');title.textContent=room.name;const meta=document.createElement('span');meta.textContent=visited?room.district:isLockedRoom(id)?'LOCKED ROUTE':room.district;button.append(title,meta);button.disabled=!visited||id===progress.room;if(visited&&id!==progress.room)button.addEventListener('click',()=>{ui.map.classList.remove('visible');enterRoom(id,'start',true);});ui.mapGrid.appendChild(button);
    }
  }
  function isLockedRoom(id){return Object.values(ROOMS).some(room=>Object.values(room.links||{}).some(link=>link.to===id&&((link.needs||[]).some(a=>!hasAbility(a))||(link.relics||0)>progress.relics.length)));}
  function toggleMap(){if(!active)return;renderMap();ui.map.classList.toggle('visible');}

  function frame(now){if(teardown)return;const dt=Math.min(.035,(now-lastFrame)/1000||0);lastFrame=now;if(active){update(dt);drawWorld();}else{currentRoom=nowRoom();drawWorld();}requestAnimationFrame(frame);}
  function keydown(event){const k=event.key.length===1?event.key.toLowerCase():event.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key))event.preventDefault();
    if(k==='m'){toggleMap();return;}if(k==='Escape'){overlays.forEach(el=>el.classList.remove('visible'));return;}
    if(k==='e'&&!event.repeat){interact();return;}if(k==='g'&&!event.repeat){grapple();return;}if((k==='Shift'||k==='ShiftLeft')&&!event.repeat){dash();return;}
    if((k===' '||k==='ArrowUp'||k==='w')&&!event.repeat&&player.grapple){player.grapple=null;player.vy-=110;return;}
    keyState[k]=true;
  }
  function keyup(event){const k=event.key.length===1?event.key.toLowerCase():event.key;keyState[k]=false;}

  canvas.addEventListener('pointerdown',event=>{
    if(!roomActive())return;const rect=canvas.getBoundingClientRect();const x=(event.clientX-rect.left)*W/rect.width;const y=(event.clientY-rect.top)*H/rect.height;
    let selected=null,dist=52;for(const [ax,ay]of currentRoom.anchors||[]){const d=Math.hypot(ax-x,ay-y);if(d<dist){dist=d;selected={x:ax,y:ay};}}
    if(selected){if(player.grapple){player.grapple=null;player.vy-=100;}else if(hasAbility('grapple')){player.grapple=selected;player.rope=Math.max(75,Math.hypot(centerX()-selected.x,centerY()-selected.y));sound(560,.12);}else notify('Recover the Pulse Grapple module first.');}
  });
  document.querySelectorAll('[data-hold]').forEach(button=>{
    const name=button.dataset.hold;const down=e=>{e.preventDefault();touchState[name]=true;button.classList.add('active');};const up=e=>{e.preventDefault();touchState[name]=false;button.classList.remove('active');};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up);
  });
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>button.dataset.action==='grapple'?grapple():dash()));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).classList.remove('visible')));
  $('map-button').addEventListener('click',toggleMap);$('guide-button').addEventListener('click',()=>{if(active)$('help-overlay').classList.add('visible');});
  $('continue-button').addEventListener('click',()=>begin(saveExists));$('new-game').addEventListener('click',()=>begin(false));$('sound-button').addEventListener('click',event=>{muted=!muted;event.currentTarget.textContent=muted?'SOUND OFF':'SOUND ON';try{localStorage.setItem('skyline_relic_muted',String(muted));}catch(_){}if(!muted)startAudio();});
  $('ending-close').addEventListener('click',()=>{$('ending-overlay').classList.remove('visible');active=true;progress.room='archive-core';player.x=740;player.y=175;save();updateHud();});
  document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();});
  window.addEventListener('ARCADEVERSE_TEARDOWN',()=>{teardown=true;active=false;clearTimeout(toastTimer);if(audio&&audio.state!=='closed')audio.close();});

  currentRoom=ROOMS[progress.room]||ROOMS['canopy-arrival'];movingPlatforms=(currentRoom.moving||[]).map(m=>({x:m[0],y:m[1],w:m[2],h:m[3],base:m[1],amp:m[4],speed:m[5],phase:0}));
  requestAnimationFrame(frame);
}());
