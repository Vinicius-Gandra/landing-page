// ===== Visualizador construtivo: máquina desenhada em escala a partir do cálculo =====
let viz={arch:'integral',view:'radial',regime:'nominal',playing:true,slow:200,
 layers:{stator:true,currents:true,coils:true,dampers:true,axes:true,flux:true,dims:true},
 t:0,last:0,raf:0,onScreen:true,sel:null,M:null,D:null,L:null,txt:0,w:0};
const VZ_PH=[0,2,1,0,2,1],VZ_SG=[1,-1,1,-1,1,-1],VZ_PN=['A','B','C'],VZ_I6=new Float64Array(6);
const vq=x=>Math.round(x*10)/10;
const vzF0=x=>fmt(x,0),vzF1=x=>fmt(x,1),vzF2=x=>fmt(x,2);
const vzWrap=a=>{a=(a+PI)%(2*PI);if(a<0)a+=2*PI;return a-PI};
const vzP=p=>vq(p[0])+' '+vq(p[1]);
function vzPath(pts,open){if(!pts.length)return '';let s='M'+vzP(pts[0]);for(let i=1;i<pts.length;i++)s+='L'+vzP(pts[i]);return open?s:s+'Z'}
function vzCircle(x,y,r){r=Math.max(.05,r);return `M${vq(x-r)} ${vq(y)}a${vq(r)} ${vq(r)} 0 1 0 ${vq(2*r)} 0a${vq(r)} ${vq(r)} 0 1 0 ${vq(-2*r)} 0Z`}
function vzHead(x,y,ux,uy,L=6.5,w=2.3){return `M${vq(x)} ${vq(y)}L${vq(x-L*ux-w*uy)} ${vq(y-L*uy+w*ux)}L${vq(x-L*ux+w*uy)} ${vq(y-L*uy-w*ux)}Z`}
let VZC=null;
function vzHex(h){h=String(h||'').trim();let m=/^#([0-9a-f]{6})$/i.exec(h);if(m)return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));m=/^#([0-9a-f]{3})$/i.exec(h);if(m)return [0,1,2].map(i=>parseInt(m[1][i]+m[1][i],16));m=/rgba?\(([^)]+)\)/.exec(h);if(m)return m[1].split(',').slice(0,3).map(Number);return [170,110,70]}
function vzColors(){const cs=getComputedStyle(document.documentElement),g=k=>vzHex(cs.getPropertyValue(k));VZC={cu:g('--copper2'),cu1:g('--copper'),i:g('--vz-in'),o:g('--vz-out')}}
function vzCurCol(v){if(!VZC)vzColors();if(!viz.layers.currents)return `rgb(${VZC.cu1.join(',')})`;const t=Math.pow(Math.min(1,Math.abs(v)),.75),a=VZC.cu,b=v>=0?VZC.i:VZC.o;return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`}

/* ---------- modelo geométrico e magnético ---------- */
function safePoles(){const P=Number(values.poles);return Number.isInteger(P)&&P>=2&&P<=60&&P%2===0?P:4}
function vizModel(){
 const r=calculated,m=r&&!r.errors.length&&r.meta&&r.meta.v&&r.meta.field&&Number.isFinite(r.meta.field.NE)&&Number.isFinite(r.meta.field.rp)?r.meta:null;
 let M;
 if(m){const v=m.v,F=m.field,P=2*m.p;
  M={ok:true,P,p:m.p,f:+v.freq,n:m.n,gen:v.type!=='motor',cosphi:+v.cosphi,sgn:v.pfMode==='under'?-1:1,S:+v.power,U:+v.voltage,
   Dse:m.dse,Ds:m.ds,Qs:m.Qs,q:m.q,y:m.ySlots,z:m.z,a:Math.max(1,parseNum(v.parallel)||1),bs:m.bs,hs:m.hs,hYoke:m.hYoke,tauS:m.tauS,tauP:m.tauP,
   Nelb:Math.max(1,+v.Nelb||1),Nelh:Math.max(1,+v.Nelh||1),ael:+v.ael,bel:+v.bel,disA:+v.disA||.33,disB:+v.disB||.44,insTurn:+v.insTurn||.2,
   delta:m.delta,deltaMax:m.deltaMax,dc:m.dc,bpe:m.bpe,bp:m.bp,hp1:m.hp1,hp2:m.hp2,rp:F.rp,dyr:m.dyr,hyr:m.hyr,shaft:+v.shaft,dph:+v.deltaph,
   lp:m.ls,lp1:+v.flange,Ndm:m.dm.N,ddm:m.dm.ddm,tr:m.dm.pitch,bp1:m.dm.bp1,bdmr:+v.bdmr,hdmr:+v.hdmr,damperMat:v.damperMat,
   NE:F.NE,aE:F.aE,bE:F.bE,hp2New:F.hp2New,IEN:F.IEN,IE0:F.IEo,UE:m.UE,
   ls:m.ls,nPk:m.nPackets,lpk:+v.packet,duct:+v.duct,lFh1:m.lFh1,lFh:m.lFh,vPer:m.vPeripheral,ringA:m.ringSel.a,ringB:m.ringSel.b,lyr:m.lyr,
   Iph:m.Iphase,Fam:m.Fam,Bd0:F.o.Bd,BdN:F.nom?F.nom.Bd:F.o.Bd,KCs:m.KCs,KCr:m.KCr,alpha:+v.alpha,thN:m.thN,Rpu:m.Rpu,Xpu:m.Xpu,fails:m.nFailures};
 }else M=vizFallback();
 return vizDerive(M);
}
function vizFallback(){
 const P=safePoles(),p=P/2,alpha=Math.min(.78,Math.max(.55,parseNum(values.alpha)||.7)),f=parseNum(values.freq)>0?parseNum(values.freq):50;
 const Ds=P<=2?620:P<=4?780:Math.min(3200,820+40*P),Dse=Ds*(P<=2?1.6:P<=4?1.5:P<=8?1.34:1.24);
 const q=P<=4?4:P<=8?3:P<=24?2:1.5,Qs=Math.round(3*P*q),tauS=PI*Ds/Qs,bs=Math.min(16,.42*tauS),hs=Math.min(4.6*bs,.48*(Dse-Ds)/2);
 const tauP=PI*Ds/P,bpe=alpha*tauP,delta=Math.max(2,Math.round(tauP*.032)/2),bp=.6*bpe;
 const ddm=Math.max(5,Math.min(16,Math.round(tauP*.05)/2)),Ndm=7,bp1=Math.max(5,.035*bpe),tr=(bpe-ddm-2*bp1)/(Ndm-1);
 const hp1=.35*(bpe-bp)+ddm,room=Ds/2-delta-hp1,hp2=Math.max(20,Math.min(.26*tauP+57,.55*room)),dyr=Ds-2*(delta+hp1+hp2);
 const hyr=Math.min(.55*bp,.45*dyr/2),shaft=Math.max(40,Math.min(.8*(dyr-2*hyr),.3*Ds));
 const dph=8.5,avail=hp2-2*dph-1,NE=Math.max(8,Math.min(60,Math.round(avail/4))),aE=Math.max(.8,(avail-(NE-1)*.4)/NE),bE=Math.max(8,Math.min(.55*(bpe-bp)/2,.1*tauP));
 const z=8,Nelh=2,Nelb=1,hcs=(hs-6.4)/2,ael=Math.max(.8,(hcs-3.2-((z/2)*Nelh-1)*.2)/((z/2)*Nelh)-.33),bel=Math.max(1,bs-3.27-.6-.44);
 const ls=.62*Ds,nPk=Math.max(2,Math.round((ls+10)/60)),lpk=(ls-(nPk-1)*10)/nPk,n=120*f/P;
 const rp=Ds/(2+8*Ds*(.5*delta)/(bpe*bpe)),Iph=100,Ns=z*Qs/6;
 return {ok:false,P,p,f,n,gen:values.type!=='motor',cosphi:.8,sgn:1,S:parseNum(values.power)||NaN,U:NaN,
  Dse,Ds,Qs,q,y:Math.max(1,Math.round(.8*Qs/P)),z,a:1,bs,hs,hYoke:(Dse-Ds)/2-hs,tauS,tauP,Nelb,Nelh,ael,bel,disA:.33,disB:.44,insTurn:.2,
  delta,deltaMax:1.5*delta,dc:delta*7/6,bpe,bp,hp1,hp2,rp,dyr,hyr,shaft,dph,lp:ls,lp1:30,Ndm,ddm,tr,bp1,bdmr:3.5,hdmr:2.5,damperMat:'brass',
  NE,aE,bE,hp2New:hp2,IEN:NaN,IE0:NaN,UE:NaN,ls,nPk,lpk,duct:10,lFh1:.28*tauP+60,lFh:NaN,vPer:PI*Ds*n/60000,ringA:6,ringB:40,lyr:ls+125,
  Iph,Fam:1.35*.92*Ns*Iph/p,Bd0:.78,BdN:.82,KCs:1.12,KCr:1.03,alpha,thN:.3,Rpu:.01,Xpu:.12,fails:0};
}
function vizDerive(M){
 const P=M.P,p=M.p,Q=M.Qs;
 M.tauS=M.tauS||PI*M.Ds/Q;M.Rb=M.Ds/2;M.Rse=M.Dse/2;M.R0=M.Rb-M.delta;M.c=M.R0-M.rp;
 M.psiE=Math.min(M.bpe/(2*M.rp),PI/2*.98);M.xe=M.rp*Math.sin(M.psiE);M.ye=M.c+M.rp*Math.cos(M.psiE);
 M.phiE=Math.atan2(M.xe,M.ye);M.gE=M.Rb-Math.hypot(M.xe,M.ye);
 M.yu=M.R0-M.hp1;M.yr=M.dyr/2;M.isE=.4;M.dpb=1.5;
 M.hcoil=M.NE*M.aE+(M.NE-1)*M.isE;M.avail=M.yu-M.yr-2*M.dph-1;M.fits=M.hcoil<=M.avail+.5;
 M.hcDraw=Math.max(.5,Math.min(M.hcoil,M.avail));M.xc1=M.bp/2+M.dpb;M.xc2=M.xc1+M.bE;M.yc1=M.yr+M.dph;M.yc2=M.yc1+M.hcDraw;
 M.yEdge=Math.min(M.yu,M.ye-Math.max(2.5,.12*M.hp1));
 const rcMax=Math.cos(PI/P)>1e-6?M.yr/Math.cos(PI/P):Infinity,want=Math.max(Math.hypot(M.yr,M.xc2+3),M.yr+.3*(M.yu-M.yr));
 M.rCap=Math.min(rcMax,want);M.capped=M.rCap<rcMax-1e-6;M.xk=Math.max(M.bp/2+.5,M.capped?Math.sqrt(Math.max(0,M.rCap*M.rCap-M.yr*M.yr)):M.yr*Math.tan(PI/P));
 M.dove={wt:.5*M.bp,wb:.68*M.bp,dh:Math.min(.38*M.hyr,.2*M.bp)};
 M.bars=[];const rr=(M.ddm+.1)/2,dcen=M.hdmr+rr;
 for(let j=0;j<M.Ndm;j++){const sj=-M.bpe/2+M.bp1+M.ddm/2+j*M.tr,ps=sj/M.rp;M.bars.push({ps,x:(M.rp-dcen)*Math.sin(ps),y:M.c+(M.rp-dcen)*Math.cos(ps),xs:M.rp*Math.sin(ps),ys:M.c+M.rp*Math.cos(ps)})}
 M.wc=Math.max(1,M.bs-.6);M.hcs=Math.max(1,(M.hs-6.4)/2);M.rTop0=M.Rb+4.5;M.rBot0=M.rTop0+M.hcs+.5;
 M.lfhr=M.vPer<30?15:95;
 const step=360*p/Q,belt=a=>Math.floor((((a+30)%360)+360)%360/60),top=new Int8Array(Q),y=Math.max(1,Math.round(M.y));
 for(let k=0;k<Q;k++)top[k]=belt(k*step+1e-6);
 M.cls=new Int8Array(2*Q);for(let k=0;k<Q;k++){M.cls[2*k]=top[k];M.cls[2*k+1]=(top[((k-y)%Q+Q)%Q]+3)%6}
 const ph=Math.acos(Math.min(1,Math.max(0,M.cosphi||.8)))*M.sgn,th=Number.isFinite(M.thN)?M.thN:.3,R=M.Rpu||0,X=M.Xpu||.1;
 M.phi=ph;M.th=th;M.rho=M.gen?-PI/2-(th+ph):PI/2+th+ph;
 const gam=M.gen?Math.atan2(X*Math.cos(ph)-R*Math.sin(ph),1+R*Math.cos(ph)+X*Math.sin(ph)):-Math.atan2(-(R*Math.sin(ph)+X*Math.cos(ph)),1-R*Math.cos(ph)+X*Math.sin(ph));
 M.betaT=M.gen?-(th-gam):th-gam;M.Im=Math.SQRT2*M.Iph;M.kc=M.z/2/M.a;
 vizMagnetics(M);return M;
}
function vizKappa(tau,b,g,KC){
 if(!(tau>b&&b>0&&g>0&&KC>1.0005))return 0;
 const lost=k=>2*(b/2-g/k*Math.log(1+k*b/(2*g))),target=tau*(1-1/KC);
 if(target>=b*.98)return 60;let lo=1e-3,hi=60;
 for(let i=0;i<50;i++){const mid=Math.sqrt(lo*hi);if(lost(mid)<target)lo=mid;else hi=mid}return Math.sqrt(lo*hi);
}
function vizCurrents(M,thm,nom,o){if(!nom){o.fill(0);return o}
 const e=M.p*thm+M.rho-PI/2,ip=[Math.cos(e),Math.cos(e-2*PI/3),Math.cos(e-4*PI/3)],k=M.kc*M.Im;
 for(let c=0;c<6;c++)o[c]=k*VZ_SG[c]*ip[VZ_PH[c]];return o}
function vizMMF(M,I6){const Fs=M.Fs,Q=M.Qs,cls=M.cls;let acc=0,sum=0;
 for(let k=0;k<Q;k++){acc+=I6[cls[2*k]]+I6[cls[2*k+1]];Fs[k]=acc;sum+=acc}
 const mean=sum/Q;for(let k=0;k<Q;k++)Fs[k]-=mean;return Fs}
function vizGapRaw(M,thm,Ff,Fs,arm,out){
 const N=M.Nh,thd=PI/2+thm,pit=2*PI/M.P,NT=M.NT,kk=NT/M.hpA,gT=M.gT,th=M.thS,dip=M.dipS,sI=M.sI;
 for(let i=0;i<N;i++){const r=th[i]-thd,j=Math.round(r/pit),pl=Math.abs(r-j*pit);
  out[i]=(((j&1)?-Ff:Ff)+(arm?Fs[sI[i]]:0))/(gT[Math.min(NT,(pl*kk)|0)]+dip[i])}
 return out}
function vizBat(M,t,thd,Ff,Fs,arm){
 const pit=2*PI/M.P,r=t-thd,j=Math.round(r/pit),pl=Math.abs(r-j*pit),NT=M.NT;
 let g=M.gTd[Math.min(NT,(pl*NT/M.hpA)|0)];
 const x=(t-PI/2)*M.Qs/(2*PI),kn=Math.round(x),u=M.bs/2-Math.abs(M.Rb*(t-PI/2-2*PI*kn/M.Qs));if(u>0)g+=M.kS*u;
 let F=(j&1)?-Ff:Ff;if(arm){const k=((Math.floor(x)%M.Qs)+M.Qs)%M.Qs;F+=Fs[k]}
 return F/g}
function vizMagnetics(M){
 const P=M.P,p=M.p,Q=M.Qs,Rb=M.Rb,hpA=PI/P,NT=1024,gT=new Float32Array(NT+2),gTd=new Float32Array(NT+2);
 const barPhi=M.bars.map(b=>Math.abs(Math.atan2(b.xs,b.ys)));
 M.kS=vizKappa(M.tauS,M.bs,M.dc||M.delta,M.KCs||1.1);M.kR=vizKappa(M.tr,M.bdmr,M.dc||M.delta,M.KCr||1.02);
 for(let i=0;i<=NT+1;i++){const a=Math.min(i,NT)/NT*hpA;let g;
  if(a<=M.phiE){const sn=Math.sin(a);g=Rb-(M.c*Math.cos(a)+Math.sqrt(Math.max(0,M.rp*M.rp-M.c*M.c*sn*sn)))}else g=M.gE+PI/2*Rb*(a-M.phiE);
  g=Math.max(.5*M.delta,g);gT[i]=g;let dip=0;
  if(a<=M.phiE)for(const b of barPhi){const u=M.bdmr/2-Math.abs(a-b)*M.R0;if(u>0)dip=Math.max(dip,M.kR*u)}
  gTd[i]=g+dip}
 Object.assign(M,{gT,gTd,NT,hpA});
 const mS=Math.max(4,Math.min(24,Math.ceil(6*M.tauS/M.bs),Math.floor(3000/Q))),Nh=Q*mS;
 const thS=new Float64Array(Nh),dipS=new Float32Array(Nh),sI=new Int32Array(Nh),cP=new Float32Array(Nh),sP=new Float32Array(Nh);
 for(let i=0;i<Nh;i++){const t=PI/2+2*PI*(i+.5)/Nh;thS[i]=t;sI[i]=Math.floor(i/mS);
  const kn=Math.round((t-PI/2)*Q/(2*PI)),u=M.bs/2-Math.abs(Rb*(t-PI/2-2*PI*kn/Q));dipS[i]=u>0?M.kS*u:0;
  cP[i]=Math.cos(p*(t-PI/2));sP[i]=Math.sin(p*(t-PI/2))}
 Object.assign(M,{Nh,mS,thS,dipS,sI,cP,sP,Bb:new Float32Array(Nh),Fs:new Float64Array(Q)});
 const fund=arr=>{let re=0,im=0,ab=0;for(let i=0;i<Nh;i++){re+=arr[i]*cP[i];im+=arr[i]*sP[i];ab+=Math.abs(arr[i])}return {ang:Math.atan2(im,re),amp:2*Math.hypot(re,im)/Nh,mean:ab/Nh}};
 vizCurrents(M,0,true,VZ_I6);const Fs=vizMMF(M,VZ_I6);let re=0,im=0;
 for(let k=0;k<Q;k++){const a=p*2*PI*(k+.5)/Q;re+=Fs[k]*Math.cos(a);im+=Fs[k]*Math.sin(a)}
 M.Fa1=2*Math.hypot(re,im)/Q;const FsN=Float64Array.from(Fs);
 const betaOf=Ff=>{vizGapRaw(M,0,Ff,FsN,true,M.Bb);const r=fund(M.Bb);return {beta:vzWrap(r.ang),r}};
 const base=Math.max(1,M.Fa1),tgt=M.betaT;let lo=Math.log(base*.02),hi=Math.log(base*80);const b0=betaOf(Math.exp(lo)).beta;
 if(Math.sign(b0)!==Math.sign(tgt))M.FfN=Math.exp(hi);else if(Math.abs(tgt)>=Math.abs(b0))M.FfN=Math.exp(lo);
 else{for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(Math.abs(betaOf(Math.exp(mid)).beta)>Math.abs(tgt))lo=mid;else hi=mid}M.FfN=Math.exp((lo+hi)/2)}
 const r1=betaOf(M.FfN);M.betaN=r1.beta;M.KnN=M.alpha*M.BdN/Math.max(1e-9,r1.r.mean);M.B1N=r1.r.amp*M.KnN;
 M.Ff0=base;vizGapRaw(M,0,M.Ff0,FsN,false,M.Bb);const r0=fund(M.Bb);M.Kn0=M.alpha*M.Bd0/Math.max(1e-9,r0.mean);M.B10=r0.amp*M.Kn0;
}

/* ---------- geometria do polo, núcleo e enrolamentos ---------- */
function vzShoeArc(M,notch,seg){
 const rp=M.rp,c=M.c,pt=a=>[rp*Math.sin(a),c+rp*Math.cos(a)],pts=[],step=Math.max(.0015,seg/rp),ev=notch?M.bars.map(b=>b.ps).sort((a,b)=>b-a):[];
 const rr=(M.ddm+.1)/2,hw=Math.min(M.bdmr/2,rr*.9),dps=hw/rp;let ps=M.psiE;pts.push(pt(ps));
 for(const pj of [...ev,null]){const stop=pj===null?-M.psiE:pj+dps;
  while(ps-step>stop+1e-9){ps-=step;pts.push(pt(ps))}
  if(pj===null){pts.push(pt(-M.psiE));break}
  const e=[Math.sin(pj),Math.cos(pj)],t=[Math.cos(pj),-Math.sin(pj)],rbc=rp-M.hdmr-rr,h0=Math.sqrt(Math.max(0,rr*rr-hw*hw));
  const Q_=(r,w)=>[r*e[0]+w*t[0],c+r*e[1]+w*t[1]];
  pts.push(Q_(rp,hw),Q_(rbc+h0,hw));const a0=Math.atan2(h0,hw),a1=-PI-a0;
  for(let k=1;k<14;k++){const a=a0+(a1-a0)*k/14;pts.push(Q_(rbc+rr*Math.sin(a),rr*Math.cos(a)))}
  pts.push(Q_(rbc+h0,-hw),Q_(rp,-hw));ps=pj-dps}
 return pts}
function vzPolePts(M,o){
 const hb=M.bp/2,yr=M.yr,yu=M.yu,xe=M.xe,ye=M.ye,yb=M.yEdge;
 const rf=Math.max(0,Math.min(.05*M.bp,5,(yu-yr)*.1)),ch=Math.max(0,Math.min(3,.3*(ye-yb)));
 const R=[[hb,yr],[hb,yu-rf]];for(let k=1;k<=4;k++){const a=PI-k*PI/8;R.push([hb+rf+rf*Math.cos(a),yu-rf+rf*Math.sin(a)])}
 if(yb<yu-.05)R.push([Math.max(hb+rf+1,Math.min(xe-2,M.xc2+4)),yu]);
 R.push([xe-ch,yb],[xe,yb+ch],[xe,ye]);
 const arc=vzShoeArc(M,o.notch,o.seg),Lf=R.slice().reverse().map(p=>[-p[0],p[1]]);
 return R.concat(arc.slice(1,-1),Lf)}
function vzPoleMap(M,cx,cy,s,i,rot=0){const a=PI/2+2*PI*i/M.P+rot,ca=Math.cos(a),sa=Math.sin(a);return (x,y)=>[cx+s*(x*sa+y*ca),cy-s*(-x*ca+y*sa)]}
function vzCoreOutline(M,cx,cy,s,kind,notchSet,seg){
 const P=M.P,yr=M.yr,xk=M.xk,{wt,wb,dh}=M.dove,pts=[];
 const cache={};const polePts=n=>cache[n]||(cache[n]=vzPolePts(M,{notch:n,seg}));
 for(let i=0;i<P;i++){const f=vzPoleMap(M,cx,cy,s,i);pts.push(f(xk,yr));
  if(kind==='core')for(const q of polePts(!!(notchSet&&notchSet.has(i))))pts.push(f(q[0],q[1]));
  else for(const q of [[wt/2,yr],[wb/2,yr-dh],[-wb/2,yr-dh],[-wt/2,yr]])pts.push(f(q[0],q[1]));
  pts.push(f(-xk,yr));
  if(M.capped){const a0=PI/2+2*PI*i/P+Math.atan2(xk,yr),a1=PI/2+2*PI*(i+1)/P-Math.atan2(xk,yr),n=Math.max(2,Math.ceil((a1-a0)*M.rCap*s/4));
   for(let j=1;j<n;j++){const a=a0+(a1-a0)*j/n;pts.push([cx+s*M.rCap*Math.cos(a),cy-s*M.rCap*Math.sin(a)])}}}
 return vzPath(pts)}
function vzMountedPole(M,f,notch,seg){const {wt,wb,dh}=M.dove,yr=M.yr;
 return vzPath(vzPolePts(M,{notch,seg}).concat([[-wt/2,yr],[-wb/2,yr-dh],[wb/2,yr-dh],[wt/2,yr]]).map(q=>f(q[0],q[1])))}
function vzRect(f,x0,y0,x1,y1){return vzPath([f(x0,y0),f(x1,y0),f(x1,y1),f(x0,y1)])}
function vzCoils(M,f,i,o){ // bobina de campo de um polo: blocos, quadros, isolação e símbolos de corrente
 const hb=M.bp/2,out={cu:'',ins:'',bad:'',ring:'',dot:'',cro:'',turns:''};
 for(const sg of [1,-1]){const X=x=>sg*x,b=(x0,y0,x1,y1)=>vzRect(f,X(x0),y0,X(x1),y1);
  out.cu+=b(M.xc1,M.yc1,M.xc2,M.yc2);
  out.ins+=b(hb,M.yr,M.xc2+1,M.yr+M.dph)+b(hb,M.yu-M.dph,M.xc2+1,M.yu)+b(hb,M.yr+M.dph,M.xc1,M.yu-M.dph);
  if(!M.fits)out.bad+=b(M.xc1,M.yc1,M.xc2,M.yc1+M.hcoil);
  if(o.turns){const pitch=M.aE+M.isE,step=Math.max(1,Math.ceil(1.7/(pitch*o.s)));
   for(let k=step;k<M.NE;k+=step){const yy=M.yc1+k*pitch-M.isE/2;if(yy>=M.yc2)break;const a=f(X(M.xc1),yy),c=f(X(M.xc2),yy);out.turns+=`M${vzP(a)}L${vzP(c)}`}}
  const r=.3*Math.min(M.bE,M.hcDraw)*o.s;
  if(r>=1.6){const c=f(X(M.xc1+M.bE/2),M.yc1+M.hcDraw/2);out.ring+=vzCircle(c[0],c[1],r);const into=(i%2===0)===(sg>0);
   if(into){const d=r*.62;out.cro+=`M${vq(c[0]-d)} ${vq(c[1]-d)}L${vq(c[0]+d)} ${vq(c[1]+d)}M${vq(c[0]-d)} ${vq(c[1]+d)}L${vq(c[0]+d)} ${vq(c[1]-d)}`}else out.dot+=vzCircle(c[0],c[1],r*.32)}}
 return out}
function vzSlotMap(cx,cy,s,k,Q,extra=0){const a=PI/2+2*PI*k/Q+extra,ca=Math.cos(a),sa=Math.sin(a);return (w,u)=>[cx+s*(w*ca-u*sa),cy-s*(w*sa+u*ca)]}

/* ---------- folha, carimbo, cotas ---------- */
function vzSize(){const w=($('mwrap')&&$('mwrap').clientWidth)||900,W=Math.round(Math.max(320,Math.min(1240,w))),wide=W>=700;return {W,H:Math.round(wide?W*.66:W*1.62),wide}}
function vzTB(L){const w=L.wide?Math.round(Math.min(380,Math.max(268,L.W*.32))):L.W-40,h=L.wide?78:72;return {w,h,x:L.W-20-w,y:L.H-20-h}}
function vzDefs(D){
 let s=`<defs><pattern id="vz-hs" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="vz-pst"/><path d="M0 0V6" class="vz-phs"/></pattern>`;
 s+=`<pattern id="vz-hr" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="5" height="5" class="vz-pfe"/><path d="M0 0V5" class="vz-phr"/></pattern>`;
 s+=`<pattern id="vz-hm" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="7" height="7" class="vz-prm"/><path d="M0 0V7M3.5 0V7" class="vz-phr"/></pattern>`;
 s+=`<pattern id="vz-hsp" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="vz-psp"/><path d="M0 0V8M0 0H8" class="vz-phs"/></pattern>`;
 s+=`<pattern id="vz-hn" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V4" class="vz-phn"/></pattern>`;
 if(D.grad){const g=(id,y0,y1,c0,c1,hi)=>`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${vq(y0)}" x2="0" y2="${vq(y1)}"><stop offset="0" style="stop-color:var(${c0})"/><stop offset=".3" style="stop-color:var(${c1})"/><stop offset=".42" style="stop-color:var(${hi})"/><stop offset=".58" style="stop-color:var(${c1})"/><stop offset="1" style="stop-color:var(${c0})"/></linearGradient>`;
  for(const [id,y0,y1,c0,c1,hi] of D.grad)s+=g(id,y0,y1,c0,c1,hi)}
 if(D.clip)s+=D.clip;
 return s+'</defs>'}
function vzSheet(L){
 const {W,H}=L;let s=`<rect class="vz-paper" width="${W}" height="${H}"/><rect class="vz-fr0" x="6.5" y="6.5" width="${W-13}" height="${H-13}"/><rect class="vz-fr1" x="20" y="20" width="${W-40}" height="${H-40}"/>`;
 const nc=Math.max(4,Math.round((W-40)/130)),nr=Math.max(3,Math.round((H-40)/130));let z='';
 for(let i=1;i<nc;i++){const x=vq(20+(W-40)*i/nc);z+=`M${x} 6.5V20M${x} ${H-20}V${H-6.5}`}
 for(let i=1;i<nr;i++){const y=vq(20+(H-40)*i/nr);z+=`M6.5 ${y}H20M${W-20} ${y}H${W-6.5}`}
 s+=`<path class="vz-fr0" d="${z}"/><path class="vz-fr1" d="M${W/2} 6.5V27M${W/2} ${H-6.5}V${H-27}M6.5 ${H/2}H27M${W-6.5} ${H/2}H${W-27}"/>`;
 for(let i=0;i<nc;i++){const x=vq(20+(W-40)*(i+.5)/nc);s+=`<text class="vz-z" x="${x}" y="16" text-anchor="middle">${i+1}</text><text class="vz-z" x="${x}" y="${H-10}" text-anchor="middle">${i+1}</text>`}
 for(let i=0;i<nr;i++){const y=vq(20+(H-40)*(i+.5)/nr+3),c=String.fromCharCode(65+i);s+=`<text class="vz-z" x="13.3" y="${y}" text-anchor="middle">${c}</text><text class="vz-z" x="${W-13.3}" y="${y}" text-anchor="middle">${c}</text>`}
 return s}
function vzScaleBar(x,y,s,maxW){
 const C=[5,10,20,25,50,100,200,250,500,1000,2000];let best=C[0];for(const c of C)if(c*s<=maxW)best=c;
 const w=best*s,seg=w/4;let r='';for(let i=0;i<4;i++)r+=`<rect x="${vq(x+i*seg)}" y="${y}" width="${vq(seg)}" height="4" class="${i%2?'vz-sbo':'vz-sbf'}"/>`;
 return r+`<text class="vz-z" x="${vq(x)}" y="${y+13}">0</text><text class="vz-z" x="${vq(x+w)}" y="${y+13}" text-anchor="end">${fmt(best,0)} mm</text>`}
function vzTitle(L,M,o){
 const T=vzTB(L),{x,y,w,h}=T,r=h/4,spec=M.ok?`${vzF0(M.S)} ${M.gen?'kVA':'kW'} · ${fmt(M.U,1)} kV · ${vzF0(M.f)} Hz · ${M.P} polos · ${vzF0(M.n)} rpm`:`${M.P} polos · ${vzF0(M.f)} Hz · ${vzF0(M.n)} rpm`;
 let s=`<g class="vz-tb"><rect x="${x}" y="${y}" width="${w}" height="${h}" class="vz-tbbox"/><path class="vz-tbl" d="M${x} ${vq(y+r)}H${x+w}M${x} ${vq(y+2*r)}H${x+w}M${x} ${vq(y+3*r)}H${x+w}M${x+w-56} ${vq(y+r)}V${vq(y+2*r)}"/>`;
 s+=`<text class="vz-h" x="${x+8}" y="${vq(y+r-6)}">Máquina síncrona de polos salientes</text>`;
 s+=`<text class="vz-t" x="${x+8}" y="${vq(y+2*r-6)}">${o.title}</text><text class="vz-s" x="${x+w-28}" y="${vq(y+2*r-6)}" text-anchor="middle">Folha ${o.sheet}/3</text>`;
 s+=`<text class="vz-s" x="${x+8}" y="${vq(y+3*r-6)}">${spec}</text>`;
 s+=vzScaleBar(x+8,vq(y+3*r+4),o.s,Math.min(130,w*.42));
 s+=`<text class="vz-s" x="${x+w-8}" y="${vq(y+4*r-6)}" text-anchor="end">${M.ok?'Cotas em mm · cálculo KhPI 2024':'Proporções ilustrativas'}</text></g>`;
 return s}
function vzDim(x1,y1,x2,y2,off,txt,o={}){
 const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux,sg=off>=0?1:-1;
 const a1=[x1+nx*off,y1+ny*off],a2=[x2+nx*off,y2+ny*off];let s='';
 if(Math.abs(off)>2)s+=`<path class="vz-dle" d="M${vq(x1+nx*sg*2)} ${vq(y1+ny*sg*2)}L${vq(a1[0]+nx*sg*3)} ${vq(a1[1]+ny*sg*3)}${o.one?'':`M${vq(x2+nx*sg*2)} ${vq(y2+ny*sg*2)}L${vq(a2[0]+nx*sg*3)} ${vq(a2[1]+ny*sg*3)}`}"/>`;
 if(o.one&&Math.abs(off)>2)s=`<path class="vz-dle" d="M${vq(x2+nx*sg*2)} ${vq(y2+ny*sg*2)}L${vq(a2[0]+nx*sg*3)} ${vq(a2[1]+ny*sg*3)}"/>`;
 const b1=o.one?[a1[0]-ux*6,a1[1]-uy*6]:a1;
 s+=`<path class="vz-dl" d="M${vq(b1[0])} ${vq(b1[1])}L${vq(a2[0])} ${vq(a2[1])}"/><path class="vz-ah" d="${vzHead(a2[0],a2[1],ux,uy)}${o.one?'':vzHead(a1[0],a1[1],-ux,-uy)}"/>`;
 let ang=Math.atan2(dy,dx)*180/PI;if(ang>90.5)ang-=180;if(ang<-89.5)ang+=180;const ra=ang*PI/180,up=[Math.sin(ra),-Math.cos(ra)];
 const mx=(a1[0]+a2[0])/2+(o.tx||0)*ux,my=(a1[1]+a2[1])/2+(o.tx||0)*uy,tx=mx+up[0]*4,ty=my+up[1]*4;
 return s+`<text class="vz-dim" x="${vq(tx)}" y="${vq(ty)}" text-anchor="middle" transform="rotate(${vq(ang)} ${vq(tx)} ${vq(ty)})">${txt}</text>`}
function vzLeader(pts,txt,anchor='start',cls='vz-dim'){const e=pts[pts.length-1];
 return `<path class="vz-ld" d="${vzPath(pts,true)}"/><circle cx="${vq(pts[0][0])}" cy="${vq(pts[0][1])}" r="1.6" class="vz-ldd"/><text class="${cls}" x="${vq(e[0]+(anchor==='start'?3:anchor==='end'?-3:0))}" y="${vq(e[1]-3)}" text-anchor="${anchor}">${txt}</text>`}
function vzArcDim(cx,cy,r,a1,a2,txt,o={}){ // ângulos matemáticos (rad), a1<a2
 const n=Math.max(6,Math.ceil(Math.abs(a2-a1)*r/5)),pts=[];for(let i=0;i<=n;i++){const a=a1+(a2-a1)*i/n;pts.push([cx+r*Math.cos(a),cy-r*Math.sin(a)])}
 const t1=[-Math.sin(a1),-Math.cos(a1)],t2=[Math.sin(a2),Math.cos(a2)];
 let s=`<path class="vz-dl" d="${vzPath(pts,true)}"/><path class="vz-ah" d="${o.one?'':vzHead(pts[0][0],pts[0][1],-t1[0]*-1*-1,-t1[1])}${vzHead(pts[n][0],pts[n][1],t2[0]*-1*-1,t2[1])}"/>`;
 const am=(a1+a2)/2,tr=r+(o.inside?-6:6),tx=cx+tr*Math.cos(am),ty=cy-tr*Math.sin(am);let rot=90-am*180/PI;if(rot>90)rot-=180;if(rot<-90)rot+=180;
 return s+`<text class="vz-dim" x="${vq(tx)}" y="${vq(ty)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${vq(rot)} ${vq(tx)} ${vq(ty)})">${txt}</text>`}
function vzBalloon(x,y,n,tx,ty,id){
 return `<path class="vz-ld" d="M${vq(x)} ${vq(y)}L${vq(tx)} ${vq(ty)}"/><circle cx="${vq(tx)}" cy="${vq(ty)}" r="1.5" class="vz-ldd"/><g${id?` id="${id}"`:''}><circle cx="${vq(x)}" cy="${vq(y)}" r="7.5" class="vz-bal"/><text class="vz-bn" x="${vq(x)}" y="${vq(y+3.3)}" text-anchor="middle">${n}</text></g>`}
function vzBreak(pts,amp=3,step=12){ // linha de ruptura em zigue-zague ao longo de uma poligonal
 let out=[],acc=0,k=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!L)continue;const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L;
  for(let d=i===1?0:step-acc;d<L;d+=step){const sgn=(k++%2?1:-1)*amp;out.push([a[0]+ux*d-uy*sgn,a[1]+uy*d+ux*sgn])}acc=(acc+L)%step}
 out.push(pts[pts.length-1]);return `<path class="vz-bk" d="${vzPath(out,true)}"/>`}

