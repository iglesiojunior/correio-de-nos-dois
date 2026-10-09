/* eslint-disable */
// @ts-nocheck
/**
 * Cena 3D de fundo (three.js r128) renderizada como pixel art:
 * Teresina (carnaúbas, encontro dos rios, Ponte Estaiada) ↔ a casa dela,
 * uma pedrinha por envelope na trilha e o pombo-correio sobre a pedra de hoje.
 * Puramente decorativa: carregada sob demanda; se falhar, o app segue sem ela.
 */
import * as THREE from 'three'

export type Phase = 'manha' | 'tarde' | 'entardecer' | 'noite'
export interface SceneState { total: number; today: number; opened: Set<number>; phase: Phase }
export interface SceneHandle { update(next: Partial<SceneState>): void; dispose(): void }

export function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')) } catch { return false }
}

export function mountScene(canvas: HTMLCanvasElement, initial: SceneState): SceneHandle {
  let state = initial
  const T=THREE;

  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK=0x4e2d22;
  const PHASES={
    manha:{top:'#7fbfe4',bot:'#e9f3dc',fog:0xdcecdf,sun:0xfff1c8,sunI:.62,hemiS:0xdff1ff,hemiG:0x9bbf7a,hemiI:.42,orb:0xffe08a,night:false,grass:0x7fb35a,water:0x5fb0c6},
    tarde:{top:'#6fb3e0',bot:'#d9ecdf',fog:0xd2e6e2,sun:0xffffff,sunI:.68,hemiS:0xe6f4ff,hemiG:0x94b873,hemiI:.42,orb:0xfff2b0,night:false,grass:0x79ad55,water:0x58a6bd},
    entardecer:{top:'#4f437f',bot:'#f4b98a',fog:0xe2a68e,sun:0xffb27a,sunI:.6,hemiS:0xb48ab0,hemiG:0x6f7a5a,hemiI:.4,orb:0xffa25a,night:false,grass:0x88a85f,water:0xd29a9a},
    noite:{top:'#121433',bot:'#3a3570',fog:0x2a2a55,sun:0x9fb0ff,sunI:.3,hemiS:0x4a4f8f,hemiG:0x1e2a2a,hemiI:.45,orb:0xf4ecd0,night:true,grass:0x3f6a4a,water:0x2e4f73},
  };

  // ---------- renderizador em baixa resolução ----------
  const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(1);
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(32,1,.1,200);

  // ---------- materiais em 3 tons ----------
  const grad=new T.DataTexture(new Uint8Array([110,185,240]),3,1,T.LuminanceFormat);
  grad.minFilter=grad.magFilter=T.NearestFilter;grad.generateMipmaps=false;grad.needsUpdate=true;
  const mats={};
  const toon=(c,em)=>{const k=c+'_'+(em||0);return mats[k]||(mats[k]=new T.MeshToonMaterial({color:c,gradientMap:grad,emissive:em||0}));};
  const inkMat=new T.MeshBasicMaterial({color:INK,side:T.BackSide});
  const basic=(c)=>new T.MeshBasicMaterial({color:c});

  // contorno por casca invertida, como traço de caneta
  function ink(mesh,t=.05){mesh.geometry.computeBoundingBox();const s=new T.Vector3();mesh.geometry.boundingBox.getSize(s);
    const o=new T.Mesh(mesh.geometry,inkMat);o.scale.set(1+2*t/Math.max(s.x,.05),1+2*t/Math.max(s.y,.05),1+2*t/Math.max(s.z,.05));mesh.add(o);return mesh;}
  function M(geo,c,em){return ink(new T.Mesh(geo,toon(c,em)));}

  // ---------- céu ----------
  const skyCv=document.createElement('canvas');skyCv.width=4;skyCv.height=64;const skyTex=new T.CanvasTexture(skyCv);
  skyTex.magFilter=T.NearestFilter;skyTex.minFilter=T.NearestFilter;scene.background=skyTex;
  function paintSky(P){const g=skyCv.getContext('2d'),gr=g.createLinearGradient(0,0,0,64);gr.addColorStop(0,P.top);gr.addColorStop(1,P.bot);g.fillStyle=gr;g.fillRect(0,0,4,64);skyTex.needsUpdate=true;}
  scene.fog=new T.Fog(0xdcecdf,34,80);

  const hemi=new T.HemisphereLight(0xffffff,0x88aa66,.55);scene.add(hemi);
  const sun=new T.DirectionalLight(0xffffff,1);sun.position.set(-8,14,10);scene.add(sun);

  const orb=new T.Mesh(new T.CircleGeometry(2.2,10),basic(0xffe08a));orb.position.set(14,13,-38);scene.add(orb);
  const moonBite=new T.Mesh(new T.CircleGeometry(2,10),basic(0x121433));moonBite.position.set(.9,.5,.01);orb.add(moonBite);

  const starGeo=new T.BufferGeometry();{const a=[];for(let i=0;i<240;i++)a.push((Math.random()-.5)*120,6+Math.random()*30,-40-Math.random()*10);starGeo.setAttribute('position',new T.Float32BufferAttribute(a,3));}
  const stars=new T.Points(starGeo,new T.PointsMaterial({color:0xfff4e0,size:1.3,sizeAttenuation:false}));scene.add(stars);

  // ---------- terreno ----------
  const ground=new T.Mesh(new T.PlaneGeometry(140,90,1,1),toon(0x7fb35a));ground.rotation.x=-Math.PI/2;ground.position.z=-10;scene.add(ground);
  // colinas ao fundo
  [[-18,-16,7,0x7fb069],[-6,-20,9,0x8fbf74],[8,-18,8,0x7aab64],[20,-15,6,0x86b86c],[30,-20,9,0x7fb069],[-30,-19,8,0x8fbf74]].forEach(([x,z,r,c])=>{
    const h=new T.Mesh(new T.SphereGeometry(r,10,6,0,Math.PI*2,0,Math.PI/2),toon(c));h.scale.y=.45;h.position.set(x,-.1,z);scene.add(h);});

  // fita (rio, trilha) a partir de pontos
  function ribbon(pts,w,y,c){const P=[],I=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
      let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;const nx=-dz/l*w/2,nz=dx/l*w/2;
      P.push(pts[i][0]+nx,y,pts[i][1]+nz,pts[i][0]-nx,y,pts[i][1]-nz);if(i)I.push(2*i-2,2*i-1,2*i,2*i-1,2*i+1,2*i);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
    const m=new T.Mesh(g,toon(c));m.material.side=T.DoubleSide;return m;}
  const smooth=(pts,n=60)=>{const c=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],0,p[1])));return c.getPoints(n).map(v=>[v.x,v.z]);};

  // encontro dos rios: Poti e Parnaíba
  const waters=[];
  const riverA=ribbon(smooth([[-14,-26],[-11,-14],[-8.5,-6],[-7.6,-1.5]]),1.6,.03,0x6fb8c9);
  const riverB=ribbon(smooth([[-34,-8],[-22,-5],[-13,-3],[-7.6,-1.5]]),1.9,.03,0x6fb8c9);
  const riverC=ribbon(smooth([[-7.6,-1.5],[-6.8,3],[-7.2,8],[-6,16]]),2.6,.035,0x6fb8c9);
  [riverA,riverB,riverC].forEach(r=>{r.material=toon(0x6fb8c9);waters.push(r);scene.add(r);});
  // margens de areia
  const banks=ribbon(smooth([[-7.6,-1.5],[-6.8,3],[-7.2,8],[-6,16]]),3.4,.02,0xd9c08a);scene.add(banks);
  // brilhinhos na água
  const glintGeo=new T.BufferGeometry();{const a=[];const src=[...riverC.geometry.attributes.position.array];for(let i=0;i<40;i++){const k=(Math.random()*src.length/3|0)*3;a.push(src[k]+(Math.random()-.5)*.6,.08,src[k+2]+(Math.random()-.5)*.6);}glintGeo.setAttribute('position',new T.Float32BufferAttribute(a,3));}
  const glints=new T.Points(glintGeo,new T.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false}));scene.add(glints);

  // ---------- trilha da viagem ----------
  const pathCurve=new T.CatmullRomCurve3([[-9.6,1.2],[-8.2,2.3],[-6.9,2.4],[-5.6,2.4],[-3.5,3.4],[-1,3.1],[1.5,2],[4,2.6],[6.4,3.4],[8.4,2.4],[9.6,1.4]].map(p=>new T.Vector3(p[0],0,p[1])));
  const dirt=ribbon(pathCurve.getPoints(120).map(v=>[v.x,v.z]),1.15,.015,0xd9b27c);scene.add(dirt);

  // Ponte Estaiada sobre o rio
  const bridge=new T.Group();bridge.position.set(-6.9,0,2.4);scene.add(bridge);
  const deck=M(new T.BoxGeometry(4.4,.18,1.1),0xe9e2d0);deck.position.y=.42;bridge.add(deck);
  [-1.9,1.9].forEach(x=>{const p=M(new T.BoxGeometry(.25,.42,.8),0xcfc6b2);p.position.set(x,.2,0);bridge.add(p);});
  const pylon=M(new T.BoxGeometry(.28,5.2,.32),0xf6f1e6);pylon.position.set(0,2.9,-.6);pylon.rotation.z=.06;bridge.add(pylon);
  {const a=[];for(let k=1;k<=6;k++){const top=new T.Vector3(.1,5.2-k*.28,-.6);[-1,1].forEach(s=>{a.push(top.x,top.y,top.z,s*k*.36,.5,-.1);});}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));bridge.add(new T.LineSegments(g,new T.LineBasicMaterial({color:0xfff8ea})));}

  // ---------- carnaúbas ----------
  function carnauba(x,z,h){const g=new T.Group();g.position.set(x,0,z);
    const tr=M(new T.CylinderGeometry(.09,.13,h,6),0x8a6a46);tr.position.y=h/2;g.add(tr);
    for(let i=0;i<9;i++){const leaf=M(new T.ConeGeometry(.32,1.5,4),i%2?0x5e9a4c:0x6fae58,0);const a=i/9*Math.PI*2;
      leaf.position.set(Math.cos(a)*.55,h+.1,Math.sin(a)*.55);leaf.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2);leaf.scale.z=.35;g.add(leaf);}
    scene.add(g);return g;}
  const palms=[carnauba(-12.3,-.6,3.4),carnauba(-10.9,-2.4,4.1),carnauba(-8.9,-3.9,3),carnauba(-13.5,2.6,2.7),carnauba(-5.2,-2.6,3.6)];

  // ---------- árvores redondas e flores ----------
  function tree(x,z,s,c){const g=new T.Group();g.position.set(x,0,z);const tr=M(new T.CylinderGeometry(.14*s,.18*s,1*s,6),0x8a5a3a);tr.position.y=.5*s;g.add(tr);
    const top=M(new T.IcosahedronGeometry(.95*s,0),c);top.position.y=1.5*s;g.add(top);const t2=M(new T.IcosahedronGeometry(.6*s,0),c);t2.position.set(.55*s,1.15*s,.25*s);g.add(t2);scene.add(g);return g;}
  const trees=[[3,-3,1.2,0x5e9a4c],[-1,-5.5,1.5,0x6aa653],[6.5,-4.5,1.3,0x5e9a4c],[13.5,-2.5,1.1,0x6aa653],[15.5,2,1.4,0x5e9a4c],[0,-9,1.6,0x5a9449],[-3.2,6.5,1,0x6aa653],[4.5,7,1.2,0x5e9a4c],[11,7,1,0x6aa653],[-14,7,1.3,0x5e9a4c],[18,-6,1.5,0x6aa653],[-19,-3,1.4,0x5a9449]].map(a=>tree(...a));
  {const cols=[0xff9aa2,0xfff4e0,0xf2bf4b,0xc9a0dc];const geo=new T.IcosahedronGeometry(.09,0);
   for(let i=0;i<cols.length;i++){const inst=new T.InstancedMesh(geo,toon(cols[i]),60);const m=new T.Matrix4();let k=0;
     while(k<60){const x=(Math.random()-.5)*36,z=-6+Math.random()*16;if(Math.abs(z-2.5)<1.3&&Math.abs(x)<10.5)continue;if(x<-5.5&&x>-8.8&&z>-2)continue;m.makeTranslation(x,.09,z);inst.setMatrixAt(k++,m);}
     scene.add(inst);}}

  {const geo=new T.ConeGeometry(.07,.28,3);const inst=new T.InstancedMesh(geo,toon(0x6aa653),500);const m=new T.Matrix4();
   for(let i=0;i<500;i++){const x=(Math.random()-.5)*44,z=-8+Math.random()*34;m.makeTranslation(x,.12,z);inst.setMatrixAt(i,m);}scene.add(inst);}
  [[-16,10,1.6,0x5e9a4c],[16.5,11,1.7,0x6aa653],[-18,17,2,0x5a9449],[19,18,2.1,0x5e9a4c],[-13,14,1.2,0x6aa653],[13.5,15,1.3,0x5a9449]].forEach(a=>tree(...a));
  // ---------- casinhas ----------
  const windows=[];
  function house(x,z,roof,rot){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;
    const body=M(new T.BoxGeometry(2,1.5,1.7),0xfbe6c8);body.position.y=.75;g.add(body);
    const rg=new T.CylinderGeometry(1.18,1.18,2.35,3);rg.rotateX(-Math.PI/2);rg.rotateY(Math.PI/2);
    const r=M(rg,roof);r.position.y=1.5+.59;g.add(r);
    const door=M(new T.BoxGeometry(.42,.75,.06),0xa0643a);door.position.set(-.45,.38,.86);g.add(door);
    const win=new T.Mesh(new T.BoxGeometry(.5,.42,.06),toon(0x9fd3e0));ink(win,.04);win.position.set(.45,.85,.86);g.add(win);windows.push(win);
    const ch=M(new T.BoxGeometry(.28,.6,.28),0xc9705a);ch.position.set(.55,2.25,-.2);g.add(ch);
    scene.add(g);return g;}
  const hisHouse=house(-11.2,.6,0xc9566a,.35);
  const herHouse=house(11.2,.4,0xd98a5a,-.35);
  // caixas de correio
  function mailbox(x,z,flag){const g=new T.Group();g.position.set(x,0,z);const post=M(new T.BoxGeometry(.1,.6,.1),0xa0643a);post.position.y=.3;g.add(post);
    const box=M(new T.BoxGeometry(.32,.24,.44),0xc9566a);box.position.y=.7;g.add(box);
    if(flag){const f=M(new T.BoxGeometry(.04,.22,.14),0xd9434f);f.position.set(.19,.82,.1);g.add(f);}scene.add(g);}
  mailbox(-9.6,2.2,false);mailbox(9.9,2.2,true);

  // ---------- pedrinhas: uma por envelope ----------
  const stoneGroup=new T.Group();scene.add(stoneGroup);
  const lantern=new T.Group();
  {const post=M(new T.BoxGeometry(.07,.9,.07),0x5a3f28);post.position.y=.45;lantern.add(post);
   const lamp=new T.Mesh(new T.BoxGeometry(.22,.24,.22),toon(0xffd166,0xb07a10));ink(lamp,.03);lamp.position.y=.98;lantern.add(lamp);lantern.userData.lamp=lamp;}
  scene.add(lantern);
  let todayPos=new T.Vector3();
  function layoutStones(){
    while(stoneGroup.children.length)stoneGroup.remove(stoneGroup.children[0]);
    const n=state.total,t=state.today;
    for(let i=1;i<=n;i++){const u=.07+.86*(i-1)/Math.max(1,n-1);const p=pathCurve.getPointAt(u);
      const onBridge=p.x>-9.1&&p.x<-4.7;const y=onBridge?.53:.02;
      const c=state.opened.has(i)?0xfff4e0:i===t?0xf2bf4b:0xc9b8a0;
      const s=M(new T.CylinderGeometry(.3,.34,.12,7),c,i===t?0x5a3a00:0);s.position.set(p.x,y+.05,p.z);s.rotation.y=i*1.3;stoneGroup.add(s);
      if(i===t){todayPos.set(p.x,y,p.z);lantern.position.set(p.x+.36,y,p.z-.3);}}
    if(t<1||t>n){const p=pathCurve.getPointAt(t<1?.02:.98);todayPos.set(p.x,0,p.z);lantern.position.set(p.x,0,p.z-.4);}
  }

  // ---------- pombo-correio ----------
  const bird=new T.Group();scene.add(bird);
  const bodyB=M(new T.SphereGeometry(.26,8,6),0xf3f0ea);bodyB.scale.set(1.35,.95,1);bird.add(bodyB);
  const head=M(new T.SphereGeometry(.15,8,6),0xe6e2da);head.position.set(.32,.14,0);bird.add(head);
  const beak=M(new T.ConeGeometry(.05,.14,4),0xf2bf4b);beak.rotation.z=-Math.PI/2;beak.position.set(.48,.12,0);bird.add(beak);
  const letter=M(new T.BoxGeometry(.2,.04,.14),0xfff4e0);letter.position.set(.6,.06,0);letter.rotation.z=-.2;bird.add(letter);
  const seal=new T.Mesh(new T.BoxGeometry(.06,.05,.06),toon(0xd9434f));seal.position.set(.6,.09,0);bird.add(seal);
  const wings=[1,-1].map(s=>{const w=M(new T.BoxGeometry(.38,.04,.5),0xffffff);w.geometry.translate(0,0,s*.25);w.position.set(-.02,.08,s*.12);bird.add(w);w.userData.s=s;return w;});
  const tail=M(new T.BoxGeometry(.24,.04,.2),0xdedad2);tail.position.set(-.36,.04,0);bird.add(tail);
  bird.scale.setScalar(1.1);

  // ---------- nuvens ----------
  const clouds=[];
  function cloud(x,y,z,s){const g=new T.Group();[[0,0,0,1],[.9,-.15,.1,.75],[-.85,-.2,0,.7],[.3,.35,-.1,.7]].forEach(([a,b,c,r])=>{const m=M(new T.IcosahedronGeometry(r*s,0),0xffffff);m.position.set(a*s,b*s,c*s);g.add(m);});
    g.position.set(x,y,z);g.userData.v=.15+Math.random()*.2;scene.add(g);clouds.push(g);}
  cloud(-14,9,-16,1.4);cloud(-2,11,-22,1.8);cloud(10,8.5,-14,1.2);cloud(22,10,-20,1.6);cloud(-26,10.5,-24,1.7);

  // ---------- corações saindo da chaminé dela ----------
  const heartTex=(()=>{const c=document.createElement('canvas');c.width=c.height=9;const g=c.getContext('2d');
    const m=[".OO...OO.","OLRO.ORRO","OLRRORRRO","ORRRRRRRO",".ORRRRRO.","..ORRRO..","...ORO...","....O....","........."];
    const col={O:'#4e2d22',R:'#d9434f',L:'#ff9aa2'};m.forEach((r,y)=>[...r].forEach((k,x)=>{if(col[k]){g.fillStyle=col[k];g.fillRect(x,y,1,1);}}));
    const t=new T.CanvasTexture(c);t.magFilter=t.minFilter=T.NearestFilter;return t;})();
  const hearts=[];
  function puffHeart(){const s=new T.Sprite(new T.SpriteMaterial({map:heartTex,transparent:true,depthWrite:false}));
    const base=new T.Vector3(.55,2.6,-.2).applyAxisAngle(new T.Vector3(0,1,0),-.35).add(herHouse.position);s.position.copy(base);s.scale.setScalar(.45);s.userData.t=0;scene.add(s);hearts.push(s);}

  // ---------- vaga-lumes à noite ----------
  const flyGeo=new T.BufferGeometry();const flyBase=[];{const a=[];for(let i=0;i<46;i++){const x=(Math.random()-.5)*30,y=.3+Math.random()*1.6,z=-4+Math.random()*12;a.push(x,y,z);flyBase.push([x,y,z,Math.random()*6]);}flyGeo.setAttribute('position',new T.Float32BufferAttribute(a,3));}
  const flies=new T.Points(flyGeo,new T.PointsMaterial({color:0xffe08a,size:2,sizeAttenuation:false}));scene.add(flies);

  // ---------- fase do dia ----------
  function applyPhase(name){const P=PHASES[name]||PHASES.manha;paintSky(P);scene.fog.color.set(P.fog);
    sun.color.set(P.sun);sun.intensity=P.sunI;hemi.color.set(P.hemiS);hemi.groundColor.set(P.hemiG);hemi.intensity=P.hemiI;
    ground.material=toon(P.grass);waters.forEach(w=>w.material=toon(P.water));
    orb.material.color.set(P.orb);moonBite.visible=P.night;moonBite.material.color.set(P.top);
    if(P.night)orb.position.set(-13,13,-38);else if(name==='entardecer')orb.position.set(13,4.5,-38);else orb.position.set(14,13,-38);
    stars.visible=P.night;flies.visible=P.night;
    windows.forEach(w=>w.material=P.night||name==='entardecer'?toon(0xffd166,0xc08a20):toon(0x9fd3e0));
    lantern.userData.lamp.material=P.night||name==='entardecer'?toon(0xffd166,0xd09020):toon(0xffd166,0x6a4a10);
    clouds.forEach(c=>c.children.forEach(m=>m.material=toon(P.night?0x5a5a8a:name==='entardecer'?0xf7c0a8:0xffffff)));
    draw();}

  // ---------- câmera que enquadra as duas casas em qualquer tela ----------
  const PIX=()=>innerWidth<640?2:3;
  function fit(){const w=innerWidth,h=innerHeight,px=PIX();renderer.setSize(Math.ceil(w/px),Math.ceil(h/px),false);
    camera.aspect=w/h;const vf=T.MathUtils.degToRad(camera.fov),tv=Math.tan(vf/2),hf=2*Math.atan(tv*camera.aspect);
    const narrow=w<640,portrait=h>w;
    const d=Math.max(24,13.2/Math.tan(hf/2)+3);
    // onde o horizonte e a base das casas caem na tela (fração da altura)
    const yh=narrow?.1:.1,yb=narrow?.31:portrait?.34:.40;
    const p=Math.atan((1-2*yh)*tv),ab=Math.atan((1-2*yb)*tv),camH=d*Math.tan(p-ab);
    camera.userData.base=new T.Vector3(0,camH,d+.5);
    camera.userData.dir=new T.Vector3(0,-Math.tan(p),-1);
    camera.updateProjectionMatrix();draw();}

  // ---------- laço ----------
  const clock=new T.Clock();let acc=0,t=0,heartT=0,mx=0,my=0;
  addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5;},{passive:true});
  function place(time){const b=camera.userData.base;if(!b)return;
    const sway=reduce?0:Math.sin(time*.12)*.9;camera.position.set(b.x+sway+mx*1.2,b.y-my*.3,b.z);camera.lookAt(camera.position.clone().add(camera.userData.dir));
    // pombo rodeando a pedra de hoje
    const a=time*.9,r=.75;bird.position.set(todayPos.x+Math.cos(a)*r,todayPos.y+1.7+Math.sin(time*2)*.12,todayPos.z+Math.sin(a)*r);
    bird.rotation.y=-a-Math.PI/2;wings.forEach(w=>w.rotation.x=w.userData.s*Math.sin(time*14)*.7);}
  function draw(){place(t);renderer.render(scene,camera);}
  function loopBody(){if(document.hidden)return;const dt=Math.min(.1,clock.getDelta());acc+=dt;if(acc<1/30)return;
    t+=acc;acc=0;
    clouds.forEach(c=>{c.position.x+=c.userData.v*.03;if(c.position.x>34)c.position.x=-34;});
    glints.visible=(t*2|0)%2===0;
    if(flies.visible){const a=flyGeo.attributes.position.array;flyBase.forEach((f,i)=>{a[i*3]=f[0]+Math.sin(t*.7+f[3])*.4;a[i*3+1]=f[1]+Math.sin(t*1.3+f[3])*.25;a[i*3+2]=f[2]+Math.cos(t*.5+f[3])*.4;});flyGeo.attributes.position.needsUpdate=true;}
    heartT+=1/30;if(heartT>2.6){heartT=0;puffHeart();}
    for(let i=hearts.length-1;i>=0;i--){const h=hearts[i];h.userData.t+=1/30;h.position.y+=.012;h.position.x+=Math.sin(h.userData.t*3)*.006;
      h.material.opacity=Math.max(0,1-h.userData.t/3.2);if(h.userData.t>3.2){scene.remove(h);h.material.dispose();hearts.splice(i,1);}}
    lantern.userData.lamp.scale.setScalar(1+Math.sin(t*4)*.04);
    draw();}

  // ---------- integra com o app ----------
  layoutStones();fit();applyPhase(state.phase);
  const onResize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fit,120);};
  let resizeTimer;
  addEventListener('resize',onResize);
  let raf=0;const loopRaf=()=>{raf=requestAnimationFrame(loopRaf);loopBody();};
  if(reduce){draw();}else loopRaf();
  return {
    update(next){state={...state,...next};layoutStones();applyPhase(state.phase);},
    dispose(){cancelAnimationFrame(raf);removeEventListener('resize',onResize);renderer.dispose();},
  };
}
