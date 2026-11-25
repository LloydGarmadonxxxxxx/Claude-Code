import * as THREE from 'three';
{
const $=s=>document.querySelector(s);
const T=THREE;
const isTouch=(matchMedia('(pointer:coarse)').matches)||('ontouchstart' in window);
if(isTouch)document.body.classList.add('touch');
let store={};try{store=JSON.parse(localStorage.getItem('ascii-ronin')||'{}')}catch(e){}
const saveStore=()=>{try{localStorage.setItem('ascii-ronin',JSON.stringify(store))}catch(e){}};
const settings=Object.assign({music:true,sfx:true,ascii:true,fine:isTouch?2:3.2,cam:1,autoTree:true,q:isTouch?1:2},store.settings||{});
if(!(settings.fine>=2.2&&settings.fine<=6)||settings.v!==4){settings.fine=isTouch?2:3.2;settings.cam=1;settings.v=4}
const saveSettings=()=>{store.settings=settings;saveStore()};
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;

/* ================= renderer + ASCII pass ================= */
const cvs=$('#gl'),ov=$('#ov'),octx=ov.getContext('2d');
const renderer=new T.WebGLRenderer({canvas:cvs,antialias:false,powerPreference:'high-performance'});
let DPR=1;
const scene=new T.Scene();scene.background=new T.Color(0x040509);scene.fog=new T.Fog(0x040509,34,70);
const camera=new T.PerspectiveCamera(38,1,.5,220);
const rt=new T.WebGLRenderTarget(4,4,{minFilter:T.LinearFilter,magFilter:T.LinearFilter});
/* Two-layer ASCII: environment in coarse glyphs, characters & effects in fine glyphs.
   Material ids are written into the alpha channel of the scene render target. */
const SETS=[" .-~;=+<>+<*"," .-:=|[]IHN#"," .,:;*o%&#8@"," .:-~=+xX%#@"," .:;szSZN8$@"," .:-=+*#%@@@"," .-~;=+<>+<*","|/-\\        "];
const ID={ground:.1,arch:.25,fol:.4,enemy:.55,hero:.7,fx:.85};
function makeAtlas(){const gw=32,gh=46,c=document.createElement('canvas');c.width=gw*12;c.height=gh*8;const g=c.getContext('2d');
 g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
 SETS.forEach((st,r)=>{g.font=(r===7?'bold 44px':r===3||r===4?'bold 36px':'bold 38px')+' "Courier New",monospace';for(let i=0;i<12;i++)g.fillText(st[i],i*gw+gw/2,r*gh+gh/2+2)});
 const t=new T.CanvasTexture(c);t.minFilter=T.LinearFilter;t.generateMipmaps=false;return t}
const postScene=new T.Scene(),postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
const postMat=new T.ShaderMaterial({
 uniforms:{tScene:{value:rt.texture},tGlyph:{value:makeAtlas()},uF:{value:new T.Vector2(4,6)},uC:{value:new T.Vector2(12,18)},uRes:{value:new T.Vector2(1,1)},uRT:{value:new T.Vector2(1,1)},uMono:{value:0}},
 vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D tScene,tGlyph;uniform vec2 uF,uC,uRes,uRT;uniform float uMono;
 float idAt(vec2 uv){vec2 t=(floor(uv*uRT)+.5)/uRT;return floor((texture2D(tScene,t).a-.1)/.15+.5);}
 float isChar(float id){return step(2.5,id)*step(id,4.5);}
 float lum(vec3 c){return dot(c,vec3(.3,.59,.11));}
 float gly(float set,float lb,vec2 lc){float gi=floor(lb*11.+.5);return texture2D(tGlyph,vec2((gi+clamp(lc.x,.04,.96))/12.,(7.-set+clamp(lc.y,.02,.98))/8.)).r;}
 vec3 tint(vec3 c,float lb){float mx=max(c.r,max(c.g,c.b));vec3 hue=c/max(mx,.0001);return mix(vec3(1.),hue,clamp(mx*3.,0.,1.)*.85)*(.3+lb*.98);}
 void main(){vec2 f=gl_FragCoord.xy;vec2 fc=floor(f/uF);vec2 fuv=(fc+.5)*uF/uRes;
  float id=idAt(fuv);vec3 c=texture2D(tScene,fuv).rgb;float l=lum(c);vec3 o;
  if(isChar(id)>.5||(id>4.5&&id<5.5&&l>.035)){
   float lb=clamp(pow(l*(id>3.5&&id<4.5?1.25:2.1),.75),0.,1.);vec2 lc=fract(f/uF);float g;
   vec2 dx=vec2(uF.x/uRes.x,0.),dy=vec2(0.,uF.y/uRes.y);
   float gx=isChar(idAt(fuv+dx))-isChar(idAt(fuv-dx)),gy=isChar(idAt(fuv+dy))-isChar(idAt(fuv-dy));
   vec2 lg=vec2(lum(texture2D(tScene,fuv+dx).rgb)-lum(texture2D(tScene,fuv-dx).rgb),lum(texture2D(tScene,fuv+dy).rgb)-lum(texture2D(tScene,fuv-dy).rgb));
   float lm=length(lg);
   if(isChar(id)>.5&&abs(gx)+abs(gy)<.5&&lm>.11+l*.35){float e=abs(lg.x)>abs(lg.y)*1.8?0.:abs(lg.y)>abs(lg.x)*1.8?2.:(lg.x*lg.y>0.?3.:1.);
    g=texture2D(tGlyph,vec2((e+clamp(lc.x,.04,.96))/12.,clamp(lc.y,.02,.98)/8.)).r;lb=max(lb,.45);}
   else if(isChar(id)>.5&&abs(gx)+abs(gy)>0.){float e=abs(gx)>abs(gy)*1.8?0.:abs(gy)>abs(gx)*1.8?2.:(gx*gy>0.?3.:1.);
    g=texture2D(tGlyph,vec2((e+clamp(lc.x,.04,.96))/12.,clamp(lc.y,.02,.98)/8.)).r;lb=max(lb,.6);}
   else g=gly(id,lb,lc);
   o=tint(c,lb)*g*1.08+c*.1;
  }else{vec2 cs=uC;vec2 cc=floor(f/cs);vec2 cuv=(cc+.5)*cs/uRes;float cid=idAt(cuv);vec3 c2=texture2D(tScene,cuv).rgb;
   float set=cid<2.5?max(cid,0.):0.;float lb=clamp(pow(lum(c2)*(set<.5?2.6:2.),.7),0.,1.);if(set<.5&&lb>.12)lb=clamp(lb+(fract(sin(dot(cc,vec2(12.9898,78.233)))*43758.5453)-.5)*.3,.12,1.);
   o=tint(c2,lb)*gly(set,lb,fract(f/cs))+c2*.13;}
  o=mix(o,vec3(dot(o,vec3(.33))),uMono);gl_FragColor=vec4(o,1.);}`,
 depthTest:false,depthWrite:false});
postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),postMat));
function fxify(m,keep){m.transparent=true;m.depthWrite=false;m.blending=T.CustomBlending;m.blendEquation=T.AddEquation;m.blendSrc=T.OneFactor;m.blendDst=T.OneFactor;
 m.blendEquationAlpha=T.MaxEquation;m.blendSrcAlpha=T.OneFactor;m.blendDstAlpha=T.OneFactor;
 m.onBeforeCompile=keep?FXK:FXB;return m}
function FXB(sh){sh.fragmentShader=sh.fragmentShader.replace(/}\s*$/,'vec3 fxc=gl_FragColor.rgb*gl_FragColor.a;gl_FragColor=vec4(fxc,dot(fxc,vec3(.3,.59,.11))>.07?.85:0.);\n}')}
function FXK(sh){sh.fragmentShader=sh.fragmentShader.replace(/}\s*$/,'gl_FragColor=vec4(gl_FragColor.rgb*gl_FragColor.a,0.);\n}')}
const idm=(m,id)=>{m.opacity=id;m.transparent=false;return m};

function resize(){
 const w=innerWidth,h=innerHeight;DPR=Math.min(devicePixelRatio||1,settings.q>1?3:2);
 renderer.setPixelRatio(DPR);renderer.setSize(w,h);
 camera.aspect=w/h;camera.fov=w/h<1.2?50:38;camera.updateProjectionMatrix();
 const fw=Math.max(5,Math.round(settings.fine*DPR)),fh=Math.round(fw*1.5),cw=Math.round((isTouch?8.4:11)*DPR);
 postMat.uniforms.uF.value.set(fw,fh);postMat.uniforms.uC.value.set(cw,Math.round(cw*1.5));
 const W=Math.round(w*DPR),H=Math.round(h*DPR);postMat.uniforms.uRes.value.set(W,H);
 const ss=settings.q>1?1.5:1,rw=Math.ceil(W/fw*ss),rh=Math.ceil(H/fh*ss);rt.setSize(rw,rh);postMat.uniforms.uRT.value.set(rw,rh);
 ov.width=W;ov.height=H;ov.style.width=w+'px';ov.style.height=h+'px';
 checkRotate&&checkRotate();
}

/* ================= helpers: merge geometry ================= */
const V3=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const M4=(x,y,z,ry=0,sx=1,sy=1,sz=1,rx=0,rz=0)=>new T.Matrix4().compose(V3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),V3(sx,sy,sz));
function merge(parts){
 const gs=parts.map(p=>{const g=(p.g.index?p.g.toNonIndexed():p.g.clone());g.applyMatrix4(p.m);return g});
 let n=0;gs.forEach(g=>n+=g.attributes.position.count);
 const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
 gs.forEach((g,i)=>{const cnt=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);
  const c=new T.Color(parts[i].c);for(let k=0;k<cnt;k++){col[(o+k)*3]=c.r;col[(o+k)*3+1]=c.g;col[(o+k)*3+2]=c.b}o+=cnt;g.dispose()});
 const G=new T.BufferGeometry();G.setAttribute('position',new T.BufferAttribute(pos,3));G.setAttribute('normal',new T.BufferAttribute(nor,3));G.setAttribute('color',new T.BufferAttribute(col,3));
 G.computeBoundingSphere();return G}
const GB=new T.BoxGeometry(1,1,1),GS=new T.SphereGeometry(1,12,9),GC=(rt,rb,h,s=10)=>new T.CylinderGeometry(rt,rb,h,s),GCo=(r,h,s=12)=>new T.ConeGeometry(r,h,s);
const matV=idm(new T.MeshLambertMaterial({vertexColors:true}),ID.arch),matVF=idm(new T.MeshLambertMaterial({vertexColors:true}),ID.fol);
const matE=idm(new T.MeshLambertMaterial({vertexColors:true}),ID.enemy),matEB=idm(new T.MeshBasicMaterial({vertexColors:true}),ID.enemy);
const matVB=idm(new T.MeshBasicMaterial({vertexColors:true}),ID.arch);

/* ================= world ================= */
const A=46;
let seed=11;const srnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const colliders=[];const CH={x0:-17.5,x1:17.5,z0:-40.5,z1:-25.5};
const hemi=new T.HemisphereLight(0x8a98c0,0x1d1c18,.24);scene.add(hemi);
const moon=new T.DirectionalLight(0xd6dcff,1.15);moon.position.set(-30,20,8);scene.add(moon);
const rimL=new T.DirectionalLight(0x9ab8ff,1.0);rimL.position.set(26,12,-18);scene.add(rimL);
const plight=new T.PointLight(0xffc488,.8,14,1.5);scene.add(plight);
const boltLight=new T.PointLight(0xbfe4ff,0,40,1.2);scene.add(boltLight);
(function buildWorld(){
 // ground texture
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 g.fillStyle='#2a2a2f';g.fillRect(0,0,256,256);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){const s=36+Math.random()*22|0;g.fillStyle=`rgb(${s},${s},${s+5})`;g.fillRect(x*32+(y%2)*16+2,y*32+2,28,28)}
 for(let i=0;i<1600;i++){const s=Math.random()*70|0;g.fillStyle=`rgba(${s},${s},${s},.5)`;g.fillRect(Math.random()*256,Math.random()*256,2,2)}
 const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(26,26);
 const ground=new T.Mesh(new T.PlaneGeometry(200,200),idm(new T.MeshLambertMaterial({map:tex,color:0xb4b4c2}),ID.ground));ground.rotation.x=-Math.PI/2;scene.add(ground);
 const L=[],B=[],F=[];
 // church
 L.push({g:GB,m:M4(0,5,-33,0,34,10,14),c:0x3b3e4c});
 L.push({g:GC(1,1,1,3),m:M4(0,12.3,-33,0,8.9,34.6,4.7,-Math.PI/2,Math.PI/2),c:0x24262f});
 L.push({g:GB,m:M4(-12,11,-33,0,7,22,7),c:0x353845});
 L.push({g:GCo(5.2,10,4),m:M4(-12,27,-33,Math.PI/4),c:0x24262f});
 L.push({g:GB,m:M4(-12,33,-33,0,.3,3,.3),c:0x9a96a0});L.push({g:GB,m:M4(-12,33.6,-33,0,1.6,.3,.3),c:0x9a96a0});
 for(let i=0;i<7;i++){const x=-14+i*4.6;if(i===4){L.push({g:GB,m:M4(x,3,-25.9,0,3.2,6,.3),c:0x5a1c12});B.push({g:GB,m:M4(x,6.3,-25.85,0,1.2,.5,.2),c:0xff8a2a});continue}
  B.push({g:GB,m:M4(x,4.6,-25.9,0,2.2,4,.2),c:0xffa040});B.push({g:GB,m:M4(x,6.9,-25.9,0,1.4,.8,.2),c:0xffb455});
  L.push({g:GB,m:M4(x,4.6,-25.8,0,.18,4,.25),c:0x2b2420});L.push({g:GB,m:M4(x,4.6,-25.8,0,2.2,.18,.25),c:0x2b2420})}
 for(let i=0;i<3;i++)B.push({g:GB,m:M4(17.1,4.6,-37+i*4.5,0,.2,4,2),c:0xffa040});
 B.push({g:GC(2,2,.3,16),m:M4(-12,15,-29.4,0,1,1,1,Math.PI/2),c:0xffc060});
 colliders.push({rect:CH});colliders.push({rect:{x0:-15.5,x1:-8.5,z0:-36.5,z1:-29.5}});
 // fence
 for(let s=0;s<4;s++)for(let t=-A;t<=A;t+=2.6){const x=s<2?t:(s===2?-A:A),z=s<2?(s===0?-A:A):t;L.push({g:GC(.08,.08,1.5,5),m:M4(x,.75,z),c:0x6e7286});L.push({g:GS,m:M4(x,1.55,z,0,.14,.14,.14),c:0x8a8ea0})}
 for(let s=0;s<4;s++)for(const y of[.55,1.15]){const hz=s<2;L.push({g:GB,m:M4(hz?0:(s===2?-A:A),y,hz?(s===0?-A:A):0,0,hz?A*2:.07,.07,hz?.07:A*2),c:0x6e7286})}
 // inner fence in front of church
 for(let x=-16;x<=16;x+=1.6){if(Math.abs(x-4.4)<2.5)continue;L.push({g:GC(.05,.05,1.1,4),m:M4(x,.55,-21),c:0x7a7e90});L.push({g:GS,m:M4(x,1.15,-21,0,.1,.1,.1),c:0x9a9eb0})}
 L.push({g:GB,m:M4(-6.7,.85,-21,0,18.6,.06,.06),c:0x7a7e90});L.push({g:GB,m:M4(10.7,.85,-21,0,10.6,.06,.06),c:0x7a7e90});
 colliders.push({rect:{x0:-16,x1:2,z0:-21.3,z1:-20.7}},{rect:{x0:6.9,x1:16,z0:-21.3,z1:-20.7}});
 const free=(x,z,r)=>{if(Math.hypot(x,z)<10)return false;if(x>CH.x0-3&&x<CH.x1+3&&z<-18)return false;if(Math.abs(x)>A-3||Math.abs(z)>A-3)return false;return !colliders.some(c=>c.r&&Math.hypot(c.x-x,c.z-z)<c.r+r+2)};
 // trees (bushy)
 for(let i=0,k=0;i<14&&k<400;k++){const x=(srnd()*2-1)*A,z=(srnd()*2-1)*A;if(!free(x,z,1.6))continue;i++;
  F.push({g:GC(.25,.35,2.4,6),m:M4(x,1.2,z),c:0x3a2e22});
  for(let j=0;j<5;j++){const a=j*1.3,r=j?1:0;F.push({g:GS,m:M4(x+Math.cos(a)*r*.8,3+(j?0:.8)+srnd()*.5,z+Math.sin(a)*r*.8,0,1.3,1.1,1.3),c:j%2?0x2f6a5e:0x3d7f70})}
  colliders.push({x,z,r:1.2})}
 // dead trees
 for(let i=0,k=0;i<12&&k<400;k++){const x=(srnd()*2-1)*A,z=(srnd()*2-1)*A;if(!free(x,z,.8))continue;i++;
  F.push({g:GC(.12,.28,3.6,5),m:M4(x,1.8,z),c:0x4a3e33});
  for(let j=0;j<4;j++){const a=srnd()*TAU;F.push({g:GB,m:M4(x+Math.cos(a)*.6,2.4+j*.4,z+Math.sin(a)*.6,-a,1.6,.1,.1,0,.5),c:0x4a3e33})}
  colliders.push({x,z,r:.5})}
 // graveyard
 for(let i=0;i<22;i++){const gx=22+(i%6)*2.6,gz=-14+(i/6|0)*3.2+(i%2)*.4;if(!free(gx,gz,.3))continue;
  if(i%3){L.push({g:GB,m:M4(gx,.6,gz,0,.9,1.2,.25),c:0x5d6074});L.push({g:GC(.45,.45,.25,10),m:M4(gx,1.2,gz,0,1,1,1,Math.PI/2),c:0x5d6074})}
  else{L.push({g:GB,m:M4(gx,.8,gz,0,.18,1.6,.18),c:0x6a6d80});L.push({g:GB,m:M4(gx,1.15,gz,0,.8,.18,.18),c:0x6a6d80})}
  colliders.push({x:gx,z:gz,r:.45})}
 for(let i=0;i<18;i++){const gx=-38+(i%6)*2.4,gz=10+(i/6|0)*3;if(!free(gx,gz,.3))continue;L.push({g:GB,m:M4(gx,.55,gz,srnd()*.3,.8,1.1,.25),c:0x575a6c});colliders.push({x:gx,z:gz,r:.45})}
 // lamps
 for(const[x,z]of[[-8,-17],[12,-17],[-20,4],[20,6],[0,22],[-24,-20],[30,-24],[-32,30],[28,32]]){
  L.push({g:GC(.07,.1,3.4,6),m:M4(x,1.7,z),c:0x2a2a30});B.push({g:GS,m:M4(x,3.55,z,0,.32,.36,.32),c:0xffc070});colliders.push({x,z,r:.35})}
 // rocks & bones scatter
 for(let i=0;i<60;i++){const x=(srnd()*2-1)*(A-2),z=(srnd()*2-1)*(A-2);if(z<-20&&Math.abs(x)<19)continue;F.push({g:GS,m:M4(x,.1,z,srnd()*3,.3+srnd()*.4,.15+srnd()*.2,.3+srnd()*.3),c:0x4a4c58})}
 scene.add(new T.Mesh(merge(L),matV));scene.add(new T.Mesh(merge(F),matVF));scene.add(new T.Mesh(merge(B),matVB));
 const glow=new T.Mesh(new T.PlaneGeometry(34,6),fxify(new T.MeshBasicMaterial({color:0xff8a2a,opacity:.13}),true));
 glow.rotation.x=-Math.PI/2;glow.position.set(0,.03,-23);scene.add(glow);
})();
function collide(o,r){
 for(const c of colliders){
  if(c.rect){const R=c.rect;const cx=clamp(o.x,R.x0,R.x1),cz=clamp(o.z,R.z0,R.z1);const dx=o.x-cx,dz=o.z-cz,d2=dx*dx+dz*dz;
   if(d2<r*r){if(d2>1e-6){const d=Math.sqrt(d2);o.x=cx+dx/d*r;o.z=cz+dz/d*r}else{const l=o.x-R.x0,rr=R.x1-o.x,t=o.z-R.z0,b=R.z1-o.z,m=Math.min(l,rr,t,b);if(m===l)o.x=R.x0-r;else if(m===rr)o.x=R.x1+r;else if(m===t)o.z=R.z0-r;else o.z=R.z1+r}}}
  else{const dx=o.x-c.x,dz=o.z-c.z,rr=r+c.r,d2=dx*dx+dz*dz;if(d2<rr*rr&&d2>1e-6){const d=Math.sqrt(d2);o.x=c.x+dx/d*rr;o.z=c.z+dz/d*rr}}}
 o.x=clamp(o.x,-A+r+.3,A-r-.3);o.z=clamp(o.z,-A+r+.3,A-r-.3);
}
const inBlock=(x,z,m=.5)=>{if(Math.abs(x)>A-1||Math.abs(z)>A-1)return true;for(const c of colliders){if(c.rect){const R=c.rect;if(x>R.x0-m&&x<R.x1+m&&z>R.z0-m&&z<R.z1+m)return true}else if(Math.hypot(x-c.x,z-c.z)<c.r+m)return true}return false};

/* ================= audio ================= */
const AU={ctx:null};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function initAudio(){
 if(AU.ctx){if(AU.ctx.state!=='running')AU.ctx.resume();return}
 let C;try{C=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
 AU.ctx=C;AU.master=C.createGain();AU.master.gain.value=.85;
 const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;AU.master.connect(comp);comp.connect(C.destination);
 AU.music=C.createGain();AU.music.gain.value=settings.music?.5:0;AU.music.connect(AU.master);
 AU.sfx=C.createGain();AU.sfx.gain.value=settings.sfx?.55:0;AU.sfx.connect(AU.master);
 const dl=C.createDelay(1);dl.delayTime.value=.42;const fb=C.createGain();fb.gain.value=.38;const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;
 dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(AU.music);AU.echo=dl;
 const nb=C.createBuffer(1,C.sampleRate,C.sampleRate),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AU.nb=nb;
 MUS.next=C.currentTime+.15;setInterval(schedule,25);
}
function tone(t,f,dur,type,vol,dest,o={}){const C=AU.ctx,os=C.createOscillator();os.type=type;os.frequency.setValueAtTime(f,t);if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+dur);if(o.det)os.detune.value=o.det;
 const g=C.createGain(),a=o.a||.005;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 let n=os;if(o.lp){const fl=C.createBiquadFilter();fl.type='lowpass';fl.frequency.value=o.lp;fl.Q.value=o.q||.7;os.connect(fl);n=fl}n.connect(g);g.connect(dest);if(o.send)g.connect(AU.echo);os.start(t);os.stop(t+dur+.05)}
function nz(t,dur,vol,dest,type,freq,q=1,to){const C=AU.ctx,s=C.createBufferSource();s.buffer=AU.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(freq,t);if(to)f.frequency.exponentialRampToValueAtTime(to,t+dur);f.Q.value=q;
 const g=C.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(dest);s.start(t,Math.random()*.4);s.stop(t+dur+.02)}
function kick(t,v,dest){const C=AU.ctx,o=C.createOscillator();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(38,t+.16);const g=C.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(g);g.connect(dest);o.start(t);o.stop(t+.36)}
/* music: D minor gothic, 3 intensities */
const MUS={step:0,next:0,int:0};
const CHORDS=[[62,65,69],[58,62,65],[55,58,62],[57,61,64],[62,65,69],[58,62,65],[60,64,67],[57,61,64]];
const BASS=[38,34,31,33,38,34,36,33];
const LEAD=[74,0,72,0,70,0,69,0,70,0,72,0,69,0,0,0,65,0,67,0,69,0,70,0,69,0,67,0,65,0,64,0,
 74,0,77,0,76,0,74,0,72,0,70,0,72,0,0,0,69,0,70,0,72,0,74,0,73,0,0,0,69,0,0,0];
function schedule(){const C=AU.ctx;if(!C)return;if(MUS.next<C.currentTime-.3)MUS.next=C.currentTime+.05;
 while(MUS.next<C.currentTime+.16){playStep(MUS.step,MUS.next);const bpm=[78,104,134][MUS.int];MUS.next+=60/bpm/4;MUS.step++}}
function playStep(s,t){if(!settings.music)return;const M=AU.music,I=MUS.int,bar=(s>>4),ci=(bar>>1)%8,ch=CHORDS[ci],st=s%16,beatLen=60/[78,104,134][I];
 if(s%32===0){ch.forEach((n,i)=>{tone(t,mtof(n-12),beatLen*8.5,'sawtooth',.045,M,{a:1.2,lp:I===2?1400:800,det:i*7-7});tone(t,mtof(n-12),beatLen*8.5,'sawtooth',.03,M,{a:1.4,lp:700,det:9})});
  tone(t,mtof(ch[0]-24),beatLen*8,'triangle',.12,M,{a:.6})}
 if(I===0){if(st%4===0){const n=ch[(st/4+bar)%3]+12;tone(t,mtof(n),1.6,'triangle',.06,M,{send:1})}
  if(s%64===0)tone(t,mtof(86),3,'sine',.04,M,{send:1});return}
 // arpeggio
 if(st%2===0){const pat=[0,1,2,1,2,0,1,2];const n=ch[pat[(st/2)%8]]+12+(st>=8&&I===2?12:0);tone(t,mtof(n),.28,'square',.028,M,{lp:2600,send:1})}
 // bass
 if(I===2?st%2===0:st%4===0){tone(t,mtof(BASS[ci]+(I===2&&st%4===2?12:0)),.26,'sawtooth',.1,M,{lp:480})}
 // drums
 if(st===0||st===8||(I===2&&(st===4||st===12||st===10)))kick(t,.55,M);
 if(st===4||st===12){nz(t,.18,.22,M,'bandpass',1800,.8);tone(t,200,.08,'triangle',.08,M)}
 if(st%2===0||I===2)nz(t,.045,st%4===2?.07:.035,M,'highpass',7000);
 // lead
 const phrase=(bar>>2)%2;if((I===2)||(phrase===1&&I===1)){const n=LEAD[(s%64)];if(n)tone(t,mtof(n),beatLen*.9,I===2?'sawtooth':'triangle',I===2?.035:.05,M,{lp:2400,a:.02,send:1})}
 if(I===2&&s%128===0)for(let k=0;k<3;k++)tone(t+k*.02,mtof(ch[k]+24),2.4,'sine',.03,M,{a:.4,send:1});
}
const SFXGAP={hit:.035,pick:.05,thunder:.06,burn:.2,eshot:.12,ehurt:.05};const sfxT={};
function sfx(n,v=1){const C=AU.ctx;if(!C||!settings.sfx)return;const t=C.currentTime;if(sfxT[n]&&t-sfxT[n]<(SFXGAP[n]||.02))return;sfxT[n]=t;const D=AU.sfx;
 switch(n){
 case'slash':nz(t,.13,.32*v,D,'highpass',3000,.7,900);tone(t,1400,.06,'sawtooth',.03,D,{to:500});break;
 case'slash3':nz(t,.25,.45,D,'bandpass',2400,.6,500);tone(t,600,.18,'sawtooth',.05,D,{to:120});break;
 case'hit':nz(t,.08,.3,D,'lowpass',1600);tone(t,180,.09,'square',.06,D,{to:60});break;
 case'crit':tone(t,1800,.12,'square',.05,D,{to:900});nz(t,.1,.3,D,'highpass',4000);break;
 case'dodge':nz(t,.2,.22,D,'bandpass',900,1.2,3000);break;
 case'hurt':tone(t,140,.25,'sawtooth',.18,D,{to:50,lp:900});nz(t,.15,.25,D,'lowpass',800);break;
 case'pick':tone(t,1200+Math.random()*400,.07,'sine',.05,D,{to:2200});break;
 case'level':[0,4,7,12,16].forEach((k,i)=>tone(t+i*.06,mtof(74+k),.5,'triangle',.09,D,{send:1}));break;
 case'learn':[0,7,12].forEach((k,i)=>tone(t+i*.05,mtof(69+k),.4,'square',.05,D,{lp:3000}));break;
 case'wave':nz(t,.3,.25,D,'bandpass',1500,.9,5000);tone(t,500,.25,'sine',.06,D,{to:1500});break;
 case'thunder':nz(t,.35,.5,D,'lowpass',3000,.5,300);nz(t,.06,.4,D,'highpass',5000);break;
 case'frost':nz(t,.5,.35,D,'highpass',3000,.5,9000);[0,5,9].forEach((k,i)=>tone(t+i*.03,mtof(88+k),.6,'sine',.05,D,{send:1}));break;
 case'fire':nz(t,.5,.35,D,'lowpass',900,.7,2500);break;
 case'boom':kick(t,.9,D);nz(t,.7,.5,D,'lowpass',1200,.6,80);break;
 case'shield':[0,7,12,19].forEach((k,i)=>tone(t+i*.03,mtof(62+k),1,'sine',.07,D,{send:1}));break;
 case'clone':tone(t,300,.4,'sawtooth',.05,D,{to:900,lp:1500});nz(t,.3,.2,D,'bandpass',600,2);break;
 case'poison':nz(t,.6,.25,D,'bandpass',500,3,200);break;
 case'void':tone(t,90,1.2,'sawtooth',.12,D,{to:30,lp:400});nz(t,1,.2,D,'lowpass',300);break;
 case'time':tone(t,880,1.4,'sine',.1,D,{to:110,send:1});nz(t,.5,.2,D,'highpass',6000,.5,600);break;
 case'issen':nz(t,.5,.6,D,'highpass',6000,.5,1200);tone(t,2400,.5,'sine',.08,D,{to:300});break;
 case'eshot':tone(t,500,.15,'triangle',.04,D,{to:200});break;
 case'ehurt':nz(t,.06,.12,D,'lowpass',900);break;
 case'boss':tone(t,55,2,'sawtooth',.2,D,{lp:300,a:.2});tone(t,58,2,'sawtooth',.15,D,{lp:300,a:.2});nz(t,1.5,.25,D,'lowpass',400);break;
 case'heal':[0,4,7].forEach((k,i)=>tone(t+i*.05,mtof(76+k),.4,'sine',.06,D));break;
 case'burn':nz(t,.15,.1,D,'bandpass',1200,1);break;
 case'tick':tone(t,900,.03,'square',.03,D);break;
 }}

/* ================= pools, particles, orbs ================= */
function pool(make){const free=[];return{get(){const m=free.pop()||make();m.visible=true;scene.add(m);return m},put(m){m.visible=false;scene.remove(m);free.push(m)}}}
const addMat=(c,o=1)=>fxify(new T.MeshBasicMaterial({color:c,opacity:o,side:T.DoubleSide}));
const ringG=new T.RingGeometry(.86,1,48);ringG.rotateX(-Math.PI/2);
const discG=new T.CircleGeometry(1,32);discG.rotateX(-Math.PI/2);
const rectG=new T.PlaneGeometry(1,1);rectG.rotateX(-Math.PI/2);rectG.translate(0,0,.5);
const ringP=pool(()=>new T.Mesh(ringG,addMat(0xffffff)));
const discP=pool(()=>new T.Mesh(discG,addMat(0xff6020,.4)));
const rectP=pool(()=>new T.Mesh(rectG,addMat(0xff2020,.3)));
const sphP=pool(()=>new T.Mesh(GS,addMat(0xffffff,.5)));
const slashG=new T.RingGeometry(1.1,3,24,1,-Math.PI/2-1.25,2.5);slashG.rotateX(-Math.PI/2);
const slash3G=new T.RingGeometry(1.2,3.5,40,1,0,TAU);slash3G.rotateX(-Math.PI/2);
const slashP=pool(()=>new T.Mesh(slashG,addMat(0xfff6e0,.9)));
const waveG=new T.RingGeometry(1.0,1.7,18,1,-Math.PI/2-1,2);waveG.rotateX(-Math.PI/2);
const waveP=pool(()=>new T.Mesh(waveG,addMat(0xc8f4ff,.95)));
const bladeG=new T.BoxGeometry(.12,.12,1.6);const bladeMat=idm(new T.MeshBasicMaterial({color:0xdff6ff}),ID.fx);
const bladeP=pool(()=>new T.Mesh(bladeG,bladeMat));
const orbG=new T.SphereGeometry(.32,10,8);
const eShotP=pool(()=>new T.Mesh(orbG,idm(new T.MeshBasicMaterial({color:0xc070ff}),ID.fx)));
const rockP=pool(()=>new T.Mesh(new T.DodecahedronGeometry(1.2),idm(new T.MeshBasicMaterial({color:0xff7a2a}),ID.fx)));
// lightning ribbons
const BOLTN=12;
function makeBolt(){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(BOLTN*2*3),3));const idx=[];for(let i=0;i<BOLTN-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}g.setIndex(idx);
 const m=new T.Mesh(g,addMat(0xe6f6ff,1));m.frustumCulled=false;return m}
const boltP=pool(makeBolt);
const _side=V3(),_dir=V3(),_cd=V3();
function setRibbon(m,pts,w){const p=m.geometry.attributes.position.array;camera.getWorldDirection(_cd);
 for(let i=0;i<BOLTN;i++){const a=pts[Math.min(i,pts.length-1)],b=pts[Math.min(i+1,pts.length-1)],pa=pts[Math.max(i-1,0)];
  _dir.set(b.x-pa.x,b.y-pa.y,b.z-pa.z).normalize();_side.crossVectors(_dir,_cd).normalize().multiplyScalar(w*(i===0||i===BOLTN-1?.4:1));
  p[i*6]=a.x+_side.x;p[i*6+1]=a.y+_side.y;p[i*6+2]=a.z+_side.z;p[i*6+3]=a.x-_side.x;p[i*6+4]=a.y-_side.y;p[i*6+5]=a.z-_side.z}
 m.geometry.attributes.position.needsUpdate=true}
function jag(ax,ay,az,bx,by,bz,amp){const pts=[];for(let i=0;i<BOLTN;i++){const t=i/(BOLTN-1),j=(i===0||i===BOLTN-1)?0:amp;pts.push({x:lerp(ax,bx,t)+rand(-j,j),y:lerp(ay,by,t)+rand(-j,j)*.5,z:lerp(az,bz,t)+rand(-j,j)})}return pts}
// particles (instanced)
const PMAX=700;const parts=[];
const pMesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),fxify(new T.MeshBasicMaterial({})),PMAX);
pMesh.frustumCulled=false;const _m=new T.Matrix4(),_c=new T.Color(),_q=new T.Quaternion(),_s=V3(),_p=V3();
for(let i=0;i<PMAX;i++){pMesh.setColorAt(i,_c.set(0));_m.makeScale(0,0,0);pMesh.setMatrixAt(i,_m)}scene.add(pMesh);
function burst(x,y,z,n,col,spd=6,size=.18,life=.6,grav=-6,up=2){if(parts.length>PMAX-n)n=Math.max(0,PMAX-parts.length);
 for(let i=0;i<n;i++){const a=Math.random()*TAU,s=spd*(.3+Math.random()*.7);parts.push({x,y,z,vx:Math.cos(a)*s,vy:up*(.4+Math.random()),vz:Math.sin(a)*s,l:life*(.5+Math.random()*.5),m:life,s:size*(.6+Math.random()*.6),c:col,g:grav})}}
function puff(x,y,z,col,size=.2,life=.5,vy=1.5,spread=.3){if(parts.length>=PMAX)return;parts.push({x:x+rand(-spread,spread),y,z:z+rand(-spread,spread),vx:rand(-.3,.3),vy,vz:rand(-.3,.3),l:life,m:life,s:size,c:col,g:0})}
function updParts(dt){let i=0;for(let k=0;k<parts.length;k++){const p=parts[k];p.l-=dt;if(p.l<=0)continue;p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.05){p.y=.05;p.vy*=-.3;p.vx*=.7;p.vz*=.7}
  const f=p.l/p.m,s=p.s*(.3+.7*f);_m.compose(_p.set(p.x,p.y,p.z),_q,_s.set(s,s,s));pMesh.setMatrixAt(i,_m);pMesh.setColorAt(i,_c.set(p.c).multiplyScalar(.4+.6*f));parts[i++]=p}
 for(let k=i;k<parts.length&&k<PMAX;k++){_m.makeScale(0,0,0);pMesh.setMatrixAt(k,_m)}
 const prev=parts.length;parts.length=i;for(let k=i;k<Math.min(prev,PMAX);k++){_m.makeScale(0,0,0);pMesh.setMatrixAt(k,_m)}
 pMesh.instanceMatrix.needsUpdate=true;if(pMesh.instanceColor)pMesh.instanceColor.needsUpdate=true}
// xp orbs (instanced)
const OMAX=320;const orbs=[];
const oMesh=new T.InstancedMesh(new T.OctahedronGeometry(.24),idm(new T.MeshBasicMaterial({color:0xffffff}),ID.fx),OMAX);oMesh.frustumCulled=false;
for(let i=0;i<OMAX;i++){oMesh.setColorAt(i,_c.set(0x7fe8d0));_m.makeScale(0,0,0);oMesh.setMatrixAt(i,_m)}scene.add(oMesh);
const ORBCOL=[0x7fe8d0,0x6fb8ff,0xd28cff,0xffd24a];

/* ================= game state ================= */
let state='title',gt=0,hs=0,tScale=1,slowT=0,tstop=0,shakeA=0,boss=null,bossN=0,nextBoss=150,nextElite=40,nextHorde=75,spawnAcc=0,selNode=null,lvPending=0,rtime=0;
const enemies=[],eshots=[],items=[],clones=[],timers=[],fxs=[],nums=[];
const P={x:0,z:0};
const later=(t,f)=>timers.push({t,f});
function addFx(o){fxs.push(o);return o}
function updFx(dt){for(let i=fxs.length-1;i>=0;i--){const f=fxs[i];if(f.u(dt)===false){f.e&&f.e();fxs.splice(i,1)}}}

/* ================= ronin model (kasa hat, striped hakama, long katana) ================= */
function canvasTex(w,h,draw,rx=1,ry=1){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);return t}
const stripeTex=canvasTex(32,64,(g,w,h)=>{for(let y=0;y<h;y++){const band=(y>>3)&1,v=band?236:96;g.fillStyle=`rgb(${v},${v-3},${v-10})`;g.fillRect(0,y,w,1)}
 for(let x=0;x<w;x+=8){g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,0,1.5,h);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(x+2,0,1,h)}
 for(let i=0;i<120;i++){g.fillStyle=`rgba(0,0,0,${Math.random()*.25})`;g.fillRect(Math.random()*w,Math.random()*h,1,2)}},6,4);
const strawTex=canvasTex(64,32,(g,w,h)=>{for(let x=0;x<w;x++){const v=150+((x*7)%5)*18+(x%4===0?-60:0);g.fillStyle=`rgb(${v},${v*.86|0},${v*.6|0})`;g.fillRect(x,0,1,h)};for(let y=0;y<h;y+=6){g.fillStyle='rgba(0,0,0,.35)';g.fillRect(0,y,w,1)}},20,1);
const clothTex=canvasTex(64,32,(g,w,h)=>{g.fillStyle='#ece8de';g.fillRect(0,0,w,h);for(let x=0;x<w;x++){const f=.5+.5*Math.sin(x*.55)*Math.sin(x*.13+1);g.fillStyle=`rgba(40,36,30,${(f*.5).toFixed(2)})`;g.fillRect(x,0,1,h)}for(let i=0;i<90;i++){g.fillStyle=`rgba(80,74,66,${Math.random()*.35})`;g.fillRect(Math.random()*w,Math.random()*h,1,3+Math.random()*4)}},4,2);
const V2=(x,y)=>new T.Vector2(x,y);
const RG={
 hakama:new T.LatheGeometry([V2(.58,0),V2(.6,.07),V2(.52,.42),V2(.41,.82),V2(.32,1.1),V2(.29,1.24)],32),
 torso:new T.LatheGeometry([V2(.29,1.2),V2(.31,1.36),V2(.37,1.56),V2(.39,1.72),V2(.24,1.9),V2(.08,1.97)],28),
 coat:new T.LatheGeometry([V2(.41,1.84),V2(.44,1.5),V2(.49,1.02),V2(.56,.5),V2(.6,.36)],22,Math.PI*.58,Math.PI*.84),
 obi:GC(.315,.315,.15,28),knot:new T.BoxGeometry(.3,.18,.12),collar:new T.BoxGeometry(.06,.4,.035),
 neck:GC(.075,.085,.14,10),head:new T.SphereGeometry(.185,18,14),hair:new T.SphereGeometry(.09,8,6),
 hat:new T.ConeGeometry(.82,.32,64,1,true),hatIn:new T.ConeGeometry(.79,.27,64,1,true),rim:new T.TorusGeometry(.815,.04,8,80),knob:new T.SphereGeometry(.055,8,6),
 shoulder:new T.SphereGeometry(.42,22,10,0,Math.PI*2,0,Math.PI*.5),sleeve:GC(.11,.24,.7,16,true),cuff:GC(.24,.24,.04,16,true),hand:new T.SphereGeometry(.075,10,8),
 foot:new T.BoxGeometry(.13,.07,.27),tsuka:new T.BoxGeometry(.055,.055,.34),tsuba:GC(.1,.1,.03,16),
 blade:new T.BoxGeometry(.022,.065,1.55),tip:new T.ConeGeometry(.04,.22,4),saya:GC(.04,.036,1.3,8),sayaRing:GC(.05,.05,.05,8),scarf:new T.BoxGeometry(.18,.035,.25)};
RG.tip.rotateX(Math.PI/2);RG.tip.scale(.55,1.5,1);
function buildRonin(m){const g=new T.Group(),body=new T.Group();g.add(body);
 const add=(par,geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);par.add(o);return o};
 const hak=add(body,RG.hakama,m.lo,0,0,0);
 add(body,RG.foot,m.dark,.15,.035,.1);add(body,RG.foot,m.dark,-.15,.035,.1);
 add(body,RG.torso,m.up,0,0,0);const coat=add(body,RG.coat,m.coat,0,0,0);add(body,RG.obi,m.obi,0,1.24,0);add(body,RG.knot,m.obi,0,1.22,-.33);
 add(body,RG.collar,m.dark,.075,1.72,.31,-.3,0,.42);add(body,RG.collar,m.dark,-.075,1.72,.31,-.3,0,-.42);
 add(body,RG.shoulder,m.up,0,1.73,0).scale.set(1,.42,.74);
 add(body,RG.neck,m.skin,0,1.99,0);add(body,RG.head,m.skin,0,2.13,.02);add(body,RG.hair,m.dark,0,2.19,-.15);
 const hat=new T.Group();hat.position.set(0,2.25,0);body.add(hat);
 add(hat,RG.hat,m.hat,0,.13,0);add(hat,RG.hatIn,m.dark,0,.1,0);add(hat,RG.rim,m.rim,0,-.03,0,Math.PI/2);add(hat,RG.knob,m.hat,0,.3,0);
 const la=new T.Group();la.position.set(-.46,1.76,0);body.add(la);add(la,RG.sleeve,m.up,0,-.35,0);add(la,RG.cuff,m.dark,0,-.7,0);add(la,RG.hand,m.skin,0,-.74,.03);
 const piv=new T.Group();piv.rotation.order='YXZ';piv.position.set(.46,1.76,0);body.add(piv);
 add(piv,RG.sleeve,m.up,0,0,.35,-Math.PI/2);add(piv,RG.cuff,m.dark,0,0,.7,-Math.PI/2);add(piv,RG.hand,m.skin,0,0,.74);
 const sw=new T.Group();sw.position.set(0,0,.74);piv.add(sw);
 add(sw,RG.tsuka,m.dark,0,0,-.02);add(sw,RG.tsuba,m.gold,0,0,.16,Math.PI/2);add(sw,RG.blade,m.blade,0,.01,.95);add(sw,RG.tip,m.blade,0,.015,1.83);
 const tip=new T.Object3D();tip.position.set(0,0,1.95);sw.add(tip);const mid=new T.Object3D();mid.position.set(0,0,1.5);sw.add(mid);
 add(body,RG.saya,m.dark,-.33,1.02,-.27,1.25,0,.12);add(body,RG.sayaRing,m.gold,-.33,1.25,-.05,1.25,0,.12);
 const scarf=[];let par=new T.Group();par.position.set(.05,1.95,-.17);body.add(par);
 for(let i=0;i<6;i++){const sg=new T.Group();sg.position.z=i?-.21:0;par.add(sg);add(sg,RG.scarf,m.scarf,0,0,-.11);scarf.push(sg);par=sg}
 return{g,body,piv,sw,la,hat,hak,coat,scarf,tip,mid}}
const lm=(c,id,o={})=>idm(new T.MeshLambertMaterial(Object.assign({color:c,side:T.DoubleSide},o)),id);
const pMats={lo:lm(0xc4c0b6,ID.hero,{map:stripeTex}),up:lm(0xaaa69c,ID.hero,{map:clothTex}),dark:lm(0x26262c,ID.hero),obi:lm(0x6a1c1c,ID.hero),skin:lm(0xe2c7a0,ID.hero),
 hat:lm(0x7a6a4e,ID.hero,{map:strawTex}),rim:idm(new T.MeshBasicMaterial({color:0xfff2cc}),ID.hero),gold:lm(0xc9a24a,ID.hero,{emissive:0x302008}),
 scarf:lm(0xd23b2b,ID.hero,{emissive:0x3a0c08}),coat:lm(0x6c6a64,ID.hero,{map:clothTex}),blade:idm(new T.MeshBasicMaterial({color:0xf4faff}),ID.hero)};
const cMat=lm(0x5a34a8,ID.hero,{emissive:0x2a1060}),cBlade=idm(new T.MeshBasicMaterial({color:0xe0c8ff}),ID.hero);
const cMats={coat:cMat,lo:cMat,up:cMat,dark:cMat,obi:cMat,skin:cMat,hat:cMat,rim:cBlade,gold:cMat,scarf:cMat,blade:cBlade};
const hero=buildRonin(pMats);hero.g.scale.setScalar(1.15);scene.add(hero.g);
const shadowMat=new T.MeshBasicMaterial({color:0,opacity:.55});Object.assign(shadowMat,{transparent:true,depthWrite:false,blending:T.CustomBlending,blendSrc:T.ZeroFactor,blendDst:T.OneMinusSrcAlphaFactor,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor});
const shadowM=new T.Mesh(discG,shadowMat);shadowM.scale.set(.9,1,.9);scene.add(shadowM);
/* sword trail ribbon */
const TRN=11,trail=[];
const trG=new T.BufferGeometry();trG.setAttribute('position',new T.BufferAttribute(new Float32Array(TRN*6),3));trG.setAttribute('color',new T.BufferAttribute(new Float32Array(TRN*6),3));
{const idx=[];for(let i=0;i<TRN-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}trG.setIndex(idx)}
const trM=new T.Mesh(trG,fxify(new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})));trM.frustumCulled=false;scene.add(trM);
const _a=V3(),_b=V3();
function updTrail(active){if(active){hero.g.updateMatrixWorld(true);hero.mid.getWorldPosition(_a);hero.tip.getWorldPosition(_b);trail.push([_a.x,_a.y,_a.z,_b.x,_b.y,_b.z]);if(trail.length>TRN)trail.shift()}
 else if(trail.length)trail.splice(0,Math.min(trail.length,2));
 const p=trG.attributes.position.array,c=trG.attributes.color.array,n=trail.length;
 for(let i=0;i<n;i++){const t=trail[i],f=(i+1)/n,k=f*f;p.set(t,i*6);c[i*6]=c[i*6+1]=c[i*6+2]=0;c[i*6+3]=.7*k;c[i*6+4]=.78*k;c[i*6+5]=.9*k}
 trG.setDrawRange(0,Math.max(0,n-1)*6);trG.attributes.position.needsUpdate=true;trG.attributes.color.needsUpdate=true}
function poseRig(h,mode,p,t,mv){
 h.sw.rotation.set(0,0,0);h.body.rotation.y=0;
 if(mode==='a1'||mode==='a2'){const e=1-Math.pow(1-p,3),a=mode==='a1'?lerp(2,-2,e):lerp(-2,2,e);h.piv.rotation.set(.12,a,0);h.la.rotation.set(-.7,0,.25)}
 else if(mode==='a3'){h.piv.rotation.set(.1,1.57,0);h.body.rotation.y=-(1-Math.pow(1-p,2))*TAU;h.la.rotation.set(-.3,0,.9)}
 else if(mode==='spin'){h.piv.rotation.set(.1,1.57,0);h.la.rotation.set(0,0,1.1)}
 else if(mode==='dash'){h.piv.rotation.set(1.35,.2,0);h.sw.rotation.set(1.3,0,0);h.la.rotation.set(.6,0,.3)}
 else{h.piv.rotation.set(1.18+(mv?.2:0)+Math.sin(t*1.6)*.03,.32,0);h.sw.rotation.set(1.42,0,0);h.la.rotation.set(mv?Math.sin(t*12)*.5:Math.sin(t*1.6)*.04,0,.3)}
 h.scarf.forEach((s,i)=>{s.rotation.x=-.18-(mv?.32:0)+Math.sin(t*7-i*.9)*.16;s.rotation.y=Math.sin(t*4.3-i*.7)*.28});
 h.hak.scale.set(1+(mv?Math.sin(t*12)*.03:0),1,1);h.coat.rotation.x=mv?-.18:-.04+Math.sin(t*1.7)*.02;h.hat.rotation.z=Math.sin(t*1.3)*.03}

/* ================= enemy defs ================= */
const ET={
 ghost:{n:'幽魂',hp:18,spd:3.3,dmg:7,r:.5,xp:1,pc:0xb8c8ff,body:[[GCo(.55,1.5),0,.75,0,0xc3cde2],[GS,0,1.6,0,0xe8ecf5,.32],[GB,.3,1.1,.35,0xc3cde2,[.12,.12,.7]],[GB,-.3,1.1,.35,0xc3cde2,[.12,.12,.7]]],eyes:[[GS,.11,1.66,.27,0xff3b2f,.07],[GS,-.11,1.66,.27,0xff3b2f,.07]]},
 skel:{n:'骷髅',hp:30,spd:4.3,dmg:9,r:.5,xp:2,pc:0xe8e2cc,body:[[GB,.15,.4,0,0xd8d2bc,[.13,.8,.13]],[GB,-.15,.4,0,0xd8d2bc,[.13,.8,.13]],[GB,0,1.1,0,0xd8d2bc,[.6,.6,.32]],[GS,0,1.66,0,0xece6d0,.28],[GB,.38,1.1,.2,0xd8d2bc,[.1,.1,.6]],[GB,-.38,1.1,.1,0xd8d2bc,[.1,.6,.1]],[GB,.38,1.05,.75,0x8a8e98,[.06,.06,1]]],eyes:[[GS,.1,1.68,.23,0x6dff7a,.07],[GS,-.1,1.68,.23,0x6dff7a,.07]]},
 caster:{n:'怨灵术士',hp:26,spd:2.8,dmg:9,r:.55,xp:3,pc:0xc77bff,body:[[GCo(.62,1.8),0,.9,0,0x4f2c72],[GCo(.38,.75),0,1.98,0,0x3a1f58],[GB,.42,1.2,.25,0x4f2c72,[.12,.12,.5]]],eyes:[[GS,.1,1.76,.26,0xd07bff,.07],[GS,-.1,1.76,.26,0xd07bff,.07],[GS,.45,1.35,.45,0xe0a0ff,.18]]},
 bomber:{n:'尸爆南瓜',hp:14,spd:5.2,dmg:18,r:.55,xp:2,pc:0xff9a2a,body:[[GS,0,.62,0,0xd8701a,[.62,.52,.62]],[GS,.25,.62,0,0xc0601a,[.35,.5,.5]],[GS,-.25,.62,0,0xc0601a,[.35,.5,.5]],[GB,0,1.2,0,0x4a7a2a,[.1,.3,.1]]],eyes:[[GCo(.1,.18,3),.2,.78,.52,0xffe14a,1],[GCo(.1,.18,3),-.2,.78,.52,0xffe14a,1],[GB,0,.5,.56,0xffe14a,[.42,.08,.05]]]},
 brute:{n:'石像鬼',hp:170,spd:2.3,dmg:20,r:1.15,xp:12,pc:0x9a98a8,heavy:1,body:[[GB,.4,.5,0,0x6c6a76,[.4,1,.4]],[GB,-.4,.5,0,0x6c6a76,[.4,1,.4]],[GB,0,1.6,0,0x7a7884,[1.5,1.2,1]],[GB,0,2.45,.15,0x6c6a76,[.7,.6,.6]],[GCo(.12,.5,6),.3,2.88,.1,0xb8b0a0,1],[GCo(.12,.5,6),-.3,2.88,.1,0xb8b0a0,1],[GB,.95,1.4,.1,0x6c6a76,[.4,1.3,.4]],[GB,-.95,1.4,.1,0x6c6a76,[.4,1.3,.4]],[GB,0,2.1,-.7,0x55535e,[1.6,.9,.1]]],eyes:[[GS,.15,2.5,.46,0xff9a2a,.08],[GS,-.15,2.5,.46,0xff9a2a,.08]]},
 boss:{n:'堕落主教',hp:1700,spd:2.7,dmg:24,r:1.8,xp:150,pc:0xff4d6d,boss:1,heavy:1,body:[[GCo(1.35,3.2,14),0,1.6,0,0x7a1426],[GB,0,1.6,.75,0xd9b44a,[.3,2.6,.06]],[GS,0,3.05,0,0x5a0c1a,[1.15,.5,.85]],[GS,0,3.55,0,0xc9c0b0,.42],[GB,0,4.3,0,0xd9b44a,[.55,.95,.35]],[GCo(.3,.5,4),0,5,0,0xd9b44a,1],[GC(.06,.06,4.6,6),1.2,2.3,.3,0x3a2a1a,1]],eyes:[[GS,.15,3.62,.37,0xffffff,.08],[GS,-.15,3.62,.37,0xffffff,.08],[GS,1.2,4.7,.3,0xff4d6d,.34]]}
};
for(const k in ET){const d=ET[k];const mk=a=>a.map(([g,x,y,z,c,s])=>{const S=Array.isArray(s)?s:[s||1,s||1,s||1];return{g,m:M4(x,y,z,0,S[0],S[1],S[2]),c}});d.geo=merge(mk(d.body));d.eyeGeo=merge(mk(d.eyes))}
const matFlash=idm(new T.MeshBasicMaterial({color:0xffffff}),ID.enemy);
const matIce=idm(new T.MeshLambertMaterial({color:0xa8e6ff,emissive:0x1d5a80}),ID.enemy);
const matElite=idm(new T.MeshLambertMaterial({vertexColors:true,emissive:0x6a4200}),ID.enemy);
const matStop=idm(new T.MeshLambertMaterial({color:0x9a9aa0}),ID.enemy);
const EPOOL={};
function getEMesh(t){const p=EPOOL[t]||(EPOOL[t]=[]);let g=p.pop();if(!g){g=new T.Group();g.body=new T.Mesh(ET[t].geo,matE);g.eyes=new T.Mesh(ET[t].eyeGeo,matEB);g.add(g.body,g.eyes)}g.visible=true;scene.add(g);return g}
function putEMesh(e){scene.remove(e.m);(EPOOL[e.t]||(EPOOL[e.t]=[])).push(e.m)}
const hpMul=()=>{const m=gt/60;return 1+m*.36+Math.max(0,m-5)*.3};
const dmgMul=()=>1+gt/60*.1;
function spawnEnemy(t,x,z,elite=false){
 if(x===undefined){for(let k=0;k<12;k++){const a=Math.random()*TAU,d=rand(21,27);x=clamp(P.x+Math.cos(a)*d,-A+2,A-2);z=clamp(P.z+Math.sin(a)*d,-A+2,A-2);if(!inBlock(x,z,1)&&Math.hypot(x-P.x,z-P.z)>14)break}}
 const d=ET[t],m=getEMesh(t),H=d.hp*hpMul()*(elite?5:1);
 const e={t,d,m,x,z,kx:0,kz:0,hp:H,maxHp:H,r:d.r*(elite?1.35:1),spd:d.spd*(elite?1.1:1)*rand(.9,1.12),dmg:d.dmg*dmgMul()*(elite?1.5:1),xp:d.xp*(elite?6:1),elite,sc:elite?1.35:1,
  frozen:0,slow:0,slowT:0,burn:0,burnT:0,pois:0,poisT:0,dotT:.5,flash:0,atkCd:.6,orbT:0,auraT:0,st:'',stT:rand(1.2,2.6),fuse:0,age:0,ph:Math.random()*TAU,dead:false};
 m.scale.setScalar(e.sc);m.position.set(x,0,z);enemies.push(e);burst(x,.6,z,6,0x8a5ad0,2.5,.25,.6,2,2);return e}
function spawnBoss(){let x,z;for(let k=0;k<20;k++){const a=Math.random()*TAU;x=clamp(P.x+Math.cos(a)*16,-A+4,A-4);z=clamp(P.z+Math.sin(a)*16,-A+4,A-4);if(!inBlock(x,z,2.5))break}
 const e=spawnEnemy('boss',x,z);e.hp=e.maxHp=1700*hpMul()*(1+bossN*.75);e.dmg=24*dmgMul();e.st='chase';e.stT=3;e.cyc=0;boss=e;bossN++;
 banner('堕落主教','第 '+bossN+' 次降临','#ff4d6d');MUS.int=2;sfx('boss');shake(.6);ringFx(x,z,1,14,1,0xff4d6d);$('#bossBar').classList.remove('hide');
 for(let i=0;i<30;i++)later(i*.03,()=>burst(x,rand(0,4),z,3,0xff4d6d,5,.3,1,0,3))}

/* ================= player ================= */
const rk=id=>P.ranks[id]||0;
function resetPlayer(){Object.assign(P,{x:0,z:-8,r:.5,face:Math.PI,hp:100,maxHp:100,lv:1,xp:0,sp:2,ranks:{},slots:[null,null,null,null],cds:{},
 atkT:0,atkDur:.26,combo:0,comboT:0,hit:false,dodgeT:0,dodgeCd:0,dvx:0,dvz:0,inv:0,shield:0,shieldT:0,whirlT:0,whirlTk:0,dashT:0,dashTr:0,revive:1,kills:0,orbA:0,auraT:0,cloudT:2,mvx:0,mvz:0,moving:false,bob:0,dmgDealt:0});recalc()}
function recalc(){const om=P.maxHp||100;
 P.atk=10*(1+.15*rk('s1'));P.atkSpd=1+.12*rk('s3');P.crit=.05+.08*rk('s5');P.critDmg=1.8;P.life=.015*rk('s7');
 P.skillMul=1+.12*rk('e1');P.chain=rk('e5');P.frozenBonus=.25+.25*rk('e6');P.slowAura=rk('e6')>0;
 P.maxHp=100+20*rk('a1');P.spd=6*(1+.08*rk('a2'));P.dodgeMul=1-.1*rk('a2');P.pick=2.4*(1+.4*rk('a5'));P.xpMul=1+.1*rk('a5');P.cdr=.08*rk('a7');
 if(P.maxHp>om)P.hp+=P.maxHp-om;P.hp=Math.min(P.hp,P.maxHp)}
const need=l=>Math.floor(6+l*5+l*l*.6);
function gainXp(v){P.xp+=v*P.xpMul;while(P.xp>=need(P.lv)){P.xp-=need(P.lv);P.lv++;const g=1+(P.lv%5===0?1:0);P.sp+=g;P.hp=Math.min(P.maxHp,P.hp+P.maxHp*.1);
 banner('Lv '+P.lv,'技能点 +'+g,'#f2c14e');sfx('level');ringFx(P.x,P.z,.5,5,.6,0xf2c14e);burst(P.x,1,P.z,24,0xf2c14e,6,.2,.8,-4,5);if(settings.autoTree)lvPending=.45}}
function heal(v){if(v<=0)return;P.hp=Math.min(P.maxHp,P.hp+v)}
function shake(a){shakeA=Math.max(shakeA,a)}
function hurtPlayer(d,src){if(P.inv>0||state!=='play')return;d=Math.round(d);
 if(P.shield>0&&P.shieldT>0){const a=Math.min(P.shield,d);P.shield-=a;d-=a;burst(P.x,1.2,P.z,8,0xf2c14e,5,.18,.4);
  if(src&&src.hp!==undefined&&!src.dead){const dx=src.x-P.x,dz=src.z-P.z,l=Math.hypot(dx,dz)||1;hurtEnemy(src,a*2+P.atk*1.5,{kb:12,kx:dx/l,kz:dz/l,crit:false,col:'#f2c14e'})}
  if(d<=0){P.inv=.25;return}}
 P.hp-=d;P.inv=.55;shake(.35);sfx('hurt');addNum(P.x,2.4,P.z,d,'#ff5a4a',false);const v=$('#vig');v.style.opacity=1;setTimeout(()=>v.style.opacity=0,160);
 if(P.hp<=0){if(rk('a9')&&P.revive){P.revive=0;P.hp=P.maxHp*.5;P.inv=2.5;banner('不灭','魂魄归位','#b892ff');sfx('shield');ringFx(P.x,P.z,1,9,.6,0xb892ff);
   enemies.forEach(e=>{const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz);if(l<9){hurtEnemy(e,P.atk*4,{kb:14,kx:dx/(l||1),kz:dz/(l||1),crit:false})}})}else gameOver()}}

function aimDir(range=8){const e=nearest(P.x,P.z,range);if(e){const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1;return{x:dx/l,z:dz/l,e}}return{x:Math.sin(P.face),z:Math.cos(P.face)}}
function nearest(x,z,r,skip){let b=null,bd=r*r;for(const e of enemies){if(e.dead||(skip&&skip.has(e)))continue;const d=(e.x-x)**2+(e.z-z)**2;if(d<bd){bd=d;b=e}}return b}
function inRad(x,z,r){const o=[];for(const e of enemies){if(e.dead)continue;const rr=r+e.r;if((e.x-x)**2+(e.z-z)**2<rr*rr)o.push(e)}return o}
function clusterPoint(range){const c=enemies.filter(e=>!e.dead&&(e.x-P.x)**2+(e.z-P.z)**2<range*range);
 if(!c.length){return{x:clamp(P.x+Math.sin(P.face)*5,-A+2,A-2),z:clamp(P.z+Math.cos(P.face)*5,-A+2,A-2)}}
 let best=c[0],bs=-1;for(let i=0;i<Math.min(25,c.length);i++){const a=c[(Math.random()*c.length)|0];let s=0;for(const b of c)if((a.x-b.x)**2+(a.z-b.z)**2<16)s++;if(s>bs){bs=s;best=a}}return{x:best.x,z:best.z}}

/* ================= damage ================= */
function addNum(x,y,z,v,col,big){if(nums.length>45)nums.shift();nums.push({x,y,z,v,col,big,t:0,dx:rand(-.3,.3)})}
function hurtEnemy(e,dmg,o={}){if(e.dead)return 0;let d=dmg;if(o.skill)d*=P.skillMul;let crit=false;
 if(o.crit!==false&&Math.random()<P.crit){crit=true;d*=P.critDmg}if(e.frozen>0)d*=1+P.frozenBonus;if(tstop>0)d*=1.3;
 d=Math.max(1,Math.round(d*rand(.9,1.1)));e.hp-=d;e.flash=.08;P.dmgDealt+=d;
 if(o.kb){const k=o.kb/(e.d.boss?8:e.d.heavy?3:1);e.kx+=o.kx*k;e.kz+=o.kz*k}
 if(o.burn){e.burn=Math.max(e.burn,o.burn);e.burnT=3}
 if(o.pois){e.pois=Math.max(e.pois,o.pois);e.poisT=2}
 if(o.freeze)e.frozen=Math.max(e.frozen,e.d.boss?o.freeze*.3:o.freeze);
 if(o.slow){e.slow=Math.max(e.slow,o.slow);e.slowT=Math.max(e.slowT,o.slowT||1.5)}
 if(o.dot?Math.random()<.25:(crit||o.melee||Math.random()<.6))addNum(e.x,2*e.sc*(e.d.boss?2:1),e.z,d,crit?'#ffd23f':(o.col||'#ffffff'),crit);
 if(crit&&o.melee)sfx('crit');
 if(o.melee&&P.life)heal(d*P.life);
 if(e.hp<=0)killEnemy(e);return d}
function killEnemy(e){e.dead=true;P.kills++;const d=e.d;
 burst(e.x,1,e.z,d.boss?90:d.heavy?30:12,d.pc,d.boss?12:7,d.boss?.35:.2,.8,-8,4);
 dropOrb(e.x,e.z,e.xp);if(Math.random()<(e.elite?1:.01))dropItem('potion',e.x,e.z);if(e.elite&&Math.random()<.5)dropItem('magnet',e.x+1,e.z);
 if(e.t==='bomber')explode(e,false);
 if(e.tele){rectP.put(e.tele);e.tele=null}
 if(d.boss){boss=null;MUS.int=1;$('#bossBar').classList.add('hide');P.sp+=2;heal(P.maxHp*.4);banner('主教陨落','技能点 +2 · 生命恢复','#f2c14e');sfx('boom');shake(1);slowT=.8;tScale=.25;
  for(let i=0;i<8;i++)later(i*.08,()=>ringFx(e.x,e.z,1,4+i*2,.5,0xff4d6d));for(let i=0;i<10;i++)dropOrb(e.x+rand(-3,3),e.z+rand(-3,3),30)}
 putEMesh(e)}
function explode(e,hitP){const x=e.x,z=e.z;ringFx(x,z,.5,3,.35,0xff9a2a);burst(x,.8,z,24,0xff8a2a,8,.25,.6,-6,5);sfx('boom');shake(.25);
 if(hitP&&Math.hypot(P.x-x,P.z-z)<2.9)hurtPlayer(e.dmg,null);
 inRad(x,z,2.8).forEach(o=>{if(o!==e){const dx=o.x-x,dz=o.z-z,l=Math.hypot(dx,dz)||1;hurtEnemy(o,hitP?15:P.atk*3,{kb:8,kx:dx/l,kz:dz/l,crit:false,col:'#ff9a2a'})}})}
function dropOrb(x,z,v){if(orbs.length>=OMAX-4){const o=orbs[(Math.random()*orbs.length)|0];o.v+=v;return}orbs.push({x:x+rand(-.4,.4),z:z+rand(-.4,.4),v,mag:false,sp:0,ph:Math.random()*TAU})}
const itemG={potion:new T.Mesh(new T.SphereGeometry(.38,10,8),idm(new T.MeshBasicMaterial({color:0xff3b4a}),ID.fx)),magnet:new T.Mesh(new T.TorusGeometry(.35,.12,6,14,Math.PI*1.3),idm(new T.MeshBasicMaterial({color:0x6fb8ff}),ID.fx))};
function dropItem(k,x,z){const m=itemG[k].clone();m.position.set(x,.6,z);scene.add(m);items.push({k,x,z,m,ph:0})}

/* ================= enemy update ================= */
const grid=new Map();
function updEnemies(dt){
 grid.clear();for(const e of enemies){if(e.dead)continue;const k=((e.x+60)>>1)*128+((e.z+60)>>1);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(e)}
 for(const e of enemies){if(e.dead)continue;e.age+=dt;if(e.flash>0)e.flash-=dt;if(e.orbT>0)e.orbT-=dt;if(e.auraT>0)e.auraT-=dt;
  if(e.burnT>0||e.poisT>0){e.dotT-=dt;if(e.dotT<=0){e.dotT=.5;if(e.burnT>0)hurtEnemy(e,e.burn*.5,{crit:false,col:'#ff9a4a',dot:1});if(!e.dead&&e.poisT>0)hurtEnemy(e,e.pois*.5,{crit:false,col:'#8be36a',dot:1})}
   e.burnT-=dt;e.poisT-=dt;if(Math.random()<dt*5)puff(e.x,1,e.z,e.burnT>0?0xff7a2a:0x6ae35a,.2,.5,2);if(e.dead)continue}
  const m=e.m;m.body.material=e.flash>0?matFlash:tstop>0?matStop:e.frozen>0?matIce:e.elite?matElite:matE;
  if(tstop>0)continue;
  let dx=P.x-e.x,dz=P.z-e.z;const dist=Math.hypot(dx,dz)||.001;dx/=dist;dz/=dist;
  let sf=e.slowT>0?1-e.slow:1;if(e.slowT>0)e.slowT-=dt;if(P.slowAura&&dist<5)sf*=.65;
  let vx=0,vz=0,face=true;
  if(e.frozen>0){e.frozen-=dt;sf=0}
  if(sf>0){
   if(e.t==='caster'){if(dist>10){vx=dx;vz=dz}else if(dist<7){vx=-dx;vz=-dz}else{vx=-dz*.6;vz=dx*.6}
    e.stT-=dt;if(e.stT<=0&&dist<17){e.stT=rand(2.2,3);const a=Math.atan2(dz,dx);eShoot(e.x,e.z,a,7,e.dmg);if(e.elite){eShoot(e.x,e.z,a+.3,7,e.dmg);eShoot(e.x,e.z,a-.3,7,e.dmg)}sfx('eshot')}}
   else if(e.t==='bomber'){if(e.fuse>0){e.fuse-=dt;e.flash=(e.fuse*10|0)%2?.05:0;if(e.fuse<=0){e.dead=true;explode(e,true);P.kills++;burst(e.x,1,e.z,10,0xff9a2a,6);putEMesh(e);continue}}
    else{vx=dx;vz=dz;if(dist<1.9)e.fuse=.6}}
   else if(e.t==='brute'){e.stT-=dt;if(e.st==='slam'){if(e.stT<=0){e.st='';e.stT=rand(4,6);ringFx(e.x,e.z,.5,3.4*e.sc,.3,0xffb060);burst(e.x,.4,e.z,20,0x9a98a8,7,.3,.6,-8,3);shake(.25);sfx('boom');if(Math.hypot(P.x-e.x,P.z-e.z)<3.4*e.sc+P.r)hurtPlayer(e.dmg*1.2,e);if(e.tele){discP.put(e.tele);e.tele=null}}}
    else{vx=dx;vz=dz;if(e.stT<=0&&dist<4.5){e.st='slam';e.stT=.75;const t=discP.get();t.material.color.set(0xff4020);t.material.opacity=.25;t.position.set(e.x,.06,e.z);t.scale.set(3.4*e.sc,1,3.4*e.sc);e.tele=t}}}
   else if(e.d.boss){bossAI(e,dt,dx,dz,dist);vx=e.vx||0;vz=e.vz||0;face=e.st!=='dash'}
   else{vx=dx;vz=dz}}
  const sp=e.spd*sf*(e.d.boss?1:1);
  e.x+=(vx*sp+e.kx)*dt;e.z+=(vz*sp+e.kz)*dt;const kd=Math.exp(-7*dt);e.kx*=kd;e.kz*=kd;
  // separation
  const gx=(e.x+60)>>1,gz=(e.z+60)>>1;
  for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++){const a=grid.get((gx+ix)*128+gz+iz);if(!a)continue;for(const o of a){if(o===e||o.dead)continue;const sx=e.x-o.x,sz=e.z-o.z,rr=e.r+o.r,d2=sx*sx+sz*sz;if(d2<rr*rr&&d2>1e-5){const d=Math.sqrt(d2),push=(rr-d)*(o.d.heavy&&!e.d.heavy?.9:.5);e.x+=sx/d*push;e.z+=sz/d*push}}}
  collide(e,e.r*.8);
  // contact
  if(e.atkCd>0)e.atkCd-=dt;
  if(dist<e.r+P.r+.15&&e.atkCd<=0&&e.t!=='bomber'){e.atkCd=.9;hurtPlayer(e.dmg,e)}
  // visuals
  m.position.set(e.x,(e.t==='ghost'?.25+Math.sin(e.age*3+e.ph)*.15:0),e.z);
  if(face&&(vx||vz))m.rotation.y=Math.atan2(dx,dz);
  if(e.t==='skel'||e.t==='brute')m.body.rotation.z=Math.sin(e.age*9+e.ph)*.06*sf;
  if(e.t==='bomber')m.scale.setScalar(e.sc*(1+(e.fuse>0?Math.sin(e.age*40)*.12:0)));
  if(e.t==='caster')m.eyes.position.y=Math.sin(e.age*2)*.1;
 }
 if(enemies.some(e=>e.dead)){let j=0;for(const e of enemies)if(!e.dead)enemies[j++]=e;enemies.length=j}
}
function eShoot(x,z,a,spd,dmg,col){const m=eShotP.get();m.material.color.set(col||0xc070ff);m.position.set(x,1.2,z);eshots.push({x,z,vx:Math.cos(a)*spd,vz:Math.sin(a)*spd,dmg,l:4.5,m})}
function updShots(dt){for(let i=eshots.length-1;i>=0;i--){const s=eshots[i];if(tstop<=0){s.x+=s.vx*dt;s.z+=s.vz*dt;s.l-=dt}s.m.position.set(s.x,1.2,s.z);
 let rm=s.l<=0||Math.abs(s.x)>A||Math.abs(s.z)>A;
 if(!rm&&(s.x-P.x)**2+(s.z-P.z)**2<.7){hurtPlayer(s.dmg,null);rm=true;burst(s.x,1.2,s.z,6,0xc070ff,4)}
 if(rm){eShotP.put(s.m);eshots.splice(i,1)}}}
function bossAI(e,dt,dx,dz,dist){const enr=e.hp<e.maxHp*.5;e.vx=0;e.vz=0;
 switch(e.st){
 case'chase':e.vx=dx;e.vz=dz;e.stT-=dt;if(e.stT<=0){e.cyc++;const nx=['ring','charge','summon','ring','charge','spiral'][e.cyc%6];e.st=nx;e.stT=nx==='ring'?1.5:nx==='charge'?.85:nx==='spiral'?2.4:.9;e.vol=0;e.volT=0;
   if(nx==='charge'){const t=rectP.get();t.material.color.set(0xff2040);t.material.opacity=.28;e.tele=t}
   if(nx==='summon'){for(let i=0;i<(enr?7:5);i++){const a=i/(enr?7:5)*TAU;spawnEnemy(i%3===2?'caster':'ghost',clamp(e.x+Math.cos(a)*3.5,-A+2,A-2),clamp(e.z+Math.sin(a)*3.5,-A+2,A-2))}ringFx(e.x,e.z,1,6,.5,0xc070ff)}}break;
 case'ring':e.volT-=dt;if(e.volT<=0&&e.vol<3){e.volT=.45;e.vol++;const n=enr?20:14;for(let i=0;i<n;i++)eShoot(e.x,e.z,i/n*TAU+e.vol*.22,7.5,e.dmg*.6,0xff4d6d);sfx('eshot')}
  e.stT-=dt;if(e.stT<=0){e.st='chase';e.stT=2.4}break;
 case'spiral':e.volT-=dt;if(e.volT<=0){e.volT=.09;e.vol++;const a=e.vol*.42;eShoot(e.x,e.z,a,6.5,e.dmg*.5,0xff7a9a);eShoot(e.x,e.z,a+Math.PI,6.5,e.dmg*.5,0xff7a9a);if(enr)eShoot(e.x,e.z,a+Math.PI/2,6.5,e.dmg*.5,0xff7a9a)}
  e.stT-=dt;if(e.stT<=0){e.st='chase';e.stT=2.2}break;
 case'charge':e.cdx=dx;e.cdz=dz;if(e.tele){e.tele.position.set(e.x,.07,e.z);e.tele.rotation.y=Math.atan2(dx,dz);e.tele.scale.set(3.4,1,16)}
  e.m.rotation.y=Math.atan2(dx,dz);e.stT-=dt;if(e.stT<=0){e.st='dash';e.stT=.75;e.hitD=false}break;
 case'dash':{const s=21;e.x+=e.cdx*s*dt;e.z+=e.cdz*s*dt;burst(e.x,.3,e.z,2,0xff4d6d,2,.25,.4,0,1);
  if(!e.hitD&&Math.hypot(P.x-e.x,P.z-e.z)<e.r+P.r+.4){e.hitD=true;hurtPlayer(e.dmg*1.4,e)}
  e.stT-=dt;if(e.stT<=0){e.st='chase';e.stT=enr?1.6:2.4;if(e.tele){rectP.put(e.tele);e.tele=null}shake(.3)}}break;
 case'summon':e.stT-=dt;if(e.stT<=0){e.st='chase';e.stT=2.2}break;
 }}

/* ================= fx helpers ================= */
function ringFx(x,z,r0,r1,dur,col,y=.1,op=1){const m=ringP.get();m.material.color.set(col);m.position.set(x,y,z);m.scale.set(r0,1,r0);let t=0;
 addFx({u(dt){t+=dt;const k=Math.min(1,t/dur),r=lerp(r0,r1,1-(1-k)*(1-k));m.scale.set(r,1,r);m.material.opacity=op*(1-k);return t<dur},e(){ringP.put(m)}})}
function boltFx(pts,w,col,dur=.18){const m=boltP.get();m.material.color.set(col);setRibbon(m,pts,w);let t=0;
 addFx({u(dt){t+=dt;m.material.opacity=Math.max(0,1-t/dur);return t<dur},e(){boltP.put(m)}})}
const slash3P=pool(()=>new T.Mesh(slash3G,addMat(0xfff6e0,.9)));
function slashFx(x,z,face,kind,col=0xaeb6c4,follow){const pl=kind===3?slash3P:slashP;const m=pl.get();m.material.color.set(col);m.position.set(x,1,z);m.rotation.set(0,face,0);m.scale.set(kind===2?-1:1,1,1);let t=0;const dur=kind===3?.24:.16;
 addFx({u(dt){t+=dt;m.material.opacity=.95*(1-t/dur);if(follow)m.position.set(P.x,1,P.z);if(kind===3)m.rotation.y-=dt*14;const s=1+t*1.2;m.scale.set((kind===2?-1:1)*s,1,s);return t<dur},e(){pl.put(m)}})}
function flashLight(x,z,i=4){boltLight.position.set(x,6,z);boltLight.intensity=Math.max(boltLight.intensity,i)}

/* ================= skill tree data ================= */
const BR=[{n:'剑道',c:'#ece6d6'},{n:'元素',c:'#59b8ff'},{n:'秘术',c:'#b892ff'}];
const pct=v=>Math.round(v*100)+'%';
const NODES=[
 {id:'s1',b:0,c:1,r:0,n:'锋刃',ic:'锋',t:'p',max:5,d:r=>`攻击力 +${15*r}%`},
 {id:'s2',b:0,c:0,r:1,n:'剑气斩',ic:'气',t:'a',max:3,cd:3.2,req:[['s1']],d:r=>`斩出月牙剑气，${pct(2.2*(1+.3*(r-1)))} 攻击伤害，穿透 ${3+2*r} 个敌人${r>=3?'，一次三道':''}`},
 {id:'s5',b:0,c:1,r:1,n:'会心',ic:'心',t:'p',max:4,req:[['s1']],d:r=>`暴击率 +${8*r}%（暴击 180% 伤害）`},
 {id:'s3',b:0,c:2,r:1,n:'疾风连斩',ic:'疾',t:'p',max:3,req:[['s1']],d:r=>`普攻速度 +${12*r}%`},
 {id:'s6',b:0,c:0,r:2,n:'飞剑环绕',ic:'环',t:'u',max:4,req:[['s2']],d:r=>`${1+r} 把飞剑环绕周身，自动切割靠近的敌人`},
 {id:'s7',b:0,c:1,r:2,n:'嗜血',ic:'血',t:'p',max:3,req:[['s5']],d:r=>`普攻伤害的 ${(1.5*r).toFixed(1)}% 转化为生命`},
 {id:'s4',b:0,c:2,r:2,n:'旋风斩',ic:'旋',t:'a',max:3,cd:9,req:[['s3']],d:r=>`化身旋风 ${2.5+.5*r} 秒，每 0.15 秒切割半径 ${(3.2+.3*r).toFixed(1)} 米内敌人`},
 {id:'s8',b:0,c:0,r:3,n:'万剑归宗',ic:'万',t:'a',max:3,cd:12,req:[['s6']],d:r=>`${14+6*r} 把天剑坠入敌群，每把 ${pct(1.5*(1+.2*(r-1)))} 伤害`},
 {id:'s9',b:0,c:2,r:3,n:'剑心通明',ic:'明',t:'p',max:1,req:[['s4']],d:()=>`普攻第三段额外向四周释放 4 道剑气`},
 {id:'s10',b:0,c:1,r:4,n:'拔刀·一闪',ic:'闪',t:'a',max:1,cost:3,cd:16,req:[['s8','s9'],['s7']],d:()=>`瞬身穿过敌阵，时间凝滞后一刀斩断路径上所有敌人（900% 伤害）`},
 {id:'e1',b:1,c:1,r:0,n:'元素亲和',ic:'元',t:'p',max:5,d:r=>`所有异能伤害 +${12*r}%`},
 {id:'e2',b:1,c:0,r:1,n:'雷霆',ic:'雷',t:'a',max:3,cd:4,k:'#ffe35a',req:[['e1']],d:r=>`天雷劈中 ${3+2*(r-1)} 个敌人，每道 ${pct(2.2*(1+.25*(r-1)))} 伤害`},
 {id:'e3',b:1,c:1,r:1,n:'冰霜新星',ic:'冰',t:'a',max:3,cd:8,k:'#8fe0ff',req:[['e1']],d:r=>`冰爆冻结半径 ${5+r} 米内敌人 ${1.5+.5*r} 秒`},
 {id:'e4',b:1,c:2,r:1,n:'烈焰冲刺',ic:'炎',t:'a',max:3,cd:5,k:'#ff7a2e',req:[['e1']],d:r=>`向前冲刺 8 米（无敌），留下灼烧 3 秒的火路，${pct(.7*(1+.35*(r-1)))}/0.4秒`},
 {id:'e5',b:1,c:0,r:2,n:'连锁闪电',ic:'链',t:'p',max:3,k:'#ffe35a',req:[['e2']],d:r=>`所有雷击额外弹射 ${r} 次`},
 {id:'e6',b:1,c:1,r:2,n:'寒冰之心',ic:'寒',t:'p',max:2,k:'#8fe0ff',req:[['e3']],d:r=>`冻结的敌人受到伤害 +${25+25*r}%，周身寒气减速 5 米内敌人`},
 {id:'e7',b:1,c:2,r:2,n:'火焰光环',ic:'焰',t:'u',max:3,k:'#ff7a2e',req:[['e4']],d:r=>`周身燃起半径 ${(2.4+.4*r).toFixed(1)} 米火环，持续灼烧敌人`},
 {id:'e9',b:1,c:0,r:3,n:'雷云',ic:'云',t:'u',max:3,k:'#ffe35a',req:[['e5']],d:r=>`头顶雷云每 ${(3.2-.6*(r-1)).toFixed(1)} 秒自动落雷`},
 {id:'e8',b:1,c:2,r:3,n:'陨石术',ic:'陨',t:'a',max:3,cd:10,k:'#ff7a2e',req:[['e7']],d:r=>`召唤 ${r} 颗陨石砸向敌群，${pct(5*(1+.2*(r-1)))} 伤害并点燃地面`},
 {id:'e10',b:1,c:1,r:4,n:'元素风暴',ic:'暴',t:'a',max:1,cost:3,cd:32,req:[['e9','e8'],['e6']],d:()=>`6 秒内雷、冰、火同时覆盖全场`},
 {id:'a1',b:2,c:1,r:0,n:'体魄',ic:'体',t:'p',max:5,d:r=>`最大生命 +${20*r}`},
 {id:'a2',b:2,c:0,r:1,n:'疾行',ic:'行',t:'p',max:3,req:[['a1']],d:r=>`移速 +${8*r}%，闪避冷却 -${10*r}%`},
 {id:'a3',b:2,c:1,r:1,n:'护体金钟',ic:'钟',t:'a',max:3,cd:15,k:'#f2c14e',req:[['a1']],d:r=>`金钟护体 6 秒，吸收 ${30+25*r}+10%生命 伤害并反震触碰者`},
 {id:'a5',b:2,c:2,r:1,n:'磁力',ic:'磁',t:'p',max:3,req:[['a1']],d:r=>`拾取范围 +${40*r}%，经验 +${10*r}%`},
 {id:'a4',b:2,c:0,r:2,n:'影分身',ic:'影',t:'a',max:3,cd:16,req:[['a2']],d:r=>`召唤 ${1+r} 个影分身协同作战 8 秒`},
 {id:'a6',b:2,c:1,r:2,n:'毒雾',ic:'毒',t:'a',max:3,cd:9,k:'#7be36a',req:[['a3']],d:r=>`在敌群释放半径 ${(4+.5*r).toFixed(1)} 米毒雾 5 秒，持续伤害并减速`},
 {id:'a7',b:2,c:2,r:2,n:'冷却精通',ic:'律',t:'p',max:3,req:[['a5','a3']],d:r=>`所有异能冷却 -${8*r}%`},
 {id:'a8',b:2,c:0,r:3,n:'黑洞',ic:'渊',t:'a',max:3,cd:14,req:[['a4','a6']],d:r=>`撕开黑洞 3 秒，吞噬 ${7+r} 米内敌人，最后爆裂`},
 {id:'a9',b:2,c:2,r:3,n:'不灭',ic:'魂',t:'p',max:1,req:[['a7']],d:()=>`倒下时原地复活一次，恢复 50% 生命并震退敌人`},
 {id:'a10',b:2,c:1,r:4,n:'时停',ic:'时',t:'a',max:1,cost:3,cd:40,req:[['a8'],['a9']],d:()=>`时间静止 4 秒，敌人与弹幕全部定格，你的伤害 +30%`},
];
const NM={};NODES.forEach(n=>{NM[n.id]=n;n.cost=n.cost||1;n.col=n.k||BR[n.b].c});
const reqMet=n=>(n.req||[]).every(g=>g.some(id=>rk(id)>0));
const canBuy=n=>rk(n.id)<n.max&&P.sp>=n.cost&&reqMet(n);
const cdOf=id=>NM[id].cd*(1-P.cdr);

/* ================= active skills ================= */
function castSlot(i){if(state!=='play')return;const id=P.slots[i];if(!id)return;if((P.cds[id]||0)>0){sfx('tick');return}
 const r=rk(id);if(!r)return;const ok=SK[id](r);if(ok===false)return;P.cds[id]=cdOf(id);
 const n=NM[id];burst(P.x,2,P.z,8,parseInt(n.col.slice(1),16),3,.15,.5,0,3)}
const SK={
 s2(r){const d=aimDir(14);const n=r>=3?3:1;const a0=Math.atan2(d.x,d.z);for(let i=0;i<n;i++)fireWave(a0+(i-(n-1)/2)*.24,P.atk*2.2*(1+.3*(r-1)),3+r*2,1);P.face=a0;sfx('wave')},
 s4(r){P.whirlT=2.5+.5*r;P.whirlR=3.2+.3*r;P.whirlD=P.atk*.65*(1+.25*(r-1));P.whirlTk=0;sfx('slash3')},
 s8(r){const c=clusterPoint(15);const n=14+6*r,dm=P.atk*1.5*(1+.2*(r-1));ringFx(c.x,c.z,5.5,5.5,1.8,0xdff6ff,.08,.5);
  for(let i=0;i<n;i++)later(i*(1.4/n),()=>{const a=Math.random()*TAU,d=Math.sqrt(Math.random())*5.2;skySword(c.x+Math.cos(a)*d,c.z+Math.sin(a)*d,dm)})},
 s10(){issen()},
 e2(r){const t=inRad(P.x,P.z,16).sort((a,b)=>((a.x-P.x)**2+(a.z-P.z)**2)-((b.x-P.x)**2+(b.z-P.z)**2)).slice(0,3+2*(r-1));if(!t.length)return false;
  t.forEach((e,i)=>later(i*.07,()=>strike(e,P.atk*2.2*(1+.25*(r-1)),P.chain)))},
 e3(r){frostNova(P.x,P.z,5+r,P.atk*1.6*(1+.25*(r-1)),1.5+.5*r)},
 e4(r){let dx=P.mvx,dz=P.mvz;if(!dx&&!dz){const d=aimDir(10);dx=d.x;dz=d.z}const l=Math.hypot(dx,dz)||1;P.dashT=.24;P.dvx=dx/l*34;P.dvz=dz/l*34;P.inv=Math.max(P.inv,.35);P.dashDmg=P.atk*.7*(1+.35*(r-1));P.dashTr=0;P.face=Math.atan2(dx,dz);sfx('fire')},
 e8(r){for(let i=0;i<r;i++)later(i*.28,()=>{const c=clusterPoint(17);meteor(c.x+rand(-1.5,1.5),c.z+rand(-1.5,1.5),P.atk*5*(1+.2*(r-1)))})},
 e10(){storm(6)},
 a3(r){P.shield=30+25*r+P.maxHp*.1;P.shieldT=6;sfx('shield');ringFx(P.x,P.z,1,5,.4,0xf2c14e);
  inRad(P.x,P.z,4).forEach(e=>{const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,P.atk,{kb:12,kx:dx/l,kz:dz/l,skill:1,crit:false,col:'#f2c14e'})})},
 a4(r){for(let i=0;i<1+r;i++)spawnClone(r,i);sfx('clone')},
 a6(r){const c=clusterPoint(13);poisonCloud(c.x,c.z,4+.5*r,P.atk*.8*(1+.3*(r-1)))},
 a8(r){const c=clusterPoint(13);blackHole(c.x,c.z,7+r,P.atk*.8*(1+.25*(r-1)))},
 a10(){tstop=4;sfx('time');ringFx(P.x,P.z,1,40,1.2,0xffffff,.2);banner('时停','THE WORLD','#ffffff')},
};
function fireWave(a,dmg,pierce,sc=1,col=0xc8f4ff){const m=waveP.get();m.material.color.set(col);m.scale.set(sc,1,sc);const vx=Math.sin(a)*22,vz=Math.cos(a)*22;let x=P.x,z=P.z,t=0;const hit=new Set();m.rotation.y=a;
 addFx({u(dt){t+=dt;x+=vx*dt;z+=vz*dt;m.position.set(x,1,z);m.material.opacity=.95*(1-t/.85);
  for(const e of enemies){if(e.dead||hit.has(e))continue;if((e.x-x)**2+(e.z-z)**2<(1.5*sc+e.r)**2){hit.add(e);hurtEnemy(e,dmg,{skill:1,kb:4,kx:vx/22,kz:vz/22,col:'#c8f4ff'});burst(e.x,1,e.z,4,col,4,.15,.3);if(--pierce<=0)return false}}
  return t<.85&&!inBlock(x,z,0)},e(){waveP.put(m)}})}
function skySword(x,z,dmg){const m=bladeP.get();m.rotation.set(Math.PI/2,0,0);let y=11,t=0,landed=false;
 addFx({u(dt){t+=dt;if(!landed){y-=dt*48;if(y<=.8){y=.8;landed=true;t=0;inRad(x,z,1.3).forEach(e=>hurtEnemy(e,dmg,{skill:1,kb:2,kx:e.x-x,kz:e.z-z,col:'#dff6ff'}));burst(x,.4,z,6,0xdff6ff,5,.15,.4,-8,3);ringFx(x,z,.2,1.4,.25,0xdff6ff);sfx('hit',.6)}}
  m.position.set(x,y,z);return !landed||t<.35},e(){bladeP.put(m)}})}
function strike(e,dmg,chain,from){if(e.dead)return;const pts=from?jag(from.x,1.2,from.z,e.x,1.2,e.z,.5):jag(e.x+rand(-1,1),16,e.z+rand(-1,1),e.x,.2,e.z,.9);
 boltFx(pts,from?.12:.22,0xe8f6ff);if(!from){boltFx(jag(e.x,16,e.z,e.x,.2,e.z,1.2),.08,0x9fd8ff,.12);ringFx(e.x,e.z,.3,2,.25,0xbfe4ff)}
 flashLight(e.x,e.z,from?2:5);burst(e.x,1,e.z,8,0xcfeaff,6,.15,.35,-6,4);sfx('thunder');
 const hitSet=(strike._s=from?strike._s:new Set());hitSet.add(e);hurtEnemy(e,dmg,{skill:1,kb:2,kx:0,kz:0,col:'#9fd8ff'});
 if(chain>0){const n=nearest(e.x,e.z,7,hitSet);if(n){const fx={x:e.x,z:e.z};later(.06,()=>strike(n,dmg*.8,chain-1,fx))}}}
function frostNova(x,z,R,dmg,fr){ringFx(x,z,.5,R,.35,0x8fe0ff,.15);ringFx(x,z,.3,R*.7,.5,0xffffff,.1,.6);sfx('frost');flashLight(x,z,2.5);
 for(let i=0;i<36;i++){const a=i/36*TAU;parts.length<PMAX&&parts.push({x,y:.5,z,vx:Math.cos(a)*R*2.6,vy:1.5,vz:Math.sin(a)*R*2.6,l:.4,m:.4,s:.25,c:0xbfefff,g:0})}
 inRad(x,z,R).forEach(e=>{const dx=e.x-x,dz=e.z-z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,dmg,{skill:1,freeze:fr,kb:3,kx:dx/l,kz:dz/l,col:'#8fe0ff'});burst(e.x,1,e.z,3,0xbfefff,3,.2,.5)})}
function firePatch(x,z,dmg,dur=3,R=1.3){const m=discP.get();m.material.color.set(0xff5a1a);m.material.opacity=.32;m.position.set(x,.06,z);m.scale.set(R,1,R);let t=0,tk=0;
 addFx({u(dt){t+=dt;tk-=dt;if(Math.random()<dt*10)puff(x,.2,z,Math.random()<.5?0xff7a2a:0xffc040,.22,.5,2.5,R*.7);
  if(tk<=0){tk=.4;inRad(x,z,R).forEach(e=>hurtEnemy(e,dmg,{skill:1,crit:false,burn:dmg*.6,col:'#ff9a4a',dot:1}))}
  m.material.opacity=.32*Math.min(1,(dur-t)*2);return t<dur},e(){discP.put(m)}})}
function meteor(x,z,dmg){const tel=discP.get();tel.material.color.set(0xff3010);tel.material.opacity=.22;tel.position.set(x,.07,z);const rock=rockP.get();let t=0;const D=.75;
 addFx({u(dt){t+=dt;const k=Math.min(1,t/D);tel.scale.set(4*k,1,4*k);rock.position.set(x+7*(1-k),.5+15*(1-k),z-7*(1-k));rock.rotation.x+=dt*6;puff(rock.position.x,rock.position.y,rock.position.z,0xff9a3a,.4,.5,0,.5);
  if(t>=D){tel.scale.set(0,1,0);ringFx(x,z,.5,4.5,.4,0xff8a2a);ringFx(x,z,.5,3,.6,0xffffff,.1,.7);burst(x,.5,z,40,0xff8a2a,11,.3,.8,-9,6);burst(x,.5,z,14,0x5a4a40,6,.35,1,-10,5);
   sfx('boom');shake(.5);flashLight(x,z,6);inRad(x,z,4).forEach(e=>{const dx=e.x-x,dz=e.z-z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,dmg,{skill:1,kb:10,kx:dx/l,kz:dz/l,burn:dmg*.12,col:'#ff9a4a'})});
   firePatch(x,z,dmg*.1,3,2.6);return false}return true},e(){discP.put(tel);rockP.put(rock)}})}
function storm(dur){banner('元素风暴','','#59b8ff');let t=0,a=0,b=0,c=0;sfx('thunder');
 addFx({u(dt){t+=dt;a-=dt;b-=dt;c-=dt;const near=()=>{const l=inRad(P.x,P.z,18);return l[(Math.random()*l.length)|0]};
  if(a<=0){a=.16;const e=near();if(e)strike(e,P.atk*1.8,1)}
  if(b<=0){b=.55;const e=near();if(e)frostNova(e.x,e.z,3,P.atk*1.2,1.2)}
  if(c<=0){c=.5;const e=near();if(e)meteor(e.x,e.z,P.atk*3)}
  return t<dur}})}
function poisonCloud(x,z,R,dmg){const m=discP.get();m.material.color.set(0x3ac02a);m.material.opacity=.26;m.position.set(x,.06,z);m.scale.set(R,1,R);let t=0,tk=0;sfx('poison');
 addFx({u(dt){t+=dt;tk-=dt;for(let i=0;i<3;i++)if(Math.random()<dt*14){const a=Math.random()*TAU,d=Math.sqrt(Math.random())*R;puff(x+Math.cos(a)*d,.3,z+Math.sin(a)*d,Math.random()<.6?0x5ae34a:0xb0ff80,.45,.9,.8,.2)}
  if(tk<=0){tk=.5;inRad(x,z,R).forEach(e=>hurtEnemy(e,dmg*.5,{skill:1,crit:false,pois:dmg*.4,slow:.4,slowT:1,col:'#8be36a',dot:1}))}
  m.material.opacity=.26*Math.min(1,(5-t)*2);return t<5},e(){discP.put(m)}})}
const voidP=pool(()=>new T.Mesh(GS,idm(new T.MeshBasicMaterial({color:0x000000}),ID.fx)));
function blackHole(x,z,R,dmg){const core=voidP.get(),ring=ringP.get(),ring2=ringP.get();ring.material.color.set(0xa060ff);ring2.material.color.set(0xff60d0);core.position.set(x,1,z);ring.position.set(x,1,z);ring2.position.set(x,1,z);let t=0,tk=0;sfx('void');
 addFx({u(dt){t+=dt;tk-=dt;const k=Math.min(1,t/.3);core.scale.setScalar(1.3*k);ring.scale.set(2.4*k,1,2.4*k);ring.rotation.set(.5,t*4,0);ring2.scale.set(1.9*k,1,1.9*k);ring2.rotation.set(-.4,-t*5,.3);ring.material.opacity=.9;ring2.material.opacity=.8;
  for(let i=0;i<3;i++){const a=Math.random()*TAU,d=R*rand(.4,1);if(parts.length<PMAX)parts.push({x:x+Math.cos(a)*d,y:rand(.3,2),z:z+Math.sin(a)*d,vx:-Math.cos(a)*d*2+Math.sin(a)*6,vy:0,vz:-Math.sin(a)*d*2-Math.cos(a)*6,l:.45,m:.45,s:.16,c:Math.random()<.5?0xb070ff:0xff70e0,g:0})}
  for(const e of enemies){if(e.dead||e.d.boss)continue;const dx=x-e.x,dz=z-e.z,l=Math.hypot(dx,dz);if(l<R&&l>.3){const f=(e.d.heavy?5:14)*dt;e.x+=dx/l*Math.min(l,f*(1.3-l/R)*2);e.z+=dz/l*Math.min(l,f*(1.3-l/R)*2)}}
  if(tk<=0){tk=.4;inRad(x,z,2.6).forEach(e=>hurtEnemy(e,dmg*.4,{skill:1,crit:false,col:'#c090ff',dot:1}))}
  if(t>=3){ringFx(x,z,.5,5.5,.4,0xd090ff);burst(x,1,z,40,0xc070ff,10,.25,.7,-4,4);sfx('boom');shake(.45);
   inRad(x,z,5.5).forEach(e=>{const dx=e.x-x,dz=e.z-z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,dmg*5,{skill:1,kb:12,kx:dx/l,kz:dz/l,col:'#d090ff'})});return false}
  return true},e(){voidP.put(core);ringP.put(ring);ringP.put(ring2)}})}
function spawnClone(r,i){const c=buildRonin(cMats);c.g.scale.setScalar(1.15);const a=i*2.1+Math.random();c.g.position.set(P.x+Math.cos(a)*1.5,0,P.z+Math.sin(a)*1.5);scene.add(c.g);
 const o={c,x:c.g.position.x,z:c.g.position.z,t:8,atk:0,face:0,dmg:P.atk*.7*(1+.25*(r-1)),sw:0};clones.push(o);burst(o.x,1,o.z,14,0xa070ff,4,.2,.5,0,3)}
function updClones(dt){for(let i=clones.length-1;i>=0;i--){const o=clones[i];o.t-=dt;o.atk-=dt;o.sw-=dt;
 const e=nearest(o.x,o.z,22);if(e){const dx=e.x-o.x,dz=e.z-o.z,l=Math.hypot(dx,dz)||1;o.face=Math.atan2(dx,dz);
   if(l>e.r+1.3){o.x+=dx/l*9*dt;o.z+=dz/l*9*dt}else if(o.atk<=0){o.atk=.42;o.sw=.2;slashFx(o.x,o.z,o.face,1+(Math.random()<.5),0xb080ff);
    inRad(o.x+dx/l*1.2,o.z+dz/l*1.2,1.6).forEach(t=>hurtEnemy(t,o.dmg,{skill:1,kb:3,kx:dx/l,kz:dz/l,col:'#c8a8ff'}));sfx('slash',.5)}}
  else{const dx=P.x-o.x,dz=P.z-o.z,l=Math.hypot(dx,dz);if(l>2.5){o.x+=dx/l*8*dt;o.z+=dz/l*8*dt;o.face=Math.atan2(dx,dz)}}
  collide(o,.4);o.c.g.position.set(o.x,0,o.z);o.c.g.rotation.y=o.face;poseRig(o.c,o.sw>0?(o.alt?'a2':'a1'):'idle',1-o.sw/.2,rtime+o.t,true);if(o.sw>0&&o.sw-dt<=0)o.alt=!o.alt;
  if(o.t<=0){burst(o.x,1,o.z,14,0xa070ff,4,.2,.5,0,3);scene.remove(o.c.g);clones.splice(i,1)}}}
function issen(){const d=aimDir(12);const sx=P.x,sz=P.z;let ex=sx+d.x*11,ez=sz+d.z*11;ex=clamp(ex,-A+1.5,A-1.5);ez=clamp(ez,-A+1.5,A-1.5);
 const L=Math.hypot(ex-sx,ez-sz)||1,ux=(ex-sx)/L,uz=(ez-sz)/L;const marked=[];
 for(const e of enemies){if(e.dead)continue;const px=e.x-sx,pz=e.z-sz,tt=clamp(px*ux+pz*uz,0,L),qx=sx+ux*tt-e.x,qz=sz+uz*tt-e.z;if(qx*qx+qz*qz<(1.8+e.r)**2)marked.push(e)}
 for(let i=0;i<10;i++)burst(lerp(sx,ex,i/9),1,lerp(sz,ez,i/9),3,0xffffff,2,.18,.5,0,1);
 P.x=ex;P.z=ez;collide(P,.5);P.face=Math.atan2(ux,uz);P.inv=Math.max(P.inv,1);boltFx([...Array(BOLTN)].map((_,i)=>({x:lerp(sx,ex,i/(BOLTN-1)),y:1.1,z:lerp(sz,ez,i/(BOLTN-1))})),.12,0xffffff,.6);
 tScale=.12;slowT=.55;sfx('issen');marked.forEach(e=>{e.frozen=Math.max(e.frozen,.6)});
 later(.06,()=>{boltFx([...Array(BOLTN)].map((_,i)=>({x:lerp(sx,ex,i/(BOLTN-1)),y:1.1,z:lerp(sz,ez,i/(BOLTN-1))})),.45,0xffffff,.35);shake(.7);sfx('slash3');
  marked.forEach(e=>{hurtEnemy(e,P.atk*9,{skill:1,kb:6,kx:-uz,kz:ux,col:'#ffffff'});burst(e.x,1,e.z,12,0xffffff,8,.2,.5,-6,4)})})}

/* ================= player update ================= */
function startAttack(){if(P.atkT>0||P.dodgeT>0||P.dashT>0||P.whirlT>0)return;const d=aimDir(6.5);P.face=Math.atan2(d.x,d.z);
 P.combo=P.comboT>0?P.combo%3+1:1;P.atkDur=(P.combo===3?.36:.26)/P.atkSpd;P.atkT=P.atkDur;P.hit=false;P.comboT=P.atkDur+.38;sfx(P.combo===3?'slash3':'slash')}
function meleeHit(){const c=P.combo,R=c===3?3.7:3.1,fx=Math.sin(P.face),fz=Math.cos(P.face),mul=[1,1,1.15,1.9][c];let n=0;
 if(c===3)slashFx(P.x,P.z,P.face,3,0x707888);
 for(const e of enemies){if(e.dead)continue;const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz);if(l>R+e.r)continue;
  if(c!==3&&l>.8&&(dx*fx+dz*fz)/l<.3)continue;n++;hurtEnemy(e,P.atk*mul,{melee:1,kb:c===3?9:4.5,kx:dx/(l||1),kz:dz/(l||1)});burst(e.x,1.1,e.z,5,0xfff0d0,5,.15,.3,-6,3)}
 for(let i=eshots.length-1;i>=0;i--){const s=eshots[i];if((s.x-P.x)**2+(s.z-P.z)**2<R*R){burst(s.x,1.2,s.z,5,0xffffff,4);eShotP.put(s.m);eshots.splice(i,1)}}
 if(n){hs=Math.max(hs,c===3?.075:.035);shake(c===3?.22:.1);sfx('hit')}
 if(c===3&&rk('s9'))for(let i=0;i<4;i++)fireWave(P.face+i*Math.PI/2,P.atk*1.6,4,.9)}
function dodge(){if(state!=='play'||P.dodgeCd>0||P.dodgeT>0||P.dashT>0)return;let dx=P.mvx,dz=P.mvz;if(!dx&&!dz){dx=Math.sin(P.face);dz=Math.cos(P.face)}const l=Math.hypot(dx,dz)||1;
 P.dodgeT=.27;P.dvx=dx/l*17;P.dvz=dz/l*17;P.inv=Math.max(P.inv,.38);P.dodgeCd=.9*P.dodgeMul;P.atkT=0;P.face=Math.atan2(dx,dz);sfx('dodge')}
function updPlayer(dt,inp){
 P.inv-=dt;P.dodgeCd-=dt;P.comboT-=dt;for(const k in P.cds)if(P.cds[k]>0)P.cds[k]-=dt;
 P.mvx=inp.x;P.mvz=inp.z;const mv=Math.hypot(inp.x,inp.z);P.moving=mv>.05;
 if(P.dodgeT>0){P.dodgeT-=dt;P.x+=P.dvx*dt;P.z+=P.dvz*dt;if(Math.random()<.6)puff(P.x,1,P.z,0xc9c4b8,.3,.25,0,.2)}
 else if(P.dashT>0){P.dashT-=dt;P.x+=P.dvx*dt;P.z+=P.dvz*dt;P.dashTr-=dt;if(P.dashTr<=0){P.dashTr=.035;firePatch(P.x,P.z,P.dashDmg)}burst(P.x,.8,P.z,2,0xff8a2a,2,.25,.3,0,2)}
 else{let sp=P.spd*(P.atkT>0?.35:1)*(P.whirlT>0?.85:1);P.x+=inp.x*sp*dt;P.z+=inp.z*sp*dt;
  if(P.atkT>0){P.x+=Math.sin(P.face)*2.2*dt;P.z+=Math.cos(P.face)*2.2*dt}else if(P.moving&&P.whirlT<=0)P.face=Math.atan2(inp.x,inp.z)}
 collide(P,.5);
 if(P.atkT>0){P.atkT-=dt;if(!P.hit&&P.atkT<P.atkDur*.62){P.hit=true;meleeHit()}}
 if(inp.atk)startAttack();
 // whirlwind
 if(P.whirlT>0){P.whirlT-=dt;P.whirlTk-=dt;if(P.whirlTk<=0){P.whirlTk=.15;slashFx(P.x,P.z,rtime*12,3,0x8c887c,true);let n=0;
   inRad(P.x,P.z,P.whirlR).forEach(e=>{const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,P.whirlD,{skill:1,melee:1,kb:3,kx:dx/l,kz:dz/l});n++});if(n)sfx('hit',.6);sfx('slash',.4)}}
 // shield
 if(P.shieldT>0){P.shieldT-=dt;if(P.shieldT<=0||P.shield<=0){P.shield=0;P.shieldT=0}}
 // orbit swords
 const on=rk('s6')?1+rk('s6'):0;P.orbA+=dt*3.4;
 while(orbitB.length<on)orbitB.push(bladeP.get());while(orbitB.length>on)bladeP.put(orbitB.pop());
 orbitB.forEach((m,i)=>{const a=P.orbA+i*TAU/on,x=P.x+Math.cos(a)*2.7,z=P.z+Math.sin(a)*2.7;m.position.set(x,1.1,z);m.rotation.set(0,-a,0);
  for(const e of enemies){if(e.dead||e.orbT>0)continue;if((e.x-x)**2+(e.z-z)**2<(.8+e.r)**2){e.orbT=.35;hurtEnemy(e,P.atk*.55*(1+.2*(rk('s6')-1)),{skill:1,kb:3,kx:Math.cos(a),kz:Math.sin(a),col:'#dff6ff'});burst(x,1.1,z,3,0xdff6ff,3,.12,.25)}}});
 // flame aura
 const fa=rk('e7');if(fa){const R=2.4+.4*fa;if(!auraM){auraM=ringP.get();auraM.material.color.set(0xff6a1a)}auraM.position.set(P.x,.1,P.z);auraM.scale.set(R,1,R);auraM.material.opacity=.16+Math.sin(rtime*8)*.05;
  for(let i=0;i<2;i++)if(Math.random()<.8){const a=Math.random()*TAU;puff(P.x+Math.cos(a)*R*rand(.6,1),.2,P.z+Math.sin(a)*R*rand(.6,1),Math.random()<.5?0xff6a1a:0xffb040,.2,.45,2.2,.1)}
  P.auraT-=dt;if(P.auraT<=0){P.auraT=.5;inRad(P.x,P.z,R).forEach(e=>hurtEnemy(e,P.atk*.35*(1+.4*(fa-1)),{skill:1,crit:false,burn:P.atk*.25*fa,col:'#ff9a4a',dot:1}));if(inRad(P.x,P.z,R).length)sfx('burn')}}
 // thunder cloud
 const tc=rk('e9');if(tc){P.cloudT-=dt;if(Math.random()<dt*6)puff(P.x+rand(-1.5,1.5),4.2,P.z+rand(-1.5,1.5),0x8aa8d0,.5,.6,0,.1);if(P.cloudT<=0){const e=nearest(P.x,P.z,14);if(e){P.cloudT=3.2-.6*(tc-1);strike(e,P.atk*2.4*(1+.25*(tc-1)),P.chain)}}}
 if(P.slowAura&&Math.random()<dt*8){const a=Math.random()*TAU;puff(P.x+Math.cos(a)*rand(1,4.5),.2,P.z+Math.sin(a)*rand(1,4.5),0x9fe8ff,.12,.6,.6,.1)}
 // regen tiny
 if(P.hp<P.maxHp)P.hp=Math.min(P.maxHp,P.hp+dt*.4);
 if(lvPending>0){lvPending-=dt;if(lvPending<=0&&state==='play'&&P.sp>0)openTree()}
}
const orbitB=[];let auraM=null;
function poseHero(dt){const h=hero;h.g.position.set(P.x,0,P.z);P.bob+=dt*(P.moving?12:3);
 if(P.whirlT>0)h.g.rotation.y+=dt*22;else{let df=P.face-h.g.rotation.y;df=Math.atan2(Math.sin(df),Math.cos(df));h.g.rotation.y+=df*Math.min(1,dt*18)}
 h.body.position.y=P.moving?Math.abs(Math.sin(P.bob))*.07:Math.sin(P.bob)*.015;
 h.body.rotation.x=P.dodgeT>0||P.dashT>0?.45:P.moving?.14:P.atkT>0?.08:0;
 const mode=P.whirlT>0?'spin':P.dodgeT>0||P.dashT>0?'dash':P.atkT>0?'a'+P.combo:'idle';
 poseRig(h,mode,P.atkT>0?1-P.atkT/P.atkDur:0,rtime,P.moving&&P.atkT<=0);
 updTrail(state==='play'&&(P.atkT>0||P.whirlT>0));
 h.g.visible=!(P.inv>0&&P.inv<.5&&!P.dodgeT&&!P.dashT&&(rtime*20|0)%2);
 shadowM.position.set(P.x,.04,P.z);
 plight.position.set(P.x+1.2,2.6,P.z+3.2);
 if(P.shieldT>0){if(!shieldM){shieldM=sphP.get();shieldM.material.color.set(0xf2c14e)}shieldM.position.set(P.x,1.2,P.z);shieldM.scale.setScalar(1.7+Math.sin(rtime*6)*.06);shieldM.material.opacity=.18+.1*Math.sin(rtime*9)}
 else if(shieldM){sphP.put(shieldM);shieldM=null}}
let shieldM=null;

/* ================= items & orbs update ================= */
function updOrbs(dt){const pr=P.pick;for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];const dx=P.x-o.x,dz=P.z-o.z,d=Math.hypot(dx,dz);
 if(d<pr||o.mag){o.sp=Math.min(26,o.sp+dt*40);o.x+=dx/(d||1)*o.sp*dt;o.z+=dz/(d||1)*o.sp*dt}
 if(d<.7){gainXp(o.v);orbs.splice(i,1);sfx('pick')}}
 let i=0;for(;i<orbs.length&&i<OMAX;i++){const o=orbs[i];o.ph+=dt*3;const s=o.v>=25?1.6:o.v>=8?1.3:o.v>=3?1.1:.85;
  _m.compose(_p.set(o.x,.5+Math.sin(o.ph)*.15,o.z),_q.setFromAxisAngle(_s.set(0,1,0),o.ph),_s.set(s,s,s));oMesh.setMatrixAt(i,_m);oMesh.setColorAt(i,_c.set(ORBCOL[o.v>=25?3:o.v>=8?2:o.v>=3?1:0]))}
 for(let k=i;k<OMAX;k++){_m.makeScale(0,0,0);oMesh.setMatrixAt(k,_m)}oMesh.instanceMatrix.needsUpdate=true;if(oMesh.instanceColor)oMesh.instanceColor.needsUpdate=true;
 for(let k=items.length-1;k>=0;k--){const it=items[k];it.ph+=dt*3;it.m.position.y=.6+Math.sin(it.ph)*.15;it.m.rotation.y+=dt*2;
  if(Math.hypot(P.x-it.x,P.z-it.z)<1.1){if(it.k==='potion'){heal(P.maxHp*.3);sfx('heal');burst(P.x,1,P.z,14,0xff5a6a,4,.2,.6,0,3);addNum(P.x,2.4,P.z,'+'+Math.round(P.maxHp*.3),'#7dff8a',true)}
   else{orbs.forEach(o=>o.mag=true);sfx('learn');banner('磁石','吸取全场经验','#6fb8ff')}scene.remove(it.m);items.splice(k,1)}}}

/* ================= director ================= */
function director(dt){if(tstop>0)return;const m=gt/60,cap=isTouch?110:150;
 spawnAcc+=dt*(1.1+m*1.3)*(boss?.45:1);
 while(spawnAcc>=1){spawnAcc--;if(enemies.length>=cap)continue;
  const w=[['ghost',10],['skel',m>.6?5+m:0],['caster',m>1.3?2.5+m*.5:0],['bomber',m>2?2.5+m*.5:0],['brute',m>3.3?.8+m*.25:0]];let tot=w.reduce((a,b)=>a+b[1],0),r=Math.random()*tot;
  for(const[t,v]of w){if((r-=v)<0){spawnEnemy(t);break}}}
 if(gt>=nextElite){nextElite+=42;const ts=m>3?['skel','caster','brute']:m>1.3?['skel','caster']:['ghost','skel'];spawnEnemy(ts[(Math.random()*ts.length)|0],undefined,undefined,true)}
 if(gt>=nextHorde){nextHorde+=68;banner('怨灵潮','包围！','#b8c8ff');const n=18+Math.min(22,m*3|0);for(let i=0;i<n;i++){const a=i/n*TAU,x=clamp(P.x+Math.cos(a)*17,-A+2,A-2),z=clamp(P.z+Math.sin(a)*17,-A+2,A-2);if(!inBlock(x,z,.8))spawnEnemy(m>4&&i%3===0?'skel':'ghost',x,z)}}
 if(gt>=nextBoss&&!boss){nextBoss+=180;spawnBoss()}}

/* ================= input ================= */
const keys={};let mouseAtk=false,touchAtk=false,btnAtk=false;const joy={id:null,ox:0,oy:0,x:0,y:0};
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k))e.preventDefault();if(e.repeat)return;keys[k]=true;
 if(state==='play'){if(k==='k'||k===' '||k==='shift')dodge();const si={'1':0,'2':1,'3':2,'4':3,u:0,i:1,o:2,l:3}[k];if(si!==undefined)castSlot(si);if(k==='t'||k==='tab')openTree();if(k==='escape'||k==='p')pauseGame()}
 else if(state==='tree'&&(k==='t'||k==='tab'||k==='escape'))closeTree();else if(state==='pause'&&(k==='escape'||k==='p'))resumeGame();
 else if(state==='title'&&(k==='enter'||k===' '))startGame()});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouseAtk=touchAtk=btnAtk=false});
const jz=$('#joyZone'),jEl=$('#joy'),knob=$('#knob');
jz.addEventListener('contextmenu',e=>e.preventDefault());
jz.addEventListener('pointerdown',e=>{if(state!=='play')return;e.preventDefault();
 if(e.pointerType==='mouse'){if(e.button===2)dodge();else mouseAtk=true;return}
 if(e.clientX<innerWidth*.5&&joy.id===null){joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;joy.x=joy.y=0;jEl.style.left=e.clientX+'px';jEl.style.top=e.clientY+'px';knob.style.transform='';jEl.classList.remove('hide');$('#joyHint').classList.add('hide');try{jz.setPointerCapture(e.pointerId)}catch(_){}}
 else{touchAtk=e.pointerId}});
jz.addEventListener('pointermove',e=>{if(e.pointerId!==joy.id)return;let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const l=Math.hypot(dx,dy),R=50;if(l>R){joy.ox+=dx/l*(l-R);joy.oy+=dy/l*(l-R);jEl.style.left=joy.ox+'px';jEl.style.top=joy.oy+'px';dx=e.clientX-joy.ox;dy=e.clientY-joy.oy}
 joy.x=dx/R;joy.y=dy/R;knob.style.transform=`translate(${dx}px,${dy}px)`});
const jEnd=e=>{if(e.pointerType==='mouse'){mouseAtk=false;return}if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;jEl.classList.add('hide')}if(e.pointerId===touchAtk)touchAtk=false};
jz.addEventListener('pointerup',jEnd);jz.addEventListener('pointercancel',jEnd);
const bA=$('#btnAtk');const aOn=e=>{e.preventDefault();btnAtk=true;bA.classList.add('on');if(state==='play')startAttack()},aOff=()=>{btnAtk=false;bA.classList.remove('on')};
bA.addEventListener('pointerdown',aOn);bA.addEventListener('pointerup',aOff);bA.addEventListener('pointercancel',aOff);bA.addEventListener('pointerleave',aOff);
$('#btnDodge').addEventListener('pointerdown',e=>{e.preventDefault();dodge()});
document.querySelectorAll('.sk').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const s=+b.dataset.s;if(!P.slots[s]){openTree();return}castSlot(s)}));
function readInput(){let x=0,z=0;if(keys.w||keys.arrowup)z-=1;if(keys.s||keys.arrowdown)z+=1;if(keys.a||keys.arrowleft)x-=1;if(keys.d||keys.arrowright)x+=1;
 if(joy.id!==null){const l=Math.hypot(joy.x,joy.y);if(l>.15){x+=joy.x;z+=joy.y}}const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}
 return{x,z,atk:keys.j||mouseAtk||touchAtk!==false||btnAtk}}

/* ================= tree ui ================= */
function buildTree(){const g=$('#tGrid');
 g.innerHTML=BR.map((b,bi)=>{const ns=NODES.filter(n=>n.b===bi);
  const lines=ns.flatMap(n=>(n.req||[]).flat().map(id=>{const r=NM[id];return`<line data-a="${id}" data-b="${n.id}" x1="${(r.c+.5)*100}" y1="${(r.r+.5)*100}" x2="${(n.c+.5)*100}" y2="${(n.r+.5)*100}" stroke="#34322d" stroke-width="2" vector-effect="non-scaling-stroke"/>`})).join('');
  return`<div class="br" style="--bc:${b.c}"><h3>${b.n}</h3><div class="bx"><svg viewBox="0 0 300 500" preserveAspectRatio="none">${lines}</svg>${ns.map(n=>`<button class="nd${n.cost>1?' ult':''}${n.t==='u'?' au':''}" id="nd-${n.id}" data-id="${n.id}" style="left:${(n.c+.5)/3*100}%;top:${(n.r+.5)/5*100}%;--nc:${n.col}" aria-label="${n.n}">${n.ic}<i></i></button>`).join('')}</div></div>`}).join('');
 g.querySelectorAll('.nd').forEach(b=>b.addEventListener('click',()=>{selNode=b.dataset.id;renderTree()}))}
function renderTree(){$('#tSp').textContent='技能点 '+P.sp;
 NODES.forEach(n=>{const el=$('#nd-'+n.id),r=rk(n.id);el.className='nd'+(n.cost>1?' ult':'')+(n.t==='u'?' au':'')+(r>0?' own':canBuy(n)?' av':'')+(r>=n.max?' max':'')+(selNode===n.id?' sel':'');el.querySelector('i').textContent=r+'/'+n.max});
 document.querySelectorAll('#tGrid line').forEach(l=>{const on=rk(l.dataset.a)>0&&rk(l.dataset.b)>0,av=rk(l.dataset.a)>0;l.setAttribute('stroke',on?NM[l.dataset.b].col:av?'#6b665a':'#2a2925');l.setAttribute('stroke-width',on?3:2)});
 const n=NM[selNode];const box=$('#tInfo');if(!n){box.innerHTML='<p>点一个技能看看</p>';return}
 const r=rk(n.id),tag={p:'被动',a:'主动异能',u:'自动异能'}[n.t];
 box.style.setProperty('--nc',n.col);
 box.innerHTML=`<span class="tag">${tag}${n.cd?' · 冷却 '+(n.cd*(1-P.cdr)).toFixed(1)+' 秒':''}</span><h4 style="color:${n.col}">${n.n} <span class="mono" style="font-size:20px;color:var(--dim)">${r}/${n.max}</span></h4>`+
 (r>0?`<p>当前：${n.d(r)}</p>`:'')+(r<n.max?`<p class="nx">${r?'下一级':'效果'}：${n.d(r+1)}</p>`:'<p style="color:var(--gold)">已满级</p>')+
 (!reqMet(n)?`<p class="req">需要先学：${n.req.map(g=>g.map(id=>NM[id].n).join(' 或 ')).join('，且 ')}</p>`:'')+
 (r<n.max?`<div class="row"><button class="btn pri" id="buyB" ${canBuy(n)?'':'disabled style="opacity:.4"'}>${r?'升级':'学习'}（${n.cost} 点）</button></div>`:'')+
 (n.t==='a'&&r>0?`<p style="margin-top:4px">装备到异能槽：</p><div class="row">${[0,1,2,3].map(i=>`<button class="btn eq${P.slots[i]===n.id?' on':''}" data-eq="${i}">${i+1}${P.slots[i]&&P.slots[i]!==n.id?' '+NM[P.slots[i]].ic:''}</button>`).join('')}</div>`:'')+
 (n.t==='u'&&r>0?'<p style="color:var(--dim);font-size:13px">自动异能：学会即自动生效，不占槽位</p>':'');
 const bb=$('#buyB');if(bb)bb.onclick=()=>buy(n);
 box.querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>{const i=+b.dataset.eq,old=P.slots.indexOf(n.id);if(old>=0)P.slots[old]=P.slots[i];P.slots[i]=n.id;sfx('tick');renderTree();updSlots(true)})}
function buy(n){if(!canBuy(n))return;P.sp-=n.cost;P.ranks[n.id]=rk(n.id)+1;recalc();sfx('learn');
 if(n.t==='a'&&rk(n.id)===1){const e=P.slots.indexOf(null);if(e>=0)P.slots[e]=n.id}
 const el=$('#nd-'+n.id).getBoundingClientRect();renderTree();updSlots(true);
 if(P.sp<=0)$('#tInfo').insertAdjacentHTML('beforeend','<p style="color:var(--gold)">技能点用完了，继续战斗吧</p>')}
function openTree(){if(state!=='play')return;state='tree';lvPending=0;$('#tree').classList.remove('hide');
 if(!selNode||!canBuy(NM[selNode])){const av=NODES.find(n=>canBuy(n)&&n.t==='a')||NODES.find(canBuy);selNode=av?av.id:(selNode||'s1')}renderTree()}
function closeTree(){$('#tree').classList.add('hide');state='play';joy.id=null;joy.x=joy.y=0;jEl.classList.add('hide')}

/* ================= HUD & overlay ================= */
let hudC={};const setT=(id,v)=>{if(hudC[id]!==v){hudC[id]=v;$(id).textContent=v}};const setW=(id,v)=>{v=Math.round(v*1000)/10;if(hudC[id]!==v){hudC[id]=v;$(id).style.setProperty('--w',v+'%')}};
function updSlots(force){for(let i=0;i<4;i++){const b=$('#s'+i),id=P.slots[i];
 if(!id){if(force||hudC['sk'+i]!=='')
  {hudC['sk'+i]='';b.style.setProperty('--bc','#3a3833');b.style.setProperty('--cd',0);b.classList.remove('rdy');b.innerHTML='+<small>'+(i+1)+'</small>'}continue}
 const n=NM[id],cd=Math.max(0,P.cds[id]||0),f=cd/cdOf(id),key=id+'|'+(cd>0?Math.ceil(cd):0);
 b.style.setProperty('--cd',f.toFixed(3));if(force||hudC['sk'+i]!==key){hudC['sk'+i]=key;b.style.setProperty('--bc',n.col);b.classList.toggle('rdy',cd<=0);b.innerHTML=n.ic+(cd>0?`<em>${Math.ceil(cd)}</em>`:'')+'<small>'+(i+1)+'</small>'}}
 $('#dCd').style.setProperty('--cd',Math.max(0,P.dodgeCd/(.9*P.dodgeMul)).toFixed(3))}
function updHud(){setT('#hpT',Math.max(0,Math.ceil(P.hp))+' / '+P.maxHp);setW('#hpF',Math.max(0,P.hp/P.maxHp));
 const sh=P.shieldT>0&&P.shield>0;$('#shB').classList.toggle('hide',!sh);if(sh){setT('#shT','金钟 '+Math.ceil(P.shield));setW('#shF',Math.min(1,P.shieldT/6))}
 setW('#xpF',P.xp/need(P.lv));setT('#lvT','Lv '+P.lv);const s=gt|0;setT('#timeT',String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0'));setT('#killT','击杀 '+P.kills);
 setT('#spBadge',String(P.sp));$('#spBadge').classList.toggle('hide',P.sp<=0);$('#btnTree').classList.toggle('glow',P.sp>0);
 if(boss)setW('#bossF',Math.max(0,boss.hp/boss.maxHp));updSlots()}
let bannerT=0;function banner(a,b,c){const el=$('#banner');el.innerHTML=a+(b?`<small>${b}</small>`:'');el.style.setProperty('--bcol',c||'#ff9a3c');el.classList.add('on');clearTimeout(bannerT);bannerT=setTimeout(()=>el.classList.remove('on'),1500)}
function proj(x,y,z){_p.set(x,y,z).project(camera);return[(_p.x*.5+.5)*ov.width,(-_p.y*.5+.5)*ov.height,_p.z]}
function drawOverlay(dt){const c=octx;c.clearRect(0,0,ov.width,ov.height);if(state==='title')return;const D=DPR;
 c.textAlign='center';c.lineJoin='round';
 for(let i=nums.length-1;i>=0;i--){const n=nums[i];n.t+=dt;if(n.t>.85){nums.splice(i,1);continue}const[sx,sy,sz]=proj(n.x+n.dx,n.y+n.t*1.6,n.z);if(sz>1)continue;
  const s=(n.big?19:13)*D*(n.t<.1?1+(.1-n.t)*5:1);c.font=`${s}px VT323,monospace`;c.globalAlpha=Math.min(1,(.85-n.t)*4);c.lineWidth=3*D;c.strokeStyle='#000';c.strokeText(n.v,sx,sy);c.fillStyle=n.col;c.fillText(n.v,sx,sy)}
 c.globalAlpha=1;
 for(const e of enemies){if(e.dead||e.d.boss||!(e.elite||e.d.heavy)||e.hp>=e.maxHp)continue;const[sx,sy,sz]=proj(e.x,2.9*e.sc+.3,e.z);if(sz>1)continue;const w=40*D;c.fillStyle='rgba(0,0,0,.7)';c.fillRect(sx-w/2,sy,w,5*D);c.fillStyle=e.elite?'#f2c14e':'#e5483d';c.fillRect(sx-w/2,sy,w*Math.max(0,e.hp/e.maxHp),5*D)}
 if(boss){const[sx,sy,sz]=proj(boss.x,2,boss.z);const W=ov.width,H=ov.height,m=40*D;if(sz>1||sx<0||sx>W||sy<0||sy>H){const cx=W/2,cy=H/2;let dx=sx-cx,dy=sy-cy;if(sz>1){dx=-dx;dy=-dy}const k=Math.min((W/2-m)/Math.abs(dx||1),(H/2-m)/Math.abs(dy||1));
  const ax=cx+dx*k,ay=cy+dy*k,a=Math.atan2(dy,dx);c.save();c.translate(ax,ay);c.rotate(a);c.fillStyle='#ff4d6d';c.beginPath();c.moveTo(14*D,0);c.lineTo(-8*D,-9*D);c.lineTo(-8*D,9*D);c.fill();c.restore()}}}

/* ================= screens ================= */
function clearWorld(){enemies.forEach(e=>{if(e.tele){(e.d.boss?rectP:discP).put(e.tele);e.tele=null}putEMesh(e)});enemies.length=0;
 eshots.forEach(s=>eShotP.put(s.m));eshots.length=0;items.forEach(i=>scene.remove(i.m));items.length=0;orbs.length=0;
 clones.forEach(o=>scene.remove(o.c.g));clones.length=0;fxs.forEach(f=>f.e&&f.e());fxs.length=0;timers.length=0;nums.length=0;parts.length=0;
 while(orbitB.length)bladeP.put(orbitB.pop());if(auraM){ringP.put(auraM);auraM=null}if(shieldM){sphP.put(shieldM);shieldM=null}}
function resetGame(){clearWorld();resetPlayer();gt=0;hs=0;tScale=1;slowT=0;tstop=0;boss=null;bossN=0;nextBoss=150;nextElite=40;nextHorde=75;spawnAcc=0;lvPending=0;selNode=null;hudC={};
 $('#bossBar').classList.add('hide');camT.set(P.x,0,P.z);updSlots(true)}
function startGame(){initAudio();if(isTouch){try{const d=document.documentElement;(d.requestFullscreen||d.webkitRequestFullscreen||(()=>Promise.reject())).call(d).then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{})).catch(()=>{})}catch(e){}}
 resetGame();['#title','#over','#pause','#tree'].forEach(s=>$(s).classList.add('hide'));$('#hud').classList.remove('hide');$('#joyHint').classList.toggle('hide',!isTouch);
 state='play';MUS.int=1;banner('夜行','斩尽妖邪','#ff9a3c');
 setTimeout(()=>{if(state==='play'){openTree();$('#tInfo').insertAdjacentHTML('afterbegin','<p style="color:var(--gold)">开局有 2 个技能点：先学一个异能吧</p>')}},700)}
function pauseGame(){if(state!=='play')return;state='pause';setPauseLabels();$('#pause').classList.remove('hide')}
function resumeGame(){if(isTouch&&innerHeight>innerWidth)return;$('#pause').classList.add('hide');state='play';joy.id=null;jEl.classList.add('hide')}
function gameOver(){state='over';MUS.int=0;const s=gt|0,ts=String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 const best=store.best||{t:0,k:0};const nb=s>best.t;if(nb){store.best={t:s,k:P.kills,lv:P.lv};saveStore()}
 $('#oTitle').textContent=nb?'新纪录':'你倒下了';$('#oStats').innerHTML=`<span>存活</span><b>${ts}</b><span>击杀</span><b>${P.kills}</b><span>等级</span><b>Lv ${P.lv}</b><span>总伤害</span><b>${P.dmgDealt}</b><span>击败主教</span><b>${Math.max(0,bossN-(boss?1:0))}</b>`;
 $('#over').classList.remove('hide');$('#hud').classList.add('hide');$('#tree').classList.add('hide');showBest()}
function toTitle(){clearWorld();resetPlayer();P.x=2;P.z=-15;state='title';MUS.int=0;['#over','#pause','#tree','#hud'].forEach(s=>$(s).classList.add('hide'));$('#title').classList.remove('hide');showBest()}
function showBest(){const b=store.best;$('#best').textContent=b?`最佳：存活 ${String(b.t/60|0).padStart(2,'0')}:${String(b.t%60).padStart(2,'0')} · 击杀 ${b.k}`:''}
function setPauseLabels(){$('#pMusic').textContent='背景音乐：'+(settings.music?'开':'关');$('#pSfx').textContent='音效：'+(settings.sfx?'开':'关');$('#pAscii').textContent='字符滤镜：'+(settings.ascii?'开':'关');
 $('#pCell').textContent='字符：'+({1.8:'细',2:'中',2.4:'粗',2.7:'细',3.2:'中',4:'粗'}[settings.fine]||'中');$('#pCam').textContent='镜头：'+['近','中','远'][settings.cam];$('#pAuto').textContent='升级自动打开技能树：'+(settings.autoTree?'开':'关');$('#pQual').textContent='画质：'+(settings.q>1?'高':'流畅')}
$('#btnStart').onclick=startGame;$('#btnTree').onclick=()=>state==='tree'?closeTree():openTree();$('#btnPause').onclick=pauseGame;$('#tClose').onclick=closeTree;
$('#pResume').onclick=resumeGame;$('#pRestart').onclick=startGame;$('#pTitle').onclick=toTitle;$('#oAgain').onclick=startGame;$('#oTitleB').onclick=toTitle;
$('#pMusic').onclick=()=>{settings.music=!settings.music;if(AU.ctx)AU.music.gain.value=settings.music?.5:0;saveSettings();setPauseLabels()};
$('#pSfx').onclick=()=>{settings.sfx=!settings.sfx;if(AU.ctx)AU.sfx.gain.value=settings.sfx?.55:0;saveSettings();setPauseLabels()};
$('#pAscii').onclick=()=>{settings.ascii=!settings.ascii;saveSettings();setPauseLabels()};
$('#pCell').onclick=()=>{const o=isTouch?[1.8,2,2.4]:[2.7,3.2,4],i=o.indexOf(settings.fine);settings.fine=o[(i+1)%3];saveSettings();resize();setPauseLabels()};
$('#pCam').onclick=()=>{settings.cam=(settings.cam+1)%3;saveSettings();setPauseLabels()};
$('#pAuto').onclick=()=>{settings.autoTree=!settings.autoTree;saveSettings();setPauseLabels()};
$('#pQual').onclick=()=>{settings.q=settings.q>1?1:2;saveSettings();resize();setPauseLabels()};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame()});
function checkRotate(){const need=isTouch&&innerHeight>innerWidth;$('#rotate').classList.toggle('hide',!need);if(need)pauseGame();else if(state==='pause'&&!$('#pause').classList.contains('hide')){}}

/* ================= main loop ================= */
const camT=V3(0,0,0),CAMS=[[4,6.6],[5.4,8.8],[8.2,12.8]],camOff=V3(0,5.4,8.8);let lastT=performance.now(),fpsAcc=0,fpsN=0,hudTick=0;
function sim(rdt){let dt=0;if(slowT>0){slowT-=rdt;if(slowT<=0)tScale=1}if(hs>0){hs-=rdt}else dt=rdt*tScale;
 if(dt>0){gt+=dt;for(let i=timers.length-1;i>=0;i--){const t=timers[i];t.t-=dt;if(t.t<=0){timers.splice(i,1);t.f()}}
  if(tstop>0)tstop-=dt;updPlayer(dt,readInput());director(dt);updEnemies(dt);updShots(dt);updClones(dt);updOrbs(dt);updFx(dt)}
 poseHero(rdt*(hs>0?0:tScale));return dt}
function step(now){requestAnimationFrame(step);let rdt=Math.min(.05,(now-lastT)/1000);lastT=now;rtime+=rdt;
 let dt=0;
 if(state==='play'){dt=sim(rdt);if(++hudTick%3===0)updHud()}
 if(state==='title'){poseHero(rdt);P.moving=false}
 updParts(state==='play'?dt:state==='title'?rdt:0);
 boltLight.intensity*=Math.pow(.0005,rdt);
 postMat.uniforms.uMono.value=lerp(postMat.uniforms.uMono.value,tstop>0?1:0,Math.min(1,rdt*6));
 // camera
 if(state==='title'){const a=.35+Math.sin(rtime*.12)*.7,R=innerWidth<innerHeight*1.2?9:(isTouch?8.2:6.8),cx=Math.cos(a),sx=Math.sin(a),off=innerWidth>700?1.25:0;camera.position.set(P.x+sx*R,1.9,P.z+cx*R);camera.lookAt(P.x-cx*off,1.55,P.z+sx*off);hero.g.rotation.y=a-.45}
 else{camT.x+=(P.x-camT.x)*Math.min(1,rdt*7);camT.z+=(P.z-camT.z)*Math.min(1,rdt*7);shakeA=Math.max(0,shakeA-rdt*1.8);const s=shakeA*shakeA*1.6;
  const cz=CAMS[settings.cam]||CAMS[1];camOff.y+=(cz[0]-camOff.y)*Math.min(1,rdt*4);camOff.z+=(cz[1]-camOff.z)*Math.min(1,rdt*4);camera.position.set(camT.x+camOff.x+rand(-s,s),camOff.y+rand(-s,s),camT.z+camOff.z+rand(-s,s));camera.lookAt(camT.x,1.35,camT.z-.4)}
 if(settings.ascii){renderer.setRenderTarget(rt);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCam)}else{renderer.setRenderTarget(null);renderer.render(scene,camera)}
 drawOverlay(state==='play'?rdt:state==='tree'||state==='pause'?0:rdt);
}
addEventListener('resize',resize);resize();resetPlayer();buildTree();showBest();
P.x=2;P.z=-15;P.face=0;
document.addEventListener('pointerdown',()=>{if(!AU.ctx)initAudio()},{once:true});
window.__debug={P,enemies,get state(){return state},startGame,openTree,closeTree,NM,buy,castSlot,spawnBoss,dodge,
 setTime(v){gt=v;nextBoss=Math.max(150,Math.ceil((v-150)/180)*180+150);nextElite=v+5;nextHorde=v+20},
 advance(sec,inp){const n=Math.round(sec*60);for(let i=0;i<n&&state==='play';i++){rtime+=1/60;if(inp)Object.assign(keys,inp);sim(1/60);updParts(1/60)}updHud()},
 noTree(){settings.autoTree=false},learnAll(){P.sp+=200;for(let k=0;k<4;k++)NODES.forEach(n=>{while(canBuy(n))buy(n)});recalc()},
 stats(){return{state,t:gt|0,lv:P.lv,hp:Math.round(P.hp),kills:P.kills,enemies:enemies.length,parts:parts.length,fx:fxs.length,orbs:orbs.length,boss:!!boss}}};
requestAnimationFrame(step);
}