/* ---------- vista 1: corte transversal ---------- */
function vzPartRows(M){const ill=M.ok?'':'≈ ';return [
 [1,'Núcleo do estator',`${ill}Ø${vzF0(M.Dse)} / Ø${vzF0(M.Ds)}`,'stator'],
 [2,'Enrolamento da armadura',`${M.Qs} ranh. · y ${M.y} · z ${M.z}`,'winding'],
 [3,'Entreferro (detalhe A)',`δ ${vzF1(M.delta)} → ${vzF1(M.deltaMax)}`,'gap'],
 [4,'Polo saliente',`bpe ${vzF0(M.bpe)} · bp ${vzF0(M.bp)}`,'pole'],
 [5,'Bobina de campo',`${M.NE} esp. · ${vzF1(M.aE)} × ${vzF0(M.bE)}`,'coil'],
 [6,'Gaiola amortecedora',`${M.Ndm} × Ø${vzF1(M.ddm)} · τr ${vzF1(M.tr)}`,'damper'],
 [7,viz.arch==='integral'?'Jugo do rotor':'Coroa do rotor',`Ø${vzF0(M.dyr)} · hyr ${vzF0(M.hyr)}`,'yoke'],
 [8,'Eixo',`Ø${vzF0(M.shaft)}`,'shaft']].concat(viz.arch==='mounted'?[[9,'Aranha','ilustrativa','spider']]:[])}
