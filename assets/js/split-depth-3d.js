(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    const sdk = root.ArcadeVerse || (root.ArcadeVerse = {});
    sdk.effects = Object.assign(sdk.effects || {}, api);
    api.mountSplitDepthStudio(root.document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const LIMIT = 4 * 1024 * 1024, mounted = new WeakMap();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function bounded(n, min, max) { if (!Number.isFinite(n) || n < min || n > max) throw new RangeError('Invalid depth-studio parameter.'); return n; }
  function getDepthLayout(width, height, options = {}) {
    bounded(width, 64, 2048); bounded(height, 64, 2048);
    const axis = options.axis ?? 'vertical', count = options.count ?? 2, thickness = options.thickness ?? 22;
    if (!['vertical','horizontal'].includes(axis) || !Number.isInteger(count) || count < 2 || count > 6) throw new RangeError('Use 2–6 vertical or horizontal bars.');
    bounded(thickness, 4, 60); const flat = Boolean(options.flat), time = flat ? 0 : bounded(options.time ?? Math.PI / 2, -1e6, 1e6);
    const point = options.pointer ?? { x: 0, y: 0 };
    const px = flat ? 0 : clamp(bounded(point.x, -1000, 1000), -1, 1), py = flat ? 0 : clamp(bounded(point.y, -1000, 1000), -1, 1);
    const bars = flat ? [] : Array.from({length:count},(_,i)=>axis==='vertical'
      ? {x:width*(i+1)/(count+1)-thickness/2,y:-height*.2,width:thickness,height:height*1.4}
      : {x:-width*.2,y:height*(i+1)/(count+1)-thickness/2,width:width*1.4,height:thickness});
    return {width,height,bars,angle:(axis==='vertical'?px:py)*.04,background:{x:-px*10,y:-py*6},foreground:{x:width*.5+(flat?0:Math.sin(time)*width*.18)+px*22,y:height*.5+(flat?0:Math.cos(time*.7)*height*.03)+py*14,radius:Math.min(width,height)*.09}};
  }
  function renderSplitDepthFrame(context, options = {}, layers = {}) {
    if (!context?.canvas) throw new TypeError('Expected a 2D drawing context.');
    const s=getDepthLayout(context.canvas.width,context.canvas.height,options),{width:w,height:h}=s;
    context.save();
    try {
      context.clearRect(0,0,w,h);context.fillStyle='#101a31';context.fillRect(0,0,w,h);
      context.save();context.translate(s.background.x,s.background.y);
      if(layers.background)context.drawImage(layers.background,-20,-20,w+40,h+40);
      else {context.fillStyle='#365175';for(let i=0;i<45;i++)context.fillRect((i*137)%w,(i*67)%h,2,2);context.fillStyle='#18335b';context.fillRect(w*.1,h*.7,w*.8,h*.12);}
      context.restore();
      context.save();context.translate(w/2,h/2);context.rotate(s.angle);context.translate(-w/2,-h/2);context.fillStyle='#ffffff';for(const b of s.bars)context.fillRect(b.x,b.y,b.width,b.height);context.restore();
      const f=s.foreground;
      if(layers.foreground){const scale=2.7*f.radius/Math.max(layers.foreground.width,layers.foreground.height);context.drawImage(layers.foreground,f.x-layers.foreground.width*scale/2,f.y-layers.foreground.height*scale/2,layers.foreground.width*scale,layers.foreground.height*scale);}
      else {context.fillStyle='#22d3ee';context.beginPath();context.arc(f.x,f.y,f.radius,0,Math.PI*2);context.fill();context.fillStyle='#bdf7ff';context.beginPath();context.arc(f.x-f.radius*.3,f.y-f.radius*.3,f.radius*.12,0,Math.PI*2);context.fill();}
    } finally {context.restore();}
    return s;
  }
  function validatePngHeader(bytes, totalBytes = bytes?.length) {
    if (!(bytes instanceof Uint8Array) || bytes.length<24 || !Number.isInteger(totalBytes) || totalBytes<24 || totalBytes>LIMIT) throw new RangeError('Choose a PNG up to 4 MiB.');
    const signature=[137,80,78,71,13,10,26,10];if(!signature.every((v,i)=>bytes[i]===v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw new TypeError('Choose a valid PNG image.');
    const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=data.getUint32(16),height=data.getUint32(20);bounded(width,1,2048);bounded(height,1,2048);return{width,height};
  }
  class SplitDepthRenderer {
    constructor(canvas, environment={}) {
      if(!canvas || typeof canvas.getContext!=='function')throw new TypeError('Expected a canvas.');
      if(canvas.width===0||canvas.height===0){canvas.width=800;canvas.height=450;}
      this.canvas=canvas;this.context=canvas.getContext('2d');if(!this.context)throw new Error('Canvas drawing is unavailable.');
      this.raf=environment.requestFrame??globalThis.requestAnimationFrame?.bind(globalThis);this.cancel=environment.cancelFrame??globalThis.cancelAnimationFrame?.bind(globalThis);this.now=environment.now??(()=>performance.now());this.onChange=environment.onChange??(()=>{});
      this.lowPower=Boolean(environment.lowPower);this.reducedMotion=Boolean(environment.reducedMotion);this.config={axis:'vertical',count:2,thickness:22,quality:'auto',pointer:{x:0,y:0}};
      this.layers={background:null,foreground:null};this.phase=Math.PI/2;this.running=false;this.disposed=false;this.revision=0;this.pending=null;this.previous=null;this.intervals=[];this.adaptiveFlat=false;this.drawMs=0;this.error=null;this.draw();
    }
    get flat(){return this.config.quality==='flat'||this.config.quality==='auto'&&(this.lowPower||this.adaptiveFlat);}
    getStats(){return{running:this.running,flat:this.flat,quality:this.config.quality,drawMs:this.drawMs,callbackFps:this.intervals.length?1000/(this.intervals.reduce((a,b)=>a+b,0)/this.intervals.length):null,error:this.error};}
    notify(message){this.onChange({...this.getStats(),message});}
    draw(){if(this.disposed)return;const start=this.now();renderSplitDepthFrame(this.context,{...this.config,time:this.phase,flat:this.flat},this.layers);this.drawMs=Math.max(0,this.now()-start);}
    configure(patch){
      if(this.disposed)throw new Error('Renderer is disposed.');const next={...this.config,...patch,pointer:{...(patch.pointer??this.config.pointer)}};
      if(!['auto','full','flat'].includes(next.quality))throw new RangeError('Unknown quality mode.');getDepthLayout(this.canvas.width,this.canvas.height,{...next,time:this.phase});
      this.config=next;this.error=null;if(patch.quality!==undefined)this.adaptiveFlat=false;this.revision++;if(this.flat)this.stop();this.draw();this.notify(this.flat?'Flat 2D preview.':'Split-depth preview.');
    }
    setLayerImage(kind,image){
      if(this.disposed||!['background','foreground'].includes(kind))throw new Error('Invalid image layer.');bounded(image?.width,1,2048);bounded(image?.height,1,2048);
      const old=this.layers[kind];if(old!==image){old?.close?.();this.layers[kind]=image;}this.revision++;this.draw();this.notify('Local image loaded.');
    }
    clearImages(){for(const kind of['background','foreground']){this.layers[kind]?.close?.();this.layers[kind]=null;}this.revision++;this.draw();}
    start(){
      if(this.disposed)throw new Error('Renderer is disposed.');if(this.running)return true;
      if(this.reducedMotion||this.flat){this.draw();this.notify(this.reducedMotion?'Motion is paused for reduced motion.':'Flat 2D preview.');return false;}
      if(typeof this.raf!=='function'||typeof this.cancel!=='function')throw new Error('Animation frames are unavailable.');
      this.running=true;this.revision++;this.previous=null;this.intervals=[];this.error=null;
      const tick=timestamp=>{
        this.pending=null;if(!this.running||this.disposed)return;
        try{
          bounded(timestamp,0,1e12);
          if(this.previous!==null){const delta=timestamp-this.previous;if(delta>0){this.intervals.push(delta);if(this.intervals.length>30)this.intervals.shift();this.phase=(this.phase+Math.min(delta,100)/1000)%(Math.PI*2);}}
          this.previous=timestamp;
          if(this.config.quality==='auto'&&this.intervals.length>=24&&this.intervals.reduce((a,b)=>a+b,0)/this.intervals.length>28){this.adaptiveFlat=true;this.stop();this.draw();this.notify('Auto switched to flat 2D for the measured frame cadence.');return;}
          this.draw();if(this.intervals.length%10===0)this.notify('Motion preview.');if(this.running)this.pending=this.raf(tick);
        }catch(error){this.stop();this.error=error.message;this.notify('Preview failed. Change a control or reset to retry.');}
      };
      try{this.pending=this.raf(tick);}catch(error){this.running=false;throw error;}this.notify('Motion preview.');return true;
    }
    stop(){const active=this.running;this.running=false;if(this.pending!==null)this.cancel(this.pending);this.pending=null;return active;}
    dispose(){if(this.disposed)return;this.stop();this.disposed=true;this.clearImages();this.revision++;this.canvas.width=this.canvas.height=0;}
  }
  function mountSplitDepthStudio(doc){
    const host=doc?.querySelector('[data-depth-studio]');if(!host)return()=>{};if(mounted.has(host))return mounted.get(host);
    const win=doc.defaultView,get=key=>host.querySelector(`[data-depth-${key}]`),canvas=get('canvas'),status=get('status'),listeners=[],timers=new Set(),urls=new Set(),versions={background:0,foreground:0};let disposed=false,resume=false,exportToken=0;
    const motion=win.matchMedia('(prefers-reduced-motion: reduce)');let renderer;
    function notice(message,error=false){status.textContent=message;status.setAttribute('role',error?'alert':'status');}
    function update(stats){get('play').textContent=stats.running?'Pause preview':'Animate preview';get('play').setAttribute('aria-pressed',String(stats.running));get('play').disabled=renderer?.reducedMotion||stats.flat;get('metrics').textContent=`${stats.flat?'Flat 2D':'Split depth'} · draw ${stats.drawMs.toFixed(2)} ms${stats.callbackFps===null?'':` · observed ${stats.callbackFps.toFixed(1)} callbacks/s`}`;if(stats.message)notice(stats.message,Boolean(stats.error));}
    try{renderer=new SplitDepthRenderer(canvas,{requestFrame:win.requestAnimationFrame.bind(win),cancelFrame:win.cancelAnimationFrame.bind(win),now:()=>win.performance.now(),reducedMotion:motion.matches,lowPower:Boolean(win.navigator.connection?.saveData||win.navigator.hardwareConcurrency<=2),onChange:update});}
    catch(error){notice(error.message,true);for(const el of host.querySelectorAll('button,input,select'))el.disabled=true;return()=>{};}
    function on(target,type,fn){target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));}
    const settings=()=>renderer.configure({axis:get('axis').value,count:Number(get('bars').value),thickness:Number(get('thickness').value),quality:get('quality').value});
    for(const control of['axis','bars','thickness','quality'])on(get(control),'input',settings);
    const point=event=>{if(event.pointerType==='touch'&&event.type==='pointermove'&&!event.buttons)return;const rect=canvas.getBoundingClientRect();if(rect.width&&rect.height)renderer.configure({pointer:{x:(event.clientX-rect.left)/rect.width*2-1,y:(event.clientY-rect.top)/rect.height*2-1}});};
    on(canvas,'pointerdown',point);on(canvas,'pointermove',point);on(canvas,'keydown',event=>{const delta={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[event.key];if(!delta&&event.key!=='Home')return;event.preventDefault();const old=renderer.config.pointer;renderer.configure({pointer:event.key==='Home'?{x:0,y:0}:{x:clamp(old.x+delta[0],-1,1),y:clamp(old.y+delta[1],-1,1)}});});
    on(get('play'),'click',()=>{if(renderer.running){renderer.stop();update(renderer.getStats());notice('Preview paused.');}else renderer.start();});
    for(const kind of['background','foreground'])on(get(kind),'change',async()=>{
      const input=get(kind),file=input.files?.[0],version=++versions[kind];if(!file)return;let image;
      try{validatePngHeader(new Uint8Array(await file.slice(0,32).arrayBuffer()),file.size);image=await win.createImageBitmap(file);if(disposed||version!==versions[kind]){image.close();return;}renderer.setLayerImage(kind,image);image=null;notice(`${kind==='background'?'Background':'Foreground'} PNG loaded locally.`);}
      catch(error){image?.close?.();if(!disposed&&version===versions[kind])notice(`Image not loaded: ${error.message} The previous image is retained.`,true);}
      finally{if(!disposed&&version===versions[kind])input.value='';}
    });
    on(get('reset'),'click',()=>{renderer.stop();for(const kind of['background','foreground']){versions[kind]++;get(kind).value='';}renderer.clearImages();get('axis').value='vertical';get('bars').value='2';get('thickness').value='22';get('quality').value='auto';renderer.phase=Math.PI/2;renderer.configure({axis:'vertical',count:2,thickness:22,quality:'auto',pointer:{x:0,y:0}});notice('Demo layers restored.');});
    on(get('download'),'click',()=>{
      renderer.stop();update(renderer.getStats());const revision=renderer.revision,token=++exportToken;get('download').disabled=true;
      const finish=()=>{if(!disposed&&token===exportToken)get('download').disabled=false;};
      try{canvas.toBlob(blob=>{if(disposed||token!==exportToken){finish();return;}if(revision!==renderer.revision){notice('The preview changed; download the current frame again.');finish();return;}let url,anchor;
        try{if(!blob)throw new Error('PNG encoding returned no image.');url=win.URL.createObjectURL(blob);urls.add(url);anchor=doc.createElement('a');anchor.href=url;anchor.download='arcadeverse-split-depth.png';doc.body.append(anchor);anchor.click();notice('PNG download requested.');const allocated=url;const timer=win.setTimeout(()=>{urls.delete(allocated);win.URL.revokeObjectURL(allocated);timers.delete(timer);},1000);timers.add(timer);url=null;}
        catch(error){notice(`PNG export failed: ${error.message} You can retry.`,true);}finally{anchor?.remove();if(url){urls.delete(url);win.URL.revokeObjectURL(url);}finish();}
      },'image/png');}catch(error){notice(`PNG export failed: ${error.message} You can retry.`,true);finish();}
    });
    on(motion,'change',()=>{renderer.reducedMotion=motion.matches;if(motion.matches)renderer.stop();update(renderer.getStats());notice(motion.matches?'Motion is paused for reduced motion.':'Motion can be started with Animate preview.');});
    on(doc,'visibilitychange',()=>{if(doc.hidden){renderer.stop();update(renderer.getStats());}});
    function dispose(){if(disposed)return;disposed=true;mounted.delete(host);exportToken++;for(const kind of['background','foreground'])versions[kind]++;renderer.dispose();for(const remove of listeners)remove();for(const timer of timers)win.clearTimeout(timer);timers.clear();for(const url of urls)win.URL.revokeObjectURL(url);urls.clear();}
    on(win,'pagehide',event=>{if(!event.persisted)dispose();else{resume=renderer.running;renderer.stop();}});on(win,'pageshow',event=>{if(event.persisted&&resume)renderer.start();});mounted.set(host,dispose);settings();update(renderer.getStats());notice(motion.matches?'Static preview; reduced motion is enabled.':'Choose demo motion or load your own local PNG layers.');return dispose;
  }
  return{getDepthLayout,renderSplitDepthFrame,validatePngHeader,SplitDepthRenderer,mountSplitDepthStudio};
});