function vzPartsList(x,y,w,rows){
 let s=`<g class="vz-plist"><text class="vz-t" x="${x}" y="${y-7}">Lista de peças</text><path class="vz-tbl" d="M${x} ${y}H${x+w}"/>`;const rh=15;
 rows.forEach((r,i)=>{const yy=y+i*rh;s+=`<g class="vz-prow vz-part" data-part="${r[3]}" tabindex="0" role="button" aria-label="${esc(r[1])}"><rect x="${x}" y="${yy}" width="${w}" height="${rh}" class="vz-prbg"/><circle cx="${x+8}" cy="${yy+rh/2}" r="6" class="vz-bal"/><text class="vz-bn" x="${x+8}" y="${yy+rh/2+3.2}" text-anchor="middle">${r[0]}</text><text class="vz-t" x="${x+20}" y="${yy+rh/2+3.8}">${esc(r[1])}</text><text class="vz-n" x="${x+w-3}" y="${yy+rh/2+3.6}" text-anchor="end">${esc(r[2])}</text></g>`});
 return s+`<path class="vz-tbl" d="M${x} ${y+rows.length*rh}H${x+w}"/></g>`}
function vzRadial(M,L){
 const {W,H,wide}=L,T=vzTB(L),P=M.P,Q=M.Qs;let cx,cy,Rt;
 if(wide){const x0=30,x1=T.x-18;Rt=Math.min((x1-x0)/2,(H-58)/2);cx=(x0+x1)/2;cy=H/2}else{Rt=W/2-26;cx=W/2;cy=28+Rt}
 const band=Math.max(26,Math.min(50,Rt*.16)),Rs=Rt-band,s=Rs/M.Rse,S=(x,y)=>[cx+s*x,cy-s*y];
 const D={view:'radial',cx,cy,s,Rh0:Rs+8,kB:Math.min(36,(band-12)/1.12),ups:[],hl:[]};
 // lupa (detalhe A)
 const rows=vzPartRows(M),rowsH=rows.length*15;let RL,Lc,phiA;
 if(wide){RL=Math.max(56,Math.min(118,T.w/2-8,(T.y-12-rowsH-30-50)/2));Lc=[T.x+T.w/2,50+RL]}
 else{const top=cy+Rt+8,bot=T.y-10;RL=Math.max(40,Math.min(.22*W,(bot-top)/2-6));Lc=[24+RL+4,top+(bot-top)/2]}
 phiA=Math.max(.17,Math.min(1.05,Math.atan2(cy-Lc[1],Lc[0]-cx)));if(!wide)phiA=-.62;
 const Z=Math.max(3,Math.min(10,18/(s*M.delta))),rS=RL/Z,Sx=cx+s*M.Rb*Math.cos(phiA),Sy=cy-s*M.Rb*Math.sin(phiA);
 D.loupe={RL,Lc,Z,phiA};
 let o=`<title id="machine-title">${P} polos · corte transversal em escala</title><desc id="machine-desc">Estator, enrolamento, entreferro, polos, bobinas de campo, amortecedor e eixo desenhados com as dimensões do cálculo. O rotor gira continuamente; as correntes da armadura e a onda de indução acompanham o mesmo relógio.</desc>`;
 o+=vzDefs({clip:`<clipPath id="vz-lclip"><circle cx="${vq(Lc[0])}" cy="${vq(Lc[1])}" r="${vq(RL)}"/></clipPath>`})+vzSheet(L);
 // onda de B (gráfico polar)
 o+=`<g class="vz-part" data-part="flux" data-layer="flux"><circle cx="${vq(cx)}" cy="${vq(cy)}" r="${vq(D.Rh0)}" class="vz-h0"/><path id="vz-hn" class="vz-hneg"/><path id="vz-hp" class="vz-hpos"/>`;
 if(P<=16)for(let j=0;j<P;j++)o+=`<text class="vz-hl" id="vz-hl${j}" text-anchor="middle">${j%2?'S':'N'}</text>`;
 o+='</g><g id="vz-mach">';
 // estator
 const Rb=M.Rb,bs=M.bs,wb=Math.sqrt(Math.max(0,Rb*Rb-bs*bs/4)),wt=Rb+M.hs;let inner='',first=null;
 for(let k=0;k<Q;k++){const f=vzSlotMap(cx,cy,s,k,Q),B1=f(wb,-bs/2),C1=f(wt,-bs/2),C2=f(wt,bs/2),B2=f(wb,bs/2);
  inner+=(k?`A${vq(s*Rb)} ${vq(s*Rb)} 0 0 0 ${vzP(B1)}`:`M${vzP(B1)}`)+`L${vzP(C1)}L${vzP(C2)}L${vzP(B2)}`;if(!k)first=B1}
 inner+=`A${vq(s*Rb)} ${vq(s*Rb)} 0 0 0 ${vzP(first)}Z`;
 o+=`<g class="vz-part" data-part="stator" data-layer="stator"><path class="vz-st" fill-rule="evenodd" d="${vzCircle(cx,cy,s*M.Rse)}${inner}"/></g>`;
 const cp=['','','','','',''],dt=['','','','','',''],cr=['','','','','',''];let wedge='',ring='';const sym=s*Math.min(M.wc,M.hcs)>=4.2,rr=.3*Math.min(M.wc,M.hcs)*s;
 for(let k=0;k<Q;k++){const f=vzSlotMap(cx,cy,s,k,Q);wedge+=vzPath([f(Rb+.5,-bs/2),f(Rb+4,-bs/2),f(Rb+4,bs/2),f(Rb+.5,bs/2)]);
  for(let l=0;l<2;l++){const r0=l?M.rBot0:M.rTop0,c=M.cls[2*k+l];cp[c]+=vzPath([f(r0,-M.wc/2),f(r0+M.hcs,-M.wc/2),f(r0+M.hcs,M.wc/2),f(r0,M.wc/2)]);
   if(sym){const m=f(r0+M.hcs/2,0),d=rr*.6;ring+=vzCircle(m[0],m[1],rr);dt[c]+=vzCircle(m[0],m[1],rr*.32);cr[c]+=`M${vq(m[0]-d)} ${vq(m[1]-d)}L${vq(m[0]+d)} ${vq(m[1]+d)}M${vq(m[0]-d)} ${vq(m[1]+d)}L${vq(m[0]+d)} ${vq(m[1]-d)}`}}}
 o+=`<g class="vz-part" data-part="winding" data-layer="stator"><path class="vz-wedge" d="${wedge}"/>${cp.map((d,c)=>`<path id="vz-c${c}" class="vz-cs" d="${d}"/>`).join('')}`;
 if(sym)o+=`<g data-layer="currents"><path class="vz-sym" d="${ring}"/>${dt.map((d,c)=>`<path id="vz-d${c}" class="vz-symf" d="${d}"/>`).join('')}${cr.map((d,c)=>`<path id="vz-x${c}" class="vz-sym" d="${d}"/>`).join('')}</g>`;
 o+='</g>';
 // rotor
 o+=`<g id="vz-rot">`+vzRotorRadial(M,D,cx,cy,s)+'</g></g>';
 // anotações fixas
 const lab=(a,r)=>[cx+r*Math.cos(a),cy-r*Math.sin(a)];
 let an=`<g class="vz-ann">`;
 an+=`<path class="vz-sec" d="M${vq(cx)} ${vq(cy-Rs-12)}V${vq(cy+Rs+12)}"/><path class="vz-sec-end" d="M${vq(cx)} ${vq(cy-Rs-22)}V${vq(cy-Rs-10)}M${vq(cx)} ${vq(cy+Rs+10)}V${vq(cy+Rs+22)}"/><path class="vz-ah" d="${vzHead(cx+13,cy-Rs-22,1,0)}${vzHead(cx+13,cy+Rs+22,1,0)}"/><path class="vz-ld" d="M${vq(cx)} ${vq(cy-Rs-22)}H${vq(cx+8)}M${vq(cx)} ${vq(cy+Rs+22)}H${vq(cx+8)}"/><text class="vz-t" x="${vq(cx+17)}" y="${vq(cy-Rs-18)}">B</text><text class="vz-t" x="${vq(cx+17)}" y="${vq(cy+Rs+26)}">B</text>`;
 if(wide||W>=420){const a1=PI*1.13,t1=lab(a1,s*(Rb+M.hs+M.hYoke*.55)),b1=lab(a1,Rt+12);an+=`<g class="vz-part" data-part="stator">${vzBalloon(b1[0],b1[1],1,t1[0],t1[1])}</g>`;
  const k2=Math.round(((PI*1.24-PI/2)/(2*PI))*Q),f2=vzSlotMap(cx,cy,s,k2,Q),t2=f2(M.rBot0+M.hcs/2,0),a2=Math.atan2(cy-t2[1],t2[0]-cx),b2=lab(a2,Rt+12);an+=`<g class="vz-part" data-part="winding">${vzBalloon(b2[0],b2[1],2,t2[0],t2[1])}</g>`;
  const t8=lab(PI*1.78,s*M.shaft/2),b8=lab(PI*1.78,s*M.shaft/2+Math.max(26,.22*Rs));an+=`<g class="vz-part" data-part="shaft">${vzBalloon(b8[0],b8[1],8,t8[0],t8[1])}</g>`}
 an+=`<g data-layer="dims">`;
 {const a=PI*.86,p1=lab(a,s*M.Rse),p2=lab(a,Rt+4),p3=[p2[0]-24,p2[1]];an+=vzLeader([p1,p2,p3],`Ø${vzF0(M.Dse)}`,'end');
  const b=PI*.8,q1=lab(b,s*M.Rb),q2=lab(b,Rt-2),q3=[Math.min(q2[0],p3[0]+6)-30,q2[1]];an+=vzLeader([q1,q2,q3],`Ø${vzF0(M.Ds)}`,'end')}
 an+='</g>';
 // lupa
 const dx=Lc[0]-Sx,dy=Lc[1]-Sy,dd=Math.hypot(dx,dy),ux=dx/dd,uy=dy/dd;let tang='';
 if(dd>RL+rS+4){const ca=(rS-RL)/dd,sa=Math.sqrt(Math.max(0,1-ca*ca));for(const sg of [1,-1]){const nx=ux*ca-sg*uy*sa,ny=uy*ca+sg*ux*sa;tang+=`M${vq(Sx+rS*nx)} ${vq(Sy+rS*ny)}L${vq(Lc[0]+RL*nx)} ${vq(Lc[1]+RL*ny)}`}}
 an+=`<g class="vz-part" data-part="gap"><path class="vz-tan" d="${tang}"/><circle cx="${vq(Sx)}" cy="${vq(Sy)}" r="${vq(rS)}" class="vz-src"/><text class="vz-t" x="${vq(Sx+rS*.75+4)}" y="${vq(Sy-rS*.75-3)}">A</text></g>`;
 an+=`<g class="vz-part" data-part="gap"><circle cx="${vq(Lc[0])}" cy="${vq(Lc[1])}" r="${vq(RL)}" class="vz-paper"/><g clip-path="url(#vz-lclip)"><use href="#vz-mach" transform="translate(${vq(Lc[0])} ${vq(Lc[1])}) scale(${vq(Z*10)/10}) translate(${vq(-Sx)} ${vq(-Sy)})"/></g><circle cx="${vq(Lc[0])}" cy="${vq(Lc[1])}" r="${vq(RL)}" class="vz-lring"/></g>`;
 an+=`<text class="vz-t" x="${vq(Lc[0]-RL)}" y="${vq(Lc[1]-RL-8)}">Detalhe A · ${fmt(Z,1)}:1</text><text class="vz-n" id="vz-gapA" x="${vq(Lc[0]+RL)}" y="${vq(Lc[1]+RL+14)}" text-anchor="end"></text>`;
 if(wide)an+=vzPartsList(T.x,Lc[1]+RL+42,T.w,rows);
 an+='</g>';
 o+=an+vzTitle(L,M,{title:'Corte A–A · seção transversal',sheet:1,s});
 return {svg:o,D};
}
function vzRotorRadial(M,D,cx,cy,s){
 const P=M.P,seg=3/s;let o='';
 if(viz.arch==='integral')o+=`<g class="vz-part" data-part="pole"><path class="vz-fe" fill-rule="evenodd" d="${vzCoreOutline(M,cx,cy,s,'core',null,seg)}${vzCircle(cx,cy,s*M.shaft/2)}"/></g>`;
 else{const rin=M.yr-M.hyr,rh=Math.min(rin-8,M.shaft/2*1.6),na=P<=4?4:P<=12?6:8;let arms='';
  for(let i=0;i<na;i++){const a=PI/2+PI/P+2*PI*i/na,w1=Math.min(.7*rh,.35*rin),w2=w1*.7,f=(r,u)=>[cx+s*(r*Math.cos(a)-u*Math.sin(a)),cy-s*(r*Math.sin(a)+u*Math.cos(a))];arms+=vzPath([f(rh-3,-w1/2),f(rin+3,-w2/2),f(rin+3,w2/2),f(rh-3,w1/2)])}
  o+=`<g class="vz-part" data-part="spider"><path class="vz-sp" d="${arms}"/><path class="vz-sp" fill-rule="evenodd" d="${vzCircle(cx,cy,s*rh)}${vzCircle(cx,cy,s*M.shaft/2)}"/></g>`;
  o+=`<g class="vz-part" data-part="yoke"><path class="vz-rim" fill-rule="evenodd" d="${vzCoreOutline(M,cx,cy,s,'rim')}${vzCircle(cx,cy,s*rin)}"/></g>`;
  let poles='';for(let i=0;i<P;i++)poles+=vzMountedPole(M,vzPoleMap(M,cx,cy,s,i),false,seg);o+=`<g class="vz-part" data-part="pole"><path class="vz-fe" d="${poles}"/></g>`}
 const C={cu:'',ins:'',bad:'',ring:'',dot:'',cro:''};
 for(let i=0;i<P;i++){const c=vzCoils(M,vzPoleMap(M,cx,cy,s,i),i,{s,turns:false});for(const k in C)C[k]+=c[k]}
 o+=`<g class="vz-part" data-part="coil" data-layer="coils"><path class="vz-ins" d="${C.ins}"/><path class="vz-cu" d="${C.cu}"/>${C.bad?`<path class="vz-bad" d="${C.bad}"/>`:''}<path class="vz-sym2" d="${C.ring}${C.cro}"/><path class="vz-symf2" d="${C.dot}"/></g>`;
 let bars='';const rb=Math.max(.6,s*M.ddm/2);for(let i=0;i<P;i++){const f=vzPoleMap(M,cx,cy,s,i);for(const b of M.bars){const c=f(b.x,b.y);bars+=vzCircle(c[0],c[1],rb)}}
 o+=`<g class="vz-part" data-part="damper" data-layer="dampers"><path class="vz-br" d="${bars}"/></g>`;
 if(P<=30){const fs=Math.min(14,.32*M.bp*s);if(fs>=6.5){let t='';for(let i=0;i<P;i++){const c=vzPoleMap(M,cx,cy,s,i)(0,(M.yu+M.yr)/2);t+=`<text x="${vq(c[0])}" y="${vq(c[1]+fs*.36)}" text-anchor="middle" class="vz-pl" style="font-size:${vq(fs)}px">${i%2?'S':'N'}</text>`}o+=t}}
 const rs=s*M.shaft/2,kw=Math.max(1.2,.26*rs),kd=Math.max(.8,.16*rs);
 o+=`<g class="vz-part" data-part="shaft"><circle cx="${vq(cx)}" cy="${vq(cy)}" r="${vq(rs)}" class="vz-sh"/><path class="vz-kw" d="M${vq(cx-kw/2)} ${vq(cy-rs+.3)}V${vq(cy-rs+kd)}H${vq(cx+kw/2)}V${vq(cy-rs+.3)}Z"/><path class="vz-cl" d="M${vq(cx-rs*.55)} ${vq(cy)}H${vq(cx+rs*.55)}M${vq(cx)} ${vq(cy-rs*.55)}V${vq(cy+rs*.55)}"/></g>`;
 o+=`<g data-layer="dims"><circle cx="${vq(cx)}" cy="${vq(cy)}" r="${vq(s*(M.yr-M.hyr))}" class="vz-hyr"/></g>`;
 // eixos d/q e FMM (fixos no referencial do rotor)
 const Lx=s*M.R0*.9,dA=PI/2,qA=PI/2+PI/P,ff=4/PI*M.FfN,fa=M.Fa1,mx=Math.max(ff,fa),nom=viz.regime==='nominal';
 const pt=(a,r)=>[cx+r*Math.cos(a),cy-r*Math.sin(a)],ax=(a,cls,r0,r1)=>{const p0=pt(a,r0),p1=pt(a,r1);return `<path class="${cls}" d="M${vzP(p0)}L${vzP(p1)}"/>`};
 const arrow=(a,len,cls,lbl)=>{const p1=pt(a,len),u=[Math.cos(a),-Math.sin(a)],lp=pt(a,len+11);D.ups.push({x:vq(lp[0]),y:vq(lp[1]+4)});return `<path class="${cls}" d="M${vq(cx)} ${vq(cy)}L${vzP(pt(a,len-5))}"/><path class="${cls}h" d="${vzHead(p1[0],p1[1],u[0],u[1],9,3.4)}"/><text class="vz-axl ${cls}t" x="${vq(lp[0])}" y="${vq(lp[1]+4)}" text-anchor="middle" data-up="${D.ups.length-1}">${lbl}</text>`};
 let a=`<g data-layer="axes" class="vz-axes">`;const Rx=s*(M.Rse+4);a+=ax(dA,'vz-ax-d',-Rx,Rx)+ax(qA,'vz-ax-q',-Rx,Rx);
 for(const [ang,l,cls] of [[dA,'d','vz-axdt'],[qA,'q','vz-axqt']]){const lp=pt(ang,Rx+9);D.ups.push({x:vq(lp[0]),y:vq(lp[1]+4)});a+=`<text class="vz-axl ${cls}" x="${vq(lp[0])}" y="${vq(lp[1]+4)}" text-anchor="middle" data-up="${D.ups.length-1}">${l}</text>`}
 a+=arrow(dA,Lx*ff/mx*(nom?1:.9),'vz-vf','Ff');
 if(nom)a+=arrow(dA+M.rho/M.p,Lx*fa/mx,'vz-va','Fa');
 const bA=dA+(nom?M.betaN:0)/M.p;a+=arrow(bA,Lx*.62,'vz-vb','Φδ');
 if(nom&&Math.abs(M.betaN)>.01){const r=Lx*.34,n=12,pts=[];for(let i=0;i<=n;i++)pts.push(pt(dA+(bA-dA)*i/n,r));a+=`<path class="vz-ang" d="${vzPath(pts,true)}"/>`}
 a+='</g>';o+=a;
 // balões do rotor
 if(P<=24){const f0=vzPoleMap(M,cx,cy,s,0),b=[],fq=(ang,r)=>[cx+s*r*Math.cos(ang),cy-s*r*Math.sin(ang)];
  const tC=f0(-(M.xc1+M.bE/2),M.yc1+M.hcDraw*.55),bC=fq(PI/2+PI/P*.98,M.yc1+M.hcDraw*.55);b.push([bC,tC,5,'coil']);
  const tP=f0(M.bp*.18,(M.yu+M.yr)/2),bP=fq(PI/2-PI/P*.98,(M.yu+M.R0)/2*.97);b.push([bP,tP,4,'pole']);
  const bm=M.bars[Math.max(0,Math.floor(M.Ndm/2)-1)],tD=f0(-bm.x,bm.y),bD=fq(PI/2+PI/P*.62,M.R0-M.hp1*.15+(M.Rb-M.R0)*0);b.push([bD,tD,6,'damper']);
  const tY=fq(PI/2-PI/P*.55,M.yr-M.hyr*.45),bY=fq(PI/2-PI/P*.95,M.yr-M.hyr*.15);b.push([bY,tY,7,viz.arch==='integral'?'pole':'yoke']);
  for(const [bb,tt,n,part] of b){D.ups.push({x:vq(bb[0]),y:vq(bb[1]),bal:1});o+=`<g class="vz-part" data-part="${part}">${vzBalloon(bb[0],bb[1],n,tt[0],tt[1],'vz-up'+(D.ups.length-1))}</g>`}}
 return o;
}
function vzHalo(M,D,thm,nom,I){
 const Fs=nom?vizMMF(M,I):M.Fs,B=vizGapRaw(M,thm,nom?M.FfN:M.Ff0,Fs,nom,M.Bb),N=M.Nh,cx=D.cx,cy=D.cy,R0=D.Rh0,k=D.kB*(nom?M.KnN:M.Kn0),th=M.thS;
 let i0=0;for(let i=1;i<N;i++)if((B[i]>0)!==(B[i-1]>0)){i0=i;break}
 let pos='',neg='',run=[],sg=B[i0]>0;
 const flush=()=>{if(run.length>1){const a0=th[run[0]],a1=th[run[run.length-1]];let d='';
   for(let j=0;j<run.length;j++){const i=run[j],r=R0+k*Math.abs(B[i]),a=th[i];d+=(j?'L':'M')+vq(cx+r*Math.cos(a))+' '+vq(cy-r*Math.sin(a))}
   d+=`L${vq(cx+R0*Math.cos(a1))} ${vq(cy-R0*Math.sin(a1))}A${vq(R0)} ${vq(R0)} 0 ${run.length/N>.5?1:0} 1 ${vq(cx+R0*Math.cos(a0))} ${vq(cy-R0*Math.sin(a0))}Z`;
   if(sg)pos+=d;else neg+=d}run=[]};
 for(let n=0;n<N;n++){const i=(i0+n)%N,g=B[i]>0;if(g!==sg){flush();sg=g}run.push(i)}flush();
 D.hp.setAttribute('d',pos);D.hn.setAttribute('d',neg);
 if(D.hl.length){const b=(nom?M.betaN:0)/M.p,r=R0+D.kB*Math.max(nom?M.BdN:M.Bd0,.5)*1.12+9;
  for(let j=0;j<D.hl.length;j++){const a=PI/2+thm+2*PI*j/M.P+b;D.hl[j].setAttribute('x',vq(cx+r*Math.cos(a)));D.hl[j].setAttribute('y',vq(cy-r*Math.sin(a)+3.5))}}
}

/* ---------- vista 2: corte longitudinal ---------- */
function vzAxial(M,L){
 const {W,H,wide}=L,T=vzTB(L),zA=M.lp/2,zF=zA+M.lp1,zB=zF+M.lfhr,zEnd=Math.max(M.ls/2+M.lFh1,zB,M.lyr/2),ext=Math.max(120,Math.min(420,.32*M.Rb)),Zm=zEnd+ext;
 const x0=40,x1=W-40,y0=40,y1=T.y-16,s=Math.min((x1-x0)/(2*Zm),(y1-y0)/(2*(M.Rse+14))),cx=(x0+x1)/2,cy=(y0+y1)/2;
 const X=z=>cx+s*z,Y=r=>cy-s*r,D={view:'axial',cx,cy,s,zA,zF,zB,Zm};
 const R0=M.R0,rBody=Math.min(R0,Math.hypot(M.xc2,M.yc2)),yk=M.yr*1.01,rsh=M.shaft/2;
 const grad=[['vz-gfe',Y(R0),Y(-R0),'--iron2','--iron','--vz-fehi'],['vz-gcu',Y(R0),Y(-R0),'--copper2','--copper','--vz-cuhi'],['vz-gbr',Y(R0),Y(-R0),'--copper2','--brass','--vz-brhi'],['vz-gbd',Y(rBody),Y(-rBody),'--bg2','--copper2','--copper2'],['vz-gyk',Y(yk),Y(-yk),'--iron2','--iron','--vz-fehi'],['vz-gsh',Y(rsh),Y(-rsh),'--st2','--shaft','--vz-shhi']];
 let o=`<title id="machine-title">${M.P} polos · corte longitudinal em escala</title><desc id="machine-desc">Meio corte do estator com pacotes, dutos e cabeças de bobina; rotor em vista externa girando, com sapatas, flanges, cabeças da bobina de campo, barras e anéis do amortecedor.</desc>`;
 o+=vzDefs({grad})+vzSheet(L);
 o+=`<path class="vz-cl" d="M${x0-12} ${vq(cy)}H${x1+12}"/>`;
 // eixo (atrás) com rupturas
 const xs0=X(-Zm),xs1=X(Zm);
 o+=`<g class="vz-part" data-part="shaft"><rect x="${vq(xs0)}" y="${vq(Y(rsh))}" width="${vq(xs1-xs0)}" height="${vq(2*s*rsh)}" fill="url(#vz-gsh)" class="vz-shb"/>${vzBreak([[xs0,Y(rsh)],[xs0,Y(-rsh)]],2.4,7)}${vzBreak([[xs1,Y(rsh)],[xs1,Y(-rsh)]],2.4,7)}<path id="vz-key" class="vz-key"/></g>`;
 // jugo além dos polos e corpo entre sapatas
 o+=`<g class="vz-part" data-part="${viz.arch==='integral'?'pole':'yoke'}"><rect x="${vq(X(-M.lyr/2))}" y="${vq(Y(yk))}" width="${vq(s*M.lyr)}" height="${vq(2*s*yk)}" fill="url(#vz-gyk)" class="vz-ykb"/></g>`;
 o+=`<g class="vz-part" data-part="coil" data-layer="coils"><rect x="${vq(X(-zF))}" y="${vq(Y(rBody))}" width="${vq(2*s*zF)}" height="${vq(2*s*rBody)}" fill="url(#vz-gbd)"/><path id="vz-ce" fill="url(#vz-gcu)" class="vz-axo"/></g>`;
 o+=`<g class="vz-part" data-part="pole"><path id="vz-shoe" fill="url(#vz-gfe)" class="vz-axo"/><path id="vz-fl" class="vz-flg"/></g>`;
 o+=`<g class="vz-part" data-part="damper" data-layer="dampers"><path id="vz-sl" class="vz-slot"/><path id="vz-be" fill="url(#vz-gbr)" class="vz-axo"/><path id="vz-rg" fill="url(#vz-gbr)" class="vz-axo"/></g>`;
 // estator em meio corte (superior e inferior)
 const k0=0,kb=Math.round(M.Qs/2)%M.Qs;let pk='',tooth='',duct='';
 for(let i=0;i<M.nPk;i++){const za=-M.ls/2+i*(M.lpk+M.duct);for(const sg of [1,-1]){pk+=vzPath([[X(za),Y(sg*(M.Rb+M.hs))],[X(za+M.lpk),Y(sg*(M.Rb+M.hs))],[X(za+M.lpk),Y(sg*M.Rse)],[X(za),Y(sg*M.Rse)]]);tooth+=vzPath([[X(za),Y(sg*M.Rb)],[X(za+M.lpk),Y(sg*M.Rb)],[X(za+M.lpk),Y(sg*(M.Rb+M.hs))],[X(za),Y(sg*(M.Rb+M.hs))]])}}
 o+=`<g class="vz-part" data-part="packets" data-layer="stator"><path class="vz-tooth" d="${tooth}"/><path class="vz-st" d="${pk}"/></g>`;
 // condutores: ranhura + cabeça (forma simplificada)
 const l1=Math.min(50,.3*M.lFh1),kap=15*PI/180,band=(r0,sg,side)=>{const zc=M.ls/2,zN=zc+M.lFh1-(M.hcs+.5),pts=[],pts2=[];
   const rr=z=>r0+Math.max(0,z-(zc+l1))*Math.tan(kap);
   for(const z of [-zN,-(zc+l1),zc+l1,zN].sort((a,b)=>a-b)){const fl=r0+Math.max(0,Math.abs(z)-(zc+l1))*Math.tan(kap);pts.push([X(z),Y(sg*fl)]);pts2.push([X(z),Y(sg*(fl+M.hcs))])}
   return vzPath(pts.concat(pts2.reverse()))};
 const zN=M.ls/2+M.lFh1-(M.hcs+.5),nose=(sg,side)=>{const flare=Math.max(0,zN-(M.ls/2+l1))*Math.tan(kap),rc=M.rTop0+flare+(M.hcs+.5+M.hcs)/2,R=(M.hcs*2+.5)/2,pts=[];
   for(let i=0;i<=10;i++){const a=-PI/2+PI*i/10;pts.push([X(side*(zN+R*Math.cos(a)*1)),Y(sg*(rc+R*Math.sin(a)))])}return vzPath(pts)};
 o+=`<g class="vz-part" data-part="ends" data-layer="stator"><path class="vz-wedgeA" d="${vzPath([[X(-M.ls/2),Y(M.Rb+.5)],[X(M.ls/2),Y(M.Rb+.5)],[X(M.ls/2),Y(M.Rb+4)],[X(-M.ls/2),Y(M.Rb+4)]])}${vzPath([[X(-M.ls/2),Y(-M.Rb-.5)],[X(M.ls/2),Y(-M.Rb-.5)],[X(M.ls/2),Y(-M.Rb-4)],[X(-M.ls/2),Y(-M.Rb-4)]])}"/>`;
 o+=`<path id="vz-at0" class="vz-cs" d="${band(M.rTop0,1)}"/><path id="vz-at1" class="vz-cs" d="${band(M.rBot0,1)}"/><path id="vz-ab0" class="vz-cs" d="${band(M.rTop0,-1)}"/><path id="vz-ab1" class="vz-cs" d="${band(M.rBot0,-1)}"/><path class="vz-cu" d="${nose(1,1)}${nose(1,-1)}${nose(-1,1)}${nose(-1,-1)}"/></g>`;
 D.cls={at0:M.cls[2*k0],at1:M.cls[2*k0+1],ab0:M.cls[2*kb],ab1:M.cls[2*kb+1]};
 // plano A–A
 o+=`<g class="vz-ann"><path class="vz-sec" d="M${vq(cx)} ${vq(Y(M.Rse+10))}V${vq(Y(-M.Rse-10))}"/><path class="vz-sec-end" d="M${vq(cx)} ${vq(Y(M.Rse+20))}V${vq(Y(M.Rse+8))}M${vq(cx)} ${vq(Y(-M.Rse-8))}V${vq(Y(-M.Rse-20))}"/><path class="vz-ld" d="M${vq(cx)} ${vq(Y(M.Rse+20))}H${vq(cx-8)}M${vq(cx)} ${vq(Y(-M.Rse-20))}H${vq(cx-8)}"/><path class="vz-ah" d="${vzHead(cx-14,Y(M.Rse+20),-1,0)}${vzHead(cx-14,Y(-M.Rse-20),-1,0)}"/><text class="vz-t" x="${vq(cx-26)}" y="${vq(Y(M.Rse+16))}">A</text><text class="vz-t" x="${vq(cx-26)}" y="${vq(Y(-M.Rse-24))}">A</text>`;
 // cotas
 let dm=`<g data-layer="dims">`;
 dm+=vzDim(X(-M.ls/2),Y(M.Rse),X(M.ls/2),Y(M.Rse),-(16),`ls ${vzF0(M.ls)} = ${M.nPk} × ${vzF0(M.lpk)} + ${M.nPk-1} × ${vzF0(M.duct)}`);
 dm+=vzDim(X(M.ls/2),Y(M.Rse),X(M.ls/2+M.lFh1),Y(M.Rse),-16,`${vzF0(M.lFh1)}`);
 dm+=vzDim(X(-zA),Y(-M.Rse),X(zA),Y(-M.Rse),16,`lp ${vzF0(M.lp)}`);
 dm+=vzDim(X(-zB),Y(-M.Rse-22),X(zB),Y(-M.Rse-22),14,`ldm ${vzF0(2*zB)}`);
 const xl=X(-zEnd)-18;dm+=vzDim(xl,Y(M.Rse),xl,Y(-M.Rse),-10,`Ø${vzF0(M.Dse)}`)+vzDim(xl+30,Y(M.Rb),xl+30,Y(-M.Rb),-10,`Ø${vzF0(M.Ds)}`);
 const xr=X(zEnd+ext*.55);dm+=vzDim(xr,Y(rsh),xr,Y(-rsh),10,`Ø${vzF0(M.shaft)}`);
 dm+='</g>';o+=dm;
 // chamadas
 const cl=(tx,ty,ex,ey,txt,anc,part)=>`<g class="vz-part" data-part="${part}">${vzLeader([[tx,ty],[ex,ey],[ex+(anc==='end'?-14:14),ey]],txt,anc,'vz-t')}</g>`;
 const zp=-M.ls/2+M.lpk*.5;o+=cl(X(zp),Y(M.Rse-M.hYoke*.4),X(zp)-40,Y(M.Rse+30),`${M.nPk} pacotes · dutos de ${vzF0(M.duct)} mm`,'end','packets');
 o+=cl(X(M.ls/2+M.lFh1*.6),Y(M.rBot0+M.hcs+M.lFh1*.12),X(M.ls/2+M.lFh1*.6)+30,Y(M.Rse+30),'Cabeças da armadura','start','ends');
 o+=cl(X(zF+M.dpb+M.bE/2),Y(-(M.yc1+M.yc2)/2*.6),X(zF)+60,Y(-M.Rse*.62),'Cabeça da bobina de campo','start','coil');
 o+=cl(X(zB-M.ringA/2),Y(M.R0*.35),X(zEnd)+18,Y(M.R0*.75),'Anel de curto','start','ring');
 o+=cl(X(-zA-M.lp1/2),Y(R0*.25),X(-zEnd)-6,Y(R0*.6),`Flange ${vzF0(M.lp1)} mm`,'end','flange');
 o+=`</g>`+vzTitle(L,M,{title:'Corte B–B · seção longitudinal',sheet:2,s});
 return {svg:o,D};
}
function vzTickAxial(M,D,thm){
 const P=M.P,s=D.s,cx=D.cx,cy=D.cy,X=z=>vq(cx+s*z),Yv=r=>vq(cy-s*r),{zA,zF,zB}=D;
 const zR=zB-M.ringA,zE1=zF+M.dpb,zE2=zE1+M.bE,rect=(z0,z1,y0,y1)=>`M${X(z0)} ${Yv(y1)}H${X(z1)}V${Yv(y0)}H${X(z0)}Z`,both=(z0,z1,y0,y1)=>rect(z0,z1,y0,y1)+rect(-z1,-z0,y0,y1);
 const pl=[];for(let i=0;i<P;i++){const u=vzWrap(PI/2+thm+2*PI*i/P-PI);pl.push({i,u,c:Math.cos(u)})}pl.sort((a,b)=>a.c-b.c);
 let shoe='',fl='',sl='',be='',rg='',ce='';const gR=a=>M.Rb-M.gT[Math.min(M.NT,(Math.abs(a)/M.hpA*M.NT)|0)];
 for(const o of pl){const u=o.u;
  if(o.c>-.35){const cu=Math.cos(u),su=Math.sin(u);let y0=Infinity,y1=-Infinity;for(const [x,y] of [[M.xc2,M.yc1],[-M.xc2,M.yc1],[M.xc2,M.yc2],[-M.xc2,M.yc2]]){const v=x*cu-y*su;y0=Math.min(y0,v);y1=Math.max(y1,v)}ce+=both(zE1,zE2,y0,y1)}
  const lo=Math.max(-PI/2,u-M.phiE),hi=Math.min(PI/2,u+M.phiE);if(hi<=lo)continue;
  const yT=-gR(lo-u)*Math.sin(lo),yB=-gR(hi-u)*Math.sin(hi);shoe+=rect(-zA,zA,yB,yT);
  const lo2=Math.max(-PI/2,u-M.phiE*.96),hi2=Math.min(PI/2,u+M.phiE*.96);if(hi2>lo2){const r2=M.R0-3;fl+=both(zA,zF,-r2*Math.sin(hi2),-r2*Math.sin(lo2))}
  let yr0=Infinity,yr1=-Infinity,nb=0;
  for(const b of M.bars){const ub=u-Math.atan2(b.xs,b.ys);if(Math.abs(ub)>=PI/2)continue;const ys=-Math.hypot(b.xs,b.ys)*Math.sin(ub),rb=Math.hypot(b.x,b.y),yb=-rb*Math.sin(ub);
   sl+=`M${X(-zA)} ${Yv(ys)}H${X(zA)}`;be+=both(zF,zR,yb-M.ddm/2,yb+M.ddm/2);nb++;
   for(const r of [rb-.6*M.ringB,rb+.5*M.ddm]){const v=-r*Math.sin(ub);yr0=Math.min(yr0,v);yr1=Math.max(yr1,v)}}
  if(nb)rg+=both(zR,zB,yr0,yr1)}
 D.e.shoe.setAttribute('d',shoe);D.e.fl.setAttribute('d',fl);D.e.sl.setAttribute('d',sl);D.e.be.setAttribute('d',be);D.e.rg.setAttribute('d',rg);D.e.ce.setAttribute('d',ce);
 const uk=vzWrap(PI/2+thm-PI),rsh=M.shaft/2;
 if(Math.abs(uk)<PI/2){const yk=-rsh*Math.sin(uk),hh=Math.max(1.5,.13*M.shaft*Math.abs(Math.cos(uk))+.05*M.shaft*Math.abs(Math.sin(uk))),z0=Math.max(M.lyr/2,zB)+12,z1=D.Zm-14;D.e.key.setAttribute('d',rect(z0,Math.max(z0+10,z1),yk-hh,yk+hh))}else D.e.key.setAttribute('d','');
 const nom=viz.regime==='nominal',I=vizCurrents(M,thm,nom,VZ_I6),Im=M.kc*M.Im||1;for(const k of ['at0','at1','ab0','ab1'])D.e[k].style.fill=vzCurCol(I[D.cls[k]]/Im);
}

/* ---------- vista 3: detalhe do polo e da ranhura ---------- */
function vzDetail(M,L){
 const {W,H,wide}=L,T=vzTB(L),P=M.P,pa=PI/P;
 const chartH=wide?Math.round(Math.max(92,Math.min(150,H*.22))):Math.round(Math.max(100,W*.36));
 const rx0=34,rx1=wide?T.x-22:W-34,ry0=36,ry1=(wide?H-28:T.y-14)-chartH-18;
 const rOut=M.Rb+M.hs+Math.min(M.hYoke,.22*M.hYoke+16),rIn=viz.arch==='mounted'?Math.max(M.shaft/2,M.yr-M.hyr-12):Math.max(M.shaft/2,M.yr-.42*M.hyr);
 const bb=(lo,hi)=>{const xs=[],ys=[];for(const r of [rIn,rOut])for(const a of [lo,hi]){xs.push(r*Math.sin(a));ys.push(r*Math.cos(a))}for(const a of [0,PI/2,-PI/2])if(a>lo&&a<hi){xs.push(rOut*Math.sin(a));ys.push(rOut*Math.cos(a))}
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return {lo,hi,x0,x1,y0,y1,s:Math.min((rx1-rx0)/(x1-x0),(ry1-ry0)/(y1-y0))}};
 const full=bb(-1.07*pa,1.07*pa),half=bb(-.16*pa,1.1*pa),V=full.s>=.8*half.s?full:half,s=V.s,isHalf=V!==full;
 const cx=(rx0+rx1)/2-s*(V.x0+V.x1)/2,cy=(ry0+ry1)/2+s*(V.y0+V.y1)/2,F=(x,y)=>[cx+s*x,cy-s*y];
 const D={view:'detail',cx,cy,s,lo:V.lo,hi:V.hi,kc:null,isHalf};
 // recorte do setor (ângulos locais: a partir do eixo do polo, positivo para a direita)
 const arcPts=(r,a0,a1)=>{const n=Math.max(8,Math.ceil(Math.abs(a1-a0)*r*s/6)),p=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;p.push(F(r*Math.sin(a),r*Math.cos(a)))}return p};
 const sector=arcPts(rOut,V.lo,V.hi).concat(arcPts(rIn,V.hi,V.lo));
 let o=`<title id="machine-title">${P} polos · detalhe do polo em escala</title><desc id="machine-desc">Sapata com barras amortecedoras, bobina de campo com suas espiras, entreferro real e ranhuras do estator passando sobre o polo; abaixo, a indução no entreferro no referencial do rotor.</desc>`;
 o+=vzDefs({clip:`<clipPath id="vz-dclip"><path d="${vzPath(sector)}"/></clipPath>`})+vzSheet(L);
 o+=`<g clip-path="url(#vz-dclip)"><g id="vz-dst" data-layer="stator"><g class="vz-part" data-part="stator"><path class="vz-st" fill-rule="evenodd" d="${vzCircle(cx,cy,s*(rOut+40))}${vzCircle(cx,cy,s*M.Rb)}"/></g><g id="vz-dsc"></g></g>`;
 // rotor (parado neste referencial)
 const seg=2.2/s,vis=new Set([0,1,P-1]);
 if(viz.arch==='integral')o+=`<g class="vz-part" data-part="pole"><path class="vz-fe" fill-rule="evenodd" d="${vzCoreOutline(M,cx,cy,s,'core',vis,seg)}${vzCircle(cx,cy,s*M.shaft/2)}"/></g>`;
 else{o+=`<g class="vz-part" data-part="yoke"><path class="vz-rim" fill-rule="evenodd" d="${vzCoreOutline(M,cx,cy,s,'rim')}${vzCircle(cx,cy,s*(M.yr-M.hyr))}"/></g>`;let pp='';for(const i of vis)pp+=vzMountedPole(M,vzPoleMap(M,cx,cy,s,i),true,seg);o+=`<g class="vz-part" data-part="pole"><path class="vz-fe" d="${pp}"/></g>`}
 const C={cu:'',ins:'',bad:'',ring:'',dot:'',cro:'',turns:''};for(const i of vis){const c=vzCoils(M,vzPoleMap(M,cx,cy,s,i),i,{s,turns:true});for(const k in C)C[k]+=c[k]}
 o+=`<g class="vz-part" data-part="coil" data-layer="coils"><path class="vz-ins" d="${C.ins}"/><path class="vz-cu" d="${C.cu}"/><path class="vz-cuL" d="${C.turns}"/>${C.bad?`<path class="vz-bad" d="${C.bad}"/>`:''}<path class="vz-sym2" d="${C.ring}${C.cro}"/><path class="vz-symf2" d="${C.dot}"/></g>`;
 let bars='';for(const i of vis){const f=vzPoleMap(M,cx,cy,s,i);for(const b of M.bars){const c=f(b.x,b.y);bars+=vzCircle(c[0],c[1],s*M.ddm/2)}}
 o+=`<g class="vz-part" data-part="damper" data-layer="dampers"><path class="vz-br" d="${bars}"/></g>`;
 o+=`<g data-layer="axes"><path class="vz-ax-d" d="M${vzP(F(0,rIn))}L${vzP(F(0,rOut+30))}"/>${[-1,1].map(sg=>`<path class="vz-ax-q" d="M${vzP(F(rIn*Math.sin(sg*pa),rIn*Math.cos(sg*pa)))}L${vzP(F((rOut+30)*Math.sin(sg*pa),(rOut+30)*Math.cos(sg*pa)))}"/>`).join('')}</g>`;
 o+='</g>';
 o+=vzBreak(arcPts(rOut,V.lo,V.hi),2.6,13)+vzBreak(arcPts(rIn,V.lo,V.hi),2.6,13)+vzBreak([F(rIn*Math.sin(V.lo),rIn*Math.cos(V.lo)),F(rOut*Math.sin(V.lo),rOut*Math.cos(V.lo))],2.6,13)+vzBreak([F(rIn*Math.sin(V.hi),rIn*Math.cos(V.hi)),F(rOut*Math.sin(V.hi),rOut*Math.cos(V.hi))],2.6,13);
 // eixos: rótulos
 {const pd=F(0,rOut+30),pq=F((rOut+30)*Math.sin(pa),(rOut+30)*Math.cos(pa));o+=`<g data-layer="axes"><text class="vz-axl vz-axdt" x="${vq(pd[0])}" y="${vq(pd[1]-4)}" text-anchor="middle">d</text><text class="vz-axl vz-axqt" x="${vq(pq[0]+4)}" y="${vq(pq[1]-4)}" text-anchor="middle">q</text></g>`}
 // cotas
 let dm=`<g data-layer="dims">`;const one=isHalf;
 {const p1=F(0,M.Rb),p2=F(0,M.R0);dm+=`<path class="vz-dl" d="M${vzP([p1[0],p1[1]-16])}L${vzP(p1)}M${vzP(p2)}L${vzP([p2[0],p2[1]+16])}"/><path class="vz-ah" d="${vzHead(p1[0],p1[1],0,1)}${vzHead(p2[0],p2[1],0,-1)}"/><text class="vz-dim" x="${vq(p1[0]-5)}" y="${vq(p1[1]-6)}" text-anchor="end">δ ${vzF1(M.delta)}</text>`}
 {const ux=Math.sin(M.phiE),uy=Math.cos(M.phiE),re=Math.hypot(M.xe,M.ye),p1=F(M.Rb*ux,M.Rb*uy),p2=F(re*ux,re*uy),u=[p1[0]-p2[0],p1[1]-p2[1]],lu=Math.hypot(u[0],u[1])||1,e=[u[0]/lu,u[1]/lu];
  dm+=`<path class="vz-dl" d="M${vzP([p1[0]+e[0]*14,p1[1]+e[1]*14])}L${vzP(p1)}M${vzP(p2)}L${vzP([p2[0]-e[0]*14,p2[1]-e[1]*14])}"/><path class="vz-ah" d="${vzHead(p1[0],p1[1],-e[0],-e[1])}${vzHead(p2[0],p2[1],e[0],e[1])}"/><text class="vz-dim" x="${vq(p1[0]+e[0]*16+5)}" y="${vq(p1[1]+e[1]*16)}">δmax ${vzF1(M.deltaMax)}</text>`}
 {const rA=rOut+12/s,rB=rOut+28/s,aE=M.phiE;
  dm+=`<path class="vz-dle" d="M${vzP(F(M.xe,M.ye))}L${vzP(F((rA+6/s)*Math.sin(aE),(rA+6/s)*Math.cos(aE)))}${one?'':`M${vzP(F(-M.xe,M.ye))}L${vzP(F(-(rA+6/s)*Math.sin(aE),(rA+6/s)*Math.cos(aE)))}`}"/>`;
  const ang=a=>PI/2-a;dm+=vzArcDim(cx,cy,s*rA,ang(aE),ang(one?0:-aE),`bpe ${vzF1(M.bpe)}`,{one});
  dm+=vzArcDim(cx,cy,s*rB,ang(pa),ang(one?0:-pa),one?`τp/2 ${vzF1(M.tauP/2)}`:`τp ${vzF1(M.tauP)}`,{one})}
 {const yb=(M.yr+M.yu)/2,xa=one?0:-M.bp/2,p1=F(xa,yb),p2=F(M.bp/2,yb);dm+=vzDim(p1[0],p1[1],p2[0],p2[1],0,`bp ${vzF1(M.bp)}`,{one})}
 {const xd=M.xe+Math.max(10,.1*M.bpe),pT=F(xd,M.R0),pU=F(xd,M.yu),pR=F(xd,M.yr);
  dm+=`<path class="vz-dle" d="M${vzP(F(0,M.R0))}L${vzP([pT[0]+4,pT[1]])}M${vzP(F(M.xe,M.yu))}L${vzP([pU[0]+4,pU[1]])}M${vzP(F(M.xc2+1,M.yr))}L${vzP([pR[0]+4,pR[1]])}"/>`;
  dm+=vzDim(pT[0],pT[1],pU[0],pU[1],0,`hp1 ${vzF1(M.hp1)}`)+vzDim(pU[0],pU[1],pR[0],pR[1],0,`hp2 ${vzF1(M.hp2)}`)}
 {const a=-.55*M.psiE,pa1=F(M.rp*Math.sin(a),M.c+M.rp*Math.cos(a)),pa2=F((M.rp-.45*M.hp1)*Math.sin(a),M.c+(M.rp-.45*M.hp1)*Math.cos(a));dm+=`<path class="vz-dl" d="M${vzP(pa2)}L${vzP(pa1)}"/><path class="vz-ah" d="${vzHead(pa1[0],pa1[1],(pa1[0]-pa2[0])/Math.hypot(pa1[0]-pa2[0],pa1[1]-pa2[1]),(pa1[1]-pa2[1])/Math.hypot(pa1[0]-pa2[0],pa1[1]-pa2[1]))}"/><text class="vz-dim" x="${vq(pa2[0])}" y="${vq(pa2[1]+12)}" text-anchor="middle">R ${vzF0(M.rp)}</text>`}
 {const b=M.bars[M.Ndm-1],pb=F(b.x,b.y),pe=[pb[0]+42,pb[1]-26];dm+=vzLeader([pb,pe,[pe[0]+10,pe[1]]],`${M.Ndm} × Ø${vzF1(M.ddm)} · τr ${vzF1(M.tr)}`,'start')}
 {const pc=F(M.xc1+M.bE*.6,M.yc1+M.hcDraw*.35),pe=[F(M.xe+Math.max(10,.1*M.bpe),0)[0]+36,pc[1]+18];dm+=vzLeader([pc,pe,[pe[0]+10,pe[1]]],`${M.NE} esp. · ${vzF2(M.aE)} × ${vzF1(M.bE)}`,'start')}
 dm+='</g>';o+=dm;
 // gráfico de B no referencial do rotor
 const gx0=rx0+34,gx1=rx1-8,gy0=ry1+22,gy1=(wide?H-28:T.y-14),gm=(gy0+gy1)/2,N=Math.max(360,Math.min(900,Math.round((gx1-gx0)*1.4)));
 D.chart={x0:gx0,x1:gx1,ym:gm,N};
 const nom=viz.regime==='nominal',ref=new Float64Array(N+1),fun=new Float64Array(N+1),nl=new Float64Array(N+1);let pk=0;
 {const I=vizCurrents(M,0,nom,VZ_I6),Fs=nom?Float64Array.from(vizMMF(M,I)):null,Ff=nom?M.FfN:M.Ff0,Kn=nom?M.KnN:M.Kn0,thd=PI/2;
  for(let i=0;i<=N;i++){const xe=-PI+2*PI*i/N,t=thd+xe/M.p;ref[i]=Kn*vizBat(M,t,thd,Ff,Fs,nom);nl[i]=M.Kn0*vizBat(M,t,thd,M.Ff0,null,false);pk=Math.max(pk,Math.abs(ref[i]),Math.abs(nl[i]))}
  let re=0,im=0;for(let i=0;i<N;i++){const xe=-PI+2*PI*i/N;re+=ref[i]*Math.cos(xe);im+=ref[i]*Math.sin(xe)}const A=2*Math.hypot(re,im)/N,ph=Math.atan2(im,re);for(let i=0;i<=N;i++){const xe=-PI+2*PI*i/N;fun[i]=A*Math.cos(xe-ph)}D.B1=A}
 const bmax=Math.max(.6,Math.ceil(pk*1.08*5)/5),ck=(gy1-gy0)/2/bmax;D.chart.ck=ck;const gX=i=>gx0+(gx1-gx0)*i/N,gY=b=>gm-b*ck;
 let ch=`<g class="vz-chartg"><rect x="${gx0}" y="${vq(gy0)}" width="${vq(gx1-gx0)}" height="${vq(gy1-gy0)}" class="vz-chbox"/>`;
 const shx=M.p*M.phiE/PI;ch+=`<rect x="${vq(gx0+(gx1-gx0)*(.5-shx/2))}" y="${vq(gy0)}" width="${vq((gx1-gx0)*shx)}" height="${vq(gy1-gy0)}" class="vz-pole-sh"/>`;
 for(const [fx,l] of [[0,'−180°'],[.25,'−90° q'],[.5,'0° d'],[.75,'90° q'],[1,'180°']]){const x=gx0+(gx1-gx0)*fx;ch+=`<path class="vz-grid" d="M${vq(x)} ${vq(gy0)}V${vq(gy1)}"/><text class="vz-z" x="${vq(x)}" y="${vq(gy1+11)}" text-anchor="middle">${l}</text>`}
 ch+=`<path class="vz-grid" d="M${gx0} ${vq(gm)}H${gx1}"/>`;for(const b of [bmax,-bmax,bmax/2,-bmax/2])ch+=`<text class="vz-z" x="${gx0-4}" y="${vq(gY(b)+3)}" text-anchor="end">${fmt(b,1)}</text>`;
 ch+=`<text class="vz-s" x="${gx0-30}" y="${vq(gy0-6)}">B (T)</text><text class="vz-s" x="${gx1}" y="${vq(gy0-6)}" text-anchor="end">Indução no entreferro · referencial do rotor · ${nom?'carga nominal':'em vazio'}</text>`;
 const path=arr=>{let d='';for(let i=0;i<=N;i++)d+=(i?'L':'M')+vq(gX(i))+' '+vq(gY(arr[i]));return d};
 if(nom)ch+=`<path class="vz-ch0" d="${path(nl)}"/>`;ch+=`<path class="vz-chf" d="${path(fun)}"/><g data-layer="flux"><path id="vz-chB" class="vz-chart" d="${path(ref)}"/></g>`;
 ch+=`<text class="vz-n" x="${gx1-6}" y="${vq(gy0+14)}" text-anchor="end">B₁ = ${fmt(D.B1,3)} T</text></g>`;
 o+=ch;
 if(wide)o+=vzSlotInset(M,T.x,40,W-26,T.y-14);
 o+=vzTitle(L,M,{title:`Detalhe C · polo ${isHalf?'(meia vista) ':''}e ranhura`,sheet:3,s});
 return {svg:o,D};
}
function vzDetailSlots(M,D,thm){
 const Q=M.Qs,s=D.s,cx=D.cx,cy=D.cy,tau=2*PI/Q,m=2*tau,k0=Math.floor((thm-D.hi-m)/tau),k1=Math.ceil((thm-D.lo+m)/tau);
 let cav='',wed='',gas='',ins='',ring='';const cond=['','','','','',''],dt=['','','','','',''],cr=['','','','','',''];
 const Rb=M.Rb,bs=M.bs,rows=(M.z/2)*M.Nelh,Wcu=M.Nelb*(M.bel+M.disB),Hcu0=rows*(M.ael+M.disA)+Math.max(0,M.z/2-1)*M.insTurn,kh=Hcu0>M.hcs?M.hcs/Hcu0:1;
 const sym=s*Math.min(M.wc,M.hcs)>=7,rr=.24*Math.min(M.wc,M.hcs);
 for(let kk=k0;kk<=k1;kk++){const k=((kk%Q)+Q)%Q,f=vzSlotMap(cx,cy,s,kk,Q),R=(w0,w1,u0,u1)=>vzPath([f(w0,u0),f(w1,u0),f(w1,u1),f(w0,u1)]);
  cav+=R(Rb-.6,Rb+M.hs,-bs/2,bs/2);
  const w0=Rb+.5,g=Math.min(1.2,bs*.08);wed+=vzPath([f(w0,-bs/2),f(w0+1,-bs/2-g),f(w0+3.5-1,-bs/2-g),f(w0+3.5,-bs/2),f(w0+3.5,bs/2),f(w0+3.5-1,bs/2+g),f(w0+1,bs/2+g),f(w0,bs/2)]);
  gas+=R(Rb+4,Rb+4.5,-bs/2,bs/2)+R(M.rTop0+M.hcs,M.rBot0,-bs/2,bs/2)+R(Rb+M.hs-.5,Rb+M.hs,-bs/2,bs/2);
  for(let l=0;l<2;l++){const r0=l?M.rBot0:M.rTop0,c=M.cls[2*k+l];ins+=R(r0,r0+M.hcs,-M.wc/2,M.wc/2);
   const wb=r0+(M.hcs-Hcu0*kh)/2;for(let t=0;t<M.z/2;t++)for(let rI=0;rI<M.Nelh;rI++){const w=wb+((t*M.Nelh+rI)*(M.ael+M.disA)+t*M.insTurn+M.disA/2)*kh;
     for(let ci=0;ci<M.Nelb;ci++){const u=-Wcu/2+ci*(M.bel+M.disB)+M.disB/2;cond[c]+=R(w,w+M.ael*kh,u,u+M.bel)}}
   if(sym){const p=f(r0+M.hcs/2,0),R2=rr*s,d=R2*.6;ring+=vzCircle(p[0],p[1],R2);dt[c]+=vzCircle(p[0],p[1],R2*.3);cr[c]+=`M${vq(p[0]-d)} ${vq(p[1]-d)}L${vq(p[0]+d)} ${vq(p[1]+d)}M${vq(p[0]-d)} ${vq(p[1]+d)}L${vq(p[0]+d)} ${vq(p[1]-d)}`}}}
 return `<g class="vz-part" data-part="winding"><path class="vz-cav" d="${cav}"/><path class="vz-wedge" d="${wed}${gas}"/><path class="vz-ins" d="${ins}"/>${cond.map((d,c)=>`<path id="vz-k${c}" class="vz-cs" d="${d}"/>`).join('')}<g data-layer="currents"${viz.layers.currents?'':' display="none"'}><path class="vz-symw" d="${ring}"/>${dt.map((d,c)=>`<path id="vz-d${c}" class="vz-symfw" d="${d}"/>`).join('')}${cr.map((d,c)=>`<path id="vz-x${c}" class="vz-symw" d="${d}"/>`).join('')}</g></g>`}
function vzSlotInset(M,x0,y0,x1,y1){
 const tooth=Math.max(2,Math.min((M.tauS-M.bs)/2*.85,M.bs*.85)),wmm=M.bs+2*tooth,hmm=M.hs+Math.min(14,.25*M.hYoke)+3;
 const lw=Math.min(150,(x1-x0)*.48),sc=Math.min((x1-x0-lw-26)/wmm,(y1-y0-60)/hmm),ox=x0+14+(x1-x0-lw-26-wmm*sc)/2,oy=y0+30;
 const X=u=>ox+(u+wmm/2)*sc,Y=w=>oy+(M.Rb+M.hs+Math.min(14,.25*M.hYoke)-w)*sc,R=(w0,w1,u0,u1)=>`M${vq(X(u0))} ${vq(Y(w0))}H${vq(X(u1))}V${vq(Y(w1))}H${vq(X(u0))}Z`;
 const Rb=M.Rb,bs=M.bs,wTop=M.Rb+M.hs+Math.min(14,.25*M.hYoke);
 let s=`<g class="vz-inset vz-part" data-part="winding"><text class="vz-t" x="${x0}" y="${y0+6}">Detalhe B · ranhura (${fmt(sc/(vzLastS()||sc),1)}:1 da folha 3)</text>`;
 s+=`<path class="vz-st" d="${R(Rb,wTop,-wmm/2,wmm/2)}"/><path class="vz-cav" d="${R(Rb-.01,Rb+M.hs,-bs/2,bs/2)}"/>`;
 const w0=Rb+.5,g=Math.min(1.2,bs*.08);s+=`<path class="vz-wedge" d="M${vq(X(-bs/2))} ${vq(Y(w0))}L${vq(X(-bs/2-g))} ${vq(Y(w0+1))}L${vq(X(-bs/2-g))} ${vq(Y(w0+2.5))}L${vq(X(-bs/2))} ${vq(Y(w0+3.5))}H${vq(X(bs/2))}L${vq(X(bs/2+g))} ${vq(Y(w0+2.5))}L${vq(X(bs/2+g))} ${vq(Y(w0+1))}L${vq(X(bs/2))} ${vq(Y(w0))}Z${R(Rb+4,Rb+4.5,-bs/2,bs/2)}${R(M.rTop0+M.hcs,M.rBot0,-bs/2,bs/2)}${R(Rb+M.hs-.5,Rb+M.hs,-bs/2,bs/2)}"/>`;
 const rows=(M.z/2)*M.Nelh,Wcu=M.Nelb*(M.bel+M.disB),Hcu0=rows*(M.ael+M.disA)+Math.max(0,M.z/2-1)*M.insTurn,kh=Hcu0>M.hcs?M.hcs/Hcu0:1;let cu='',ins='';
 for(let l=0;l<2;l++){const r0=l?M.rBot0:M.rTop0;ins+=R(r0,r0+M.hcs,-M.wc/2,M.wc/2);const wb=r0+(M.hcs-Hcu0*kh)/2;
  for(let t=0;t<M.z/2;t++)for(let rI=0;rI<M.Nelh;rI++){const w=wb+((t*M.Nelh+rI)*(M.ael+M.disA)+t*M.insTurn+M.disA/2)*kh;for(let ci=0;ci<M.Nelb;ci++){const u=-Wcu/2+ci*(M.bel+M.disB)+M.disB/2;cu+=R(w,w+M.ael*kh,u,u+M.bel)}}}
 s+=`<path class="vz-ins" d="${ins}"/><path class="vz-cuS" d="${cu}"/>`;
 s+=vzDim(X(-bs/2),Y(Rb),X(bs/2),Y(Rb),14,`bs ${vzF1(bs)}`)+vzDim(X(-wmm/2),Y(Rb),X(-wmm/2),Y(Rb+M.hs),-12,`hs ${vzF1(M.hs)}`);
 const lx=X(wmm/2)+16,lab=(w,txt)=>vzLeader([[X(bs*.2),Y(w)],[lx,Y(w)],[lx+8,Y(w)]],txt,'start','vz-s');
 s+=lab(Rb+2.2,`Cunha ${fmt(3.5,1)} mm`)+lab(M.rTop0+M.hcs*.5,'Lado junto à cunha')+lab(M.rBot0+M.hcs*.5,'Lado do fundo')+lab(M.rBot0+M.hcs+.2,'Separadores 0,5 mm');
 s+=`<text class="vz-s" x="${vq(lx)}" y="${vq(Y(M.rBot0+M.hcs*.5)+28)}">${M.z/2} espiras por lado</text><text class="vz-s" x="${vq(lx)}" y="${vq(Y(M.rBot0+M.hcs*.5)+42)}">Condutor ${vzF2(M.ael)} × ${vzF2(M.bel)} mm</text><text class="vz-s" x="${vq(lx)}" y="${vq(Y(M.rBot0+M.hcs*.5)+56)}">${M.Nelb*M.Nelh} por espira (${M.Nelh} × ${M.Nelb})</text>`;
 return s+'</g>'}
function vzLastS(){return viz.D&&viz.D.view==='detail'?viz.D.s:0}
function vzTickDetail(M,D,thm){
 D.e.st.setAttribute('transform',`rotate(${(thm*180/PI).toFixed(3)} ${vq(D.cx)} ${vq(D.cy)})`);
 const kc=Math.round(thm*M.Qs/(2*PI));if(kc!==D.kc){D.kc=kc;D.e.sc.innerHTML=vzDetailSlots(M,D,thm);D.k=[0,1,2,3,4,5].map(c=>$('vz-k'+c));D.dot=[0,1,2,3,4,5].map(c=>$('vz-d'+c));D.cro=[0,1,2,3,4,5].map(c=>$('vz-x'+c));if(viz.sel)vzMark(viz.sel)}
 const nom=viz.regime==='nominal',I=vizCurrents(M,thm,nom,VZ_I6),Im=M.kc*M.Im||1;
 for(let c=0;c<6;c++){const v=I[c]/Im;if(D.k[c])D.k[c].style.fill=vzCurCol(v);if(D.dot[c]){D.dot[c].style.opacity=v<-.06?Math.min(1,-v*1.4).toFixed(2):'0';D.cro[c].style.opacity=v>.06?Math.min(1,v*1.4).toFixed(2):'0'}}
 if(viz.layers.flux&&D.e.chB){const C=D.chart,Fs=nom?vizMMF(M,I):null,Ff=nom?M.FfN:M.Ff0,Kn=nom?M.KnN:M.Kn0,thd=PI/2+thm;let d='';
  for(let i=0;i<=C.N;i++){const xe=-PI+2*PI*i/C.N,b=Kn*vizBat(M,thd+xe/M.p,thd,Ff,Fs,nom);d+=(i?'L':'M')+vq(C.x0+(C.x1-C.x0)*i/C.N)+' '+vq(C.ym-b*C.ck)}D.e.chB.setAttribute('d',d)}
}

/* ---------- ciclo de desenho e animação ---------- */
function vzBuild(){
 const svg=$('machine-svg');if(!svg)return;const L=vzSize();viz.L=L;viz.w=($('mwrap')&&$('mwrap').clientWidth)||0;
 const M=viz.M||(viz.M=vizModel()),R=viz.view==='axial'?vzAxial(M,L):viz.view==='detail'?vzDetail(M,L):vzRadial(M,L),D=R.D;
 svg.setAttribute('viewBox',`0 0 ${L.W} ${L.H}`);svg.innerHTML=R.svg;viz.D=D;D.e={};
 if(D.view==='radial'){D.rot=$('vz-rot');D.cur=[0,1,2,3,4,5].map(c=>$('vz-c'+c));D.dot=[0,1,2,3,4,5].map(c=>$('vz-d'+c));D.cro=[0,1,2,3,4,5].map(c=>$('vz-x'+c));D.hp=$('vz-hp');D.hn=$('vz-hn');
  D.hl=[];for(let j=0;j<M.P;j++){const e=$('vz-hl'+j);if(e)D.hl.push(e)}D.ups.forEach((u,i)=>{u.el=u.bal?$('vz-up'+i):svg.querySelector(`[data-up="${i}"]`)});D.gapA=$('vz-gapA')}
 else if(D.view==='axial'){for(const k of ['shoe','fl','sl','be','rg','ce','key'])D.e[k]=$('vz-'+k);for(const k of ['at0','at1','ab0','ab1'])D.e[k]=$('vz-'+k)}
 else{D.e.st=$('vz-dst');D.e.sc=$('vz-dsc');D.e.chB=$('vz-chB');D.k=[];D.dot=[];D.cro=[]}
 vzApplyLayers();vzMark(viz.sel);vzUI();vzDraw(performance.now(),true);vzLoop();
}
function vzThm(){const M=viz.M;return M?2*PI*(M.n/60)/viz.slow*viz.t:0}
function vzDraw(now,force){
 const M=viz.M,D=viz.D;if(!M||!D)return;const thm=vzThm();
 if(D.view==='radial'){const deg=thm*180/PI;D.rot.setAttribute('transform',`rotate(${(-deg).toFixed(3)} ${vq(D.cx)} ${vq(D.cy)})`);
  for(const u of D.ups)if(u.el)u.el.setAttribute('transform',`rotate(${deg.toFixed(2)} ${u.x} ${u.y})`);
  const nom=viz.regime==='nominal',I=vizCurrents(M,thm,nom,VZ_I6),Im=M.kc*M.Im||1;
  for(let c=0;c<6;c++){const v=I[c]/Im;if(D.cur[c])D.cur[c].style.fill=vzCurCol(v);if(D.dot[c]){D.dot[c].style.opacity=v<-.06?Math.min(1,-v*1.4).toFixed(2):'0';D.cro[c].style.opacity=v>.06?Math.min(1,v*1.4).toFixed(2):'0'}}
  if(viz.layers.flux)vzHalo(M,D,thm,nom,I)}
 else if(D.view==='axial')vzTickAxial(M,D,thm);else vzTickDetail(M,D,thm);
 if(force||now-viz.txt>110){viz.txt=now;vzLive(thm)}
}
function vzFrame(now){viz.raf=0;if(!viz.playing||!viz.onScreen||document.hidden){viz.last=0;return}const dt=viz.last?Math.min(.1,(now-viz.last)/1000):0;viz.last=now;viz.t+=dt;vzDraw(now);viz.raf=requestAnimationFrame(vzFrame)}
function vzLoop(){if(viz.playing&&!viz.raf&&viz.onScreen&&!document.hidden){viz.last=0;viz.raf=requestAnimationFrame(vzFrame)}}
function vzStop(){if(viz.raf)cancelAnimationFrame(viz.raf);viz.raf=0;viz.last=0}
function setPlaying(on){viz.playing=!!on;const b=$('vz-play');if(b){b.setAttribute('aria-pressed',String(viz.playing));b.classList.toggle('paused',!viz.playing);$('vz-play-t').textContent=viz.playing?'Pausar':'Girar'}if(viz.playing)vzLoop();else{vzStop();vzDraw(performance.now(),true)}}
function setView(view){viz.view=view;document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===view;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});vzBuild()}
function vzApplyLayers(){const svg=$('machine-svg');if(!svg)return;for(const [k,on] of Object.entries(viz.layers))svg.querySelectorAll(`[data-layer="${k}"]`).forEach(e=>{if(on)e.removeAttribute('display');else e.setAttribute('display','none')});
 document.querySelectorAll('#part-legend input[data-layer]').forEach(i=>{i.checked=!!viz.layers[i.dataset.layer];i.closest('label').classList.toggle('off',!i.checked)})}
function vzMark(id){const svg=$('machine-svg');if(!svg)return;svg.querySelectorAll('.vz-on').forEach(e=>e.classList.remove('vz-on'));if(id)svg.querySelectorAll(`.vz-part[data-part="${id}"]:not(.vz-prow)`).forEach(e=>e.classList.add('vz-on'));svg.querySelectorAll('.vz-prow').forEach(e=>e.classList.toggle('vz-sel',e.dataset.part===id))}
function vzPartInfo(id,M){
 const ill=M.ok?'':' Valores ilustrativos: o cálculo está interrompido.',mat=M.damperMat==='copper'?'cobre':'latão',nom=viz.regime==='nominal';
 const T={
  stator:['Núcleo do estator',`Ø${vzF0(M.Dse)} × Ø${vzF0(M.Ds)} mm, com jugo de ${vzF1(M.hYoke)} mm atrás das ranhuras. ${M.Qs} ranhuras abertas de ${vzF1(M.bs)} × ${vzF1(M.hs)} mm. Comprimento ${vzF0(M.ls)} mm em ${M.nPk} pacotes de ${vzF0(M.lpk)} mm separados por dutos radiais de ${vzF0(M.duct)} mm.`,'§2.3 · §3.31–3.37'],
  winding:['Enrolamento da armadura',`Duas camadas em ${M.Qs} ranhuras, qₛ = ${fmtQ(M.q)}, passo de ${M.y} ranhuras (β = ${fmt(M.y*M.P/M.Qs,2)}). ${M.z} condutores por ranhura, ${M.a} caminho${M.a>1?'s':''} em paralelo. A cor de cada lado de bobina segue a corrente instantânea da sua fase: saindo do plano (⊙) ou entrando (⊗). A faixa de correntes gira junto com o rotor.`,'§3.6–3.30'],
  gap:['Entreferro',`${vzF1(M.delta)} mm no eixo do polo e ${vzF1(M.deltaMax)} mm nas bordas (δmax = 1,5 δ), obtidos com a sapata de raio ${vzF0(M.rp)} mm, menor que o raio do furo. O detalhe A mostra a folga em escala real, com as barras e as ranhuras passando.`,'§4.1–4.2 · §4.7'],
  pole:['Polo saliente',`Sapata com arco bpe = ${vzF1(M.bpe)} mm (αₑ τp) e altura ${vzF1(M.hp1)} mm no eixo; corpo de ${vzF1(M.bp)} × ${vzF1(M.hp2)} mm. ${viz.arch==='integral'?'Polos e jugo saem da mesma chapa estampada.':'Pacote polar próprio, encaixado na coroa; a cauda de andorinha é ilustrativa.'}`,'§4.4–4.7 · §4.17'],
  coil:['Bobina de campo (CC)',`${M.NE} espiras de cobre ${vzF2(M.aE)} × ${vzF1(M.bE)} mm enroladas de cutelo, entre quadros isolantes de ${vzF1(M.dph)} mm. ${M.fits?'Cabe no corpo polar.':`Não cabe: exige ${vzF0(M.hcoil+2*M.dph+1)} mm de corpo e o polo tem ${vzF0(M.hp2)} mm. O contorno tracejado mostra a altura necessária.`}${Number.isFinite(M.IEN)?` Corrente nominal ${vzF0(M.IEN)} A.`:''}`,'§6'],
  damper:['Gaiola amortecedora',`${M.Ndm} barras de ${mat} Ø${vzF1(M.ddm)} mm por polo, passo τr = ${vzF1(M.tr)} mm (τs = ${vzF1(M.tauS)} mm), a ${vzF1(M.bp1)} mm da borda. Anéis de ${vzF2(M.ringA)} × ${vzF1(M.ringB)} mm nas extremidades. Em regime síncrono as barras não conduzem.`,'§4.8–4.14'],
  yoke:[viz.arch==='integral'?'Jugo do rotor':'Coroa do rotor',`Ø${vzF0(M.dyr)} mm sob os polos. Altura magnética necessária hyr = ${vzF1(M.hyr)} mm, marcada pelo círculo tracejado. ${viz.arch==='integral'?'O pacote de chapas continua até o eixo.':'A coroa se apoia nos braços da aranha.'}`,'§4.18 · §5.2'],
  spider:['Aranha (ilustrativa)','Braços e cubo ligam a coroa ao eixo. O manual não dimensiona a aranha: forma e número de braços são apenas indicativos.','—'],
  shaft:['Eixo',`Ø${vzF0(M.shaft)} mm sob o rotor (Tab. 4.3). Chaveta e pontas de eixo são ilustrativas.`,'§4.18'],
  flux:['Onda de B no entreferro',`Indução radial por FMM × permeância: campo dos polos mais as correntes reais das ranhuras, sobre a folga δ(x) da sapata e as aberturas das ranhuras (Carter ${fmt(M.KCs,3)}). Sem saturação; amplitude ajustada a Bδ = ${fmt(nom?M.BdN:M.Bd0,3)} T do cálculo. Lóbulos cheios: N, fluxo saindo do rotor. Hachurados: S.`,'§3.16 · §5.1'],
  packets:['Pacotes e dutos radiais',`${M.nPk} pacotes de ${vzF0(M.lpk)} mm e ${M.nPk-1} dutos de ${vzF0(M.duct)} mm somam ls = ${vzF0(M.ls)} mm.`,'§2.4'],
  ends:['Cabeças da armadura',`Avanço axial de ${vzF0(M.lFh1)} mm além do pacote${Number.isFinite(M.lFh)?`; cada cabeça mede ${vzF0(M.lFh)} mm em média`:''}. A forma no corte é simplificada.`,'§3.43–3.45'],
  ring:['Anéis de curto-circuito',`Segmentos de ${vzF2(M.ringA)} × ${vzF1(M.ringB)} mm unem as barras de cada polo, a ${vzF0(M.lfhr)} mm do flange.`,'§4.9–4.11 · §4.16'],
  flange:['Placas de aperto do polo',`Flanges de ${vzF0(M.lp1)} mm em cada extremidade do pacote polar (Tab. 4.1).`,'§4.5']};
 const r=T[id];return r?[r[0],r[1]+ill,r[2]]:null}
function vzInspect(id){viz.sel=id;vzMark(id);vzUI()}
function vzUI(){
 const M=viz.M;if(!M)return;const integral=viz.arch==='integral';
 document.querySelectorAll('[data-arch]').forEach(b=>{const on=b.dataset.arch===viz.arch;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});
 document.querySelectorAll('[data-regime]').forEach(b=>{const on=b.dataset.regime===viz.regime;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});
 document.querySelectorAll('[data-slow]').forEach(b=>{const on=Number(b.dataset.slow)===viz.slow;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});
 $('construction-text').innerHTML=integral?'<b>Um pacote contínuo.</b> Cada chapa já traz jugo e polos; o eixo passa pelo furo central. Sem aranha e sem encaixes. <a href="#ref-nidec">[1]</a>':'<b>Polos encaixados na coroa.</b> Cada polo é um pacote próprio preso à coroa; a aranha liga a coroa ao cubo do eixo. <a href="#ref-nidec">[1]</a>';
 $('viz-source').textContent=M.ok?(M.fails?`Geometria do cálculo atual · ${M.fails} incompatibilidade${M.fails>1?'s':''} assinalada${M.fails>1?'s':''} no desenho`:'Geometria do cálculo atual · desenho vetorial em escala'):'Cálculo interrompido · proporções ilustrativas';
 const info=viz.sel&&vzPartInfo(viz.sel,M),pi=$('part-inspector');
 pi.innerHTML=info?`<span class="vz-k">Peça selecionada · ${info[2]}</span><b>${info[0]}</b><p>${info[1]}</p>`:`<span class="vz-k">Peças</span><b>Clique no desenho ou na lista de peças</b><p>As cotas vêm do cálculo ao lado: mude potência, polos ou qualquer parâmetro e o desenho se refaz em escala. Ilustrativos só a aranha, a chaveta e a forma das cabeças.</p>`;
 $('vz-n').textContent=`${vzF0(M.n)} rpm · ${vzF0(M.f)} Hz`;
 $('spin-note').textContent=`1 s na tela = ${fmt(1000/viz.slow,viz.slow>=1000?1:0)} ms reais · rotor, correntes e campo no mesmo relógio`;
}
function vzLive(thm){
 const M=viz.M;if(!M)return;const mech=((thm*180/PI)%360+360)%360,el=(mech*M.p)%360,nom=viz.regime==='nominal';
 $('vz-ns').textContent=`${fmt(M.n/viz.slow,M.n/viz.slow<10?2:1)} rpm (1:${viz.slow})`;$('vz-ang').textContent=`${vzF0(mech)}° mec · ${vzF0(el)}° el`;
 const e=M.p*thm+M.rho-PI/2;['a','b','c'].forEach((k,i)=>{const v=nom?Math.cos(e-2*PI*i/3):0,bar=$('vz-i'+k);bar.style.transform=`scaleX(${v.toFixed(3)})`;$('vz-v'+k).textContent=`${v>=0?'+':'−'}${vzF0(Math.abs(v*M.Im))} A`});
 $('vz-thl').textContent=M.gen?'Rotor à frente de Φδ':'Rotor atrás de Φδ';$('vz-th').textContent=nom?`${fmt(Math.abs(M.betaN)*180/PI,1)}° el · θN ${fmt(M.th*180/PI,1)}°`:'0° (sem carga)';
 $('vz-b1').textContent=`${fmt(nom?M.B1N:M.B10,3)} T`;
 const D=viz.D;if(D&&D.gapA){const r=vzWrap(D.loupe.phiA-(PI/2+thm)),pit=2*PI/M.P,j=Math.round(r/pit),pl=Math.abs(r-j*pit),g=M.gT[Math.min(M.NT,(pl/M.hpA*M.NT)|0)];D.gapA.textContent=pl<=M.phiE?`folga em A: ${vzF1(g)} mm`:'folga em A: região interpolar'}
}
function renderVisual(){
 const P=safePoles();
 $('pair-summary').textContent=`P = ${P} polos · p = ${P/2} pares · ligação Y / 3 fases`;
 $('power-label').textContent=values.type==='motor'?'Potência mecânica no eixo':'Potência aparente nominal';
 document.querySelectorAll('[data-pole]').forEach(b=>b.classList.toggle('on',Number(b.dataset.pole)===P));
 const f=Number(values.freq)||50;$('speed-experiment').innerHTML=[4,6,8,12].map(p=>`<button data-pole="${p}" class="${P===p?'on':''}" aria-label="Explorar ${p} polos"><b>${fmt(120*f/p,0)}</b>${p} polos / rpm</button>`).join('');
 $('dq-equation').textContent=`90° el = ${fmt(180/P,P>20?2:1)}° mec`;
 $('rotor-method-note').innerHTML=`<b>Geometria do modelo de referência.</b> As expressões abaixo dimensionam polo e jugo conforme o manual. ${viz.arch==='integral'?'O diâmetro de raiz é uma cota auxiliar: o núcleo integral não possui uma roda polar independente.':'O diâmetro de raiz não dimensiona sozinho braços, coroa ou fixações da aranha.'} O visualizador da seção 02 desenha polo, sapata, bobina e jugo com estas dimensões.`;
 viz.M=vizModel();vzBuild();
}
function selectPoles(P){values.poles=Number(P);syncQuick();$('quick-poles').removeAttribute('aria-invalid');$('quick-error').textContent='';markModified();renderAll()}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2500)}
const VZ_SVG_CSS=`.vz-paper{fill:var(--bg2)}.vz-fr0{fill:none;stroke:var(--line2);stroke-width:.7}.vz-fr1{fill:none;stroke:var(--text3);stroke-width:1.1}
.vz-z{font:9px ui-monospace,SFMono-Regular,Consolas,monospace;fill:var(--text3)}.vz-t{font:500 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:var(--text2)}.vz-s{font:10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:var(--text3)}.vz-h{font:650 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:var(--text)}.vz-n{font:10.5px ui-monospace,SFMono-Regular,Consolas,monospace;fill:var(--text)}
.vz-dim{font:500 10px ui-monospace,SFMono-Regular,Consolas,monospace;fill:var(--text);paint-order:stroke;stroke:var(--bg2);stroke-width:3px;stroke-linejoin:round}.vz-dl{fill:none;stroke:var(--text2);stroke-width:.75}.vz-dle{fill:none;stroke:var(--text3);stroke-width:.6}.vz-ah{fill:var(--text2)}
.vz-ld{fill:none;stroke:var(--text3);stroke-width:.7}.vz-ldd{fill:var(--text3)}.vz-cl{fill:none;stroke:var(--text3);stroke-width:.7;stroke-dasharray:14 3 2 3}.vz-bk{fill:none;stroke:var(--text3);stroke-width:.8}
.vz-pst{fill:var(--st)}.vz-phs{stroke:var(--st2);stroke-width:.7;opacity:.55}.vz-pfe{fill:var(--iron)}.vz-phr{stroke:var(--iron2);stroke-width:.7;opacity:.55}.vz-prm{fill:var(--iron)}.vz-psp{fill:var(--st)}.vz-phn{stroke:var(--acc);stroke-width:.8;opacity:.7}
.vz-st{fill:url(#vz-hs);stroke:var(--st2);stroke-width:.6}.vz-fe{fill:url(#vz-hr);stroke:var(--iron2);stroke-width:.7}.vz-rim{fill:url(#vz-hm);stroke:var(--iron2);stroke-width:.7}.vz-sp{fill:url(#vz-hsp);stroke:var(--st2);stroke-width:.6}
.vz-wedge,.vz-wedgeA{fill:var(--vz-wedge)}.vz-ins{fill:var(--vz-ins)}.vz-cav{fill:var(--bg2)}.vz-cs{stroke:var(--copper2);stroke-width:.35}.vz-cu,.vz-cuS{fill:var(--copper);stroke:var(--copper2);stroke-width:.4}.vz-cuL{fill:none;stroke:var(--copper2);stroke-width:.45}
.vz-br{fill:var(--brass);stroke:var(--copper2);stroke-width:.4}.vz-sh,.vz-shb{stroke:var(--st2);stroke-width:.8}.vz-sh{fill:var(--shaft)}.vz-kw{fill:var(--bg2);stroke:var(--st2);stroke-width:.5}.vz-key{fill:var(--st2);stroke:var(--text3);stroke-width:.4}
.vz-bad{fill:none;stroke:var(--bad);stroke-width:1.1;stroke-dasharray:4 3}.vz-sym{fill:none;stroke:var(--bg2);stroke-width:.8}.vz-symf{fill:var(--bg2)}.vz-symw{fill:none;stroke:var(--bg2);stroke-width:1.1}.vz-symfw{fill:var(--bg2)}.vz-sym2{fill:none;stroke:var(--copper2);stroke-width:1}.vz-symf2{fill:var(--copper2)}
.vz-h0{fill:none;stroke:var(--acc);stroke-width:.6;opacity:.5}.vz-hpos{fill:var(--acc);fill-opacity:.24;stroke:var(--acc);stroke-width:1;stroke-linejoin:round}.vz-hneg{fill:url(#vz-hn);stroke:var(--acc);stroke-width:.8;stroke-opacity:.75;stroke-linejoin:round}.vz-hl{font:650 10px ui-monospace,SFMono-Regular,Consolas,monospace;fill:var(--acc)}
.vz-ax-d{fill:none;stroke:var(--acc);stroke-width:.9;stroke-dasharray:12 3 2 3}.vz-ax-q{fill:none;stroke:var(--text3);stroke-width:.8;stroke-dasharray:12 3 2 3}.vz-axl{font:650 11px ui-monospace,SFMono-Regular,Consolas,monospace;paint-order:stroke;stroke:var(--bg2);stroke-width:3px}.vz-axdt{fill:var(--acc)}.vz-axqt{fill:var(--text3)}
.vz-vf{fill:none;stroke:var(--copper);stroke-width:2.4}.vz-vfh,.vz-vft{fill:var(--copper)}.vz-va{fill:none;stroke:var(--vz-fa);stroke-width:2.4}.vz-vah,.vz-vat{fill:var(--vz-fa)}.vz-vb{fill:none;stroke:var(--acc);stroke-width:2.8}.vz-vbh,.vz-vbt{fill:var(--acc)}.vz-ang{fill:none;stroke:var(--acc);stroke-width:.9}
.vz-pl{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:700;fill:var(--bg)}.vz-hyr{fill:none;stroke:var(--iron2);stroke-width:.8;stroke-dasharray:4 3}
.vz-bal{fill:var(--bg2);stroke:var(--text2);stroke-width:.8}.vz-bn{font:650 9.5px ui-monospace,SFMono-Regular,Consolas,monospace;fill:var(--text)}.vz-tbbox{fill:var(--bg2);stroke:var(--text3);stroke-width:1.1}.vz-tbl{fill:none;stroke:var(--line2);stroke-width:.7}.vz-sbf{fill:var(--text2)}.vz-sbo{fill:none;stroke:var(--text2);stroke-width:.7}
.vz-prbg{fill:transparent}.vz-prow:hover .vz-prbg,.vz-prow:focus-visible .vz-prbg,.vz-prow.vz-sel .vz-prbg{fill:var(--accw);stroke:var(--acc);stroke-width:.6}.vz-part{cursor:pointer;outline:none}
.vz-on path:not(.vz-ld),.vz-on circle:not(.vz-ldd),.vz-on rect{stroke:var(--acc)!important;stroke-width:1.5px!important;stroke-opacity:1!important}
.vz-lring{fill:none;stroke:var(--text2);stroke-width:1.4}.vz-src{fill:none;stroke:var(--text2);stroke-width:1}.vz-tan{fill:none;stroke:var(--text3);stroke-width:.7}
.vz-sec{fill:none;stroke:var(--text2);stroke-width:.8;stroke-dasharray:16 3 2 3}.vz-sec-end{stroke:var(--text);stroke-width:2.4}
.vz-tooth{fill:var(--st);opacity:.55}.vz-axo{stroke:var(--bg2);stroke-width:.5}.vz-flg{fill:var(--st2);stroke:var(--bg2);stroke-width:.5}.vz-slot{fill:none;stroke:var(--iron2);stroke-width:1}.vz-ykb{stroke:var(--bg2);stroke-width:.5}
.vz-grid{stroke:var(--line);stroke-width:.7;fill:none}.vz-chbox{fill:none;stroke:var(--line2);stroke-width:.8}.vz-chart{fill:none;stroke:var(--acc);stroke-width:1.7;stroke-linejoin:round}.vz-chf{fill:none;stroke:var(--text2);stroke-width:.9;stroke-dasharray:5 3}.vz-ch0{fill:none;stroke:var(--text3);stroke-width:1;stroke-dasharray:1.5 2.5}.vz-pole-sh{fill:var(--accw)}`;
function exportSVG(){
 const svg=$('machine-svg').cloneNode(true),L=viz.L||{W:1000,H:660};svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',L.W*2);svg.setAttribute('height',L.H*2);
 const cs=getComputedStyle(document.documentElement),vars=['bg','bg2','panel','panel2','line','line2','text','text2','text3','acc','accw','info','bad','st','st2','iron','iron2','copper','copper2','brass','shaft','vz-in','vz-out','vz-fa','vz-ins','vz-wedge','vz-fehi','vz-cuhi','vz-brhi','vz-shhi'];
 const st=document.createElementNS('http://www.w3.org/2000/svg','style');st.textContent='svg{'+vars.map(k=>`--${k}:${cs.getPropertyValue('--'+k).trim()};`).join('')+'}'+VZ_SVG_CSS;svg.insertBefore(st,svg.firstChild);
 download(`maquina-sincrona-${viz.M?viz.M.P:safePoles()}-polos-${viz.view}.svg`,new XMLSerializer().serializeToString(svg),'image/svg+xml');toast('Vista vetorial exportada.');
}
function setupVisual(){
 if(!$('vz-svg-css')){const st=document.createElement('style');st.id='vz-svg-css';st.textContent=VZ_SVG_CSS;document.head.appendChild(st)}
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)viz.slow=1000;
 $('pole-shortcuts').innerHTML=[2,4,6,8,10,12,16,20].map(P=>`<button data-pole="${P}" aria-label="Explorar ${P} polos">${P}</button>`).join('');
 document.addEventListener('click',e=>{const p=e.target.closest('[data-pole]');if(p)selectPoles(p.dataset.pole)});
 document.querySelectorAll('[data-arch]').forEach(b=>b.onclick=()=>{viz.arch=b.dataset.arch;values.construction=viz.arch;markModified();vzBuild()});
 document.querySelectorAll('[data-regime]').forEach(b=>b.onclick=()=>{viz.regime=b.dataset.regime;vzBuild()});
 document.querySelectorAll('[data-slow]').forEach(b=>b.onclick=()=>{const th=vzThm();viz.slow=Number(b.dataset.slow);const M=viz.M;if(M&&M.n)viz.t=th/(2*PI*(M.n/60)/viz.slow);vzUI();vzDraw(performance.now(),true)});
 const tabs=[...document.querySelectorAll('[data-view]')];tabs.forEach((b,i)=>{b.onclick=()=>setView(b.dataset.view);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setView(tabs[j].dataset.view);tabs[j].focus()}});
 document.querySelectorAll('#part-legend input[data-layer]').forEach(e=>e.onchange=()=>{viz.layers[e.dataset.layer]=e.checked;vzApplyLayers();vzDraw(performance.now(),true)});
 const svg=$('machine-svg');svg.addEventListener('click',e=>{const p=e.target.closest('.vz-part[data-part]');if(p)vzInspect(p.dataset.part)});
 svg.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const p=e.target.closest('.vz-part[data-part]');if(p){e.preventDefault();vzInspect(p.dataset.part)}});
 $('vz-play').onclick=()=>setPlaying(!viz.playing);
 $('show-axial').onclick=()=>{setView('axial');$('visual-title').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})};
 $('mobile-load').onclick=()=>$('btn-load').click();$('mobile-print').onclick=()=>$('btn-print').click();
 const mq=matchMedia('(max-width:1050px)');const syncSide=()=>{$('side').inert=mq.matches&&!$('side').classList.contains('open')};mq.addEventListener('change',syncSide);syncSide();
 $('btn-svg').onclick=exportSVG;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)vzStop();else vzLoop()});
 if('IntersectionObserver' in window)new IntersectionObserver(es=>{for(const e of es){viz.onScreen=e.isIntersecting;if(viz.onScreen)vzLoop();else vzStop()}},{rootMargin:'120px'}).observe(document.querySelector('.visual-lab'));
 let rt;if('ResizeObserver' in window)new ResizeObserver(()=>{const w=$('mwrap').clientWidth;if(Math.abs(w-viz.w)<6)return;clearTimeout(rt);rt=setTimeout(vzBuild,140)}).observe($('mwrap'));
 new MutationObserver(()=>{vzColors();vzDraw(performance.now(),true)}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const side=$('side');$('btn-side').onclick=()=>{openSide(true);side.querySelector('button').focus()};
}
