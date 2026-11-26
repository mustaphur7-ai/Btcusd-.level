window.XChart=(()=>{const cv=document.querySelector('canvas'),g=cv.getContext('2d'),msg=document.querySelector('#msg'),nowBtn=document.querySelector('#now');
let c=[],tf='5m',lv=[],price,count=80,off=0,cross=null,layers=[],pts=new Map(),last,pinch,hold;
const R=76,B=24,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const time=(t,full)=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Nairobi',...(full?{day:'2-digit',month:'short'}:{}),hour:'2-digit',minute:'2-digit',hour12:false});
function draw(){const W=cv.clientWidth,H=cv.clientHeight,d=devicePixelRatio||1;if(!W)return;cv.width=W*d;cv.height=H*d;g.setTransform(d,0,0,d,0,0);g.font='11px system-ui';
nowBtn.hidden=off<1;if(!c.length)return;const on=layers.filter(l=>l.enabled),pw=W-R-on.reduce((s,l)=>s+(l.panelWidth||0),0),ph=H-B;
const end=c.length-Math.round(off),v=c.slice(Math.max(0,end-Math.round(count)),end),step=pw/count,x0=pw-v.length*step;
const all=lv.concat(on.flatMap(l=>l.lines||[]));let lo=Math.min(...v.map(k=>k.l)),hi=Math.max(...v.map(k=>k.h));const ref=price||v.at(-1).c;
all.forEach(l=>{if(Math.abs(l.price/ref-1)<=.03){lo=Math.min(lo,l.price);hi=Math.max(hi,l.price)}});const pad=(hi-lo)*.06||1;lo-=pad;hi+=pad;
const y=p=>(hi-p)/(hi-lo)*ph,api={g,y,width:pw,height:ph,candles:v};
const line=(p,col,dash)=>{g.strokeStyle=col;g.setLineDash(dash);g.beginPath();g.moveTo(0,y(p));g.lineTo(pw,y(p));g.stroke();g.setLineDash([])};
const tag=(t,ty,col)=>{g.fillStyle=col;g.fillRect(W-R,ty-8,R,16);g.fillStyle='#0e1116';g.fillText(t,W-R+3,ty+4)};
on.forEach(l=>l.draw?.('back',api));
for(let i=0;i<=5;i++){const p=lo+(hi-lo)*i/5;g.fillStyle='#8b949e';g.fillText(Math.round(p).toLocaleString('en-US'),W-R+3,y(p)-2)}
for(let i=0;i<v.length;i+=Math.ceil(80/step)){g.fillStyle='#8b949e';g.fillText(time(v[i].t),x0+i*step,H-7)}
v.forEach((k,i)=>{const x=x0+(i+.5)*step;g.fillStyle=g.strokeStyle=k.c>=k.o?'#26a69a':'#ef5350';g.beginPath();g.moveTo(x,y(k.h));g.lineTo(x,y(k.l));g.stroke();g.fillRect(x-step*.35,y(Math.max(k.o,k.c)),step*.7,Math.max(1,Math.abs(y(k.o)-y(k.c))))});
const vis=all.filter(l=>l.price>lo&&l.price<hi).sort((a,b)=>b.price-a.price);let prev=-20;
const ys=vis.map(l=>prev=Math.max(y(l.price),prev+17));let lim=ph-8;for(let i=ys.length-1;i>=0;i--){ys[i]=Math.min(ys[i],lim);lim=ys[i]-17}
vis.forEach((l,i)=>{line(l.price,l.color,l.dash?[6,4]:[]);tag(`${(l.name||l.label).replace('Call wall','CW').replace('Put wall','PW').replace('Gamma flip','Flip')} ${Math.round(l.price)}`,ys[i],l.color)});
if(price&&price>lo&&price<hi){line(price,'#fff',[2,3]);tag(price.toFixed(2),y(price),'#fff')}
on.forEach(l=>{l.draw?.('front',api);l.draw?.('panel',api)});
if(cross){const i=clamp(Math.floor((cross.x-x0)/step),0,v.length-1),k=v[i],p=hi-cross.y/ph*(hi-lo);line(p,'#8b949e',[3,3]);g.strokeStyle='#8b949e';g.beginPath();g.moveTo(x0+(i+.5)*step,0);g.lineTo(x0+(i+.5)*step,ph);g.stroke();
msg.innerHTML=`${time(k.t,1)}<br>O ${k.o} H ${k.h}<br>L ${k.l} C ${k.c}<br>Price ${p.toFixed(2)}`}else msg.textContent=''}
async function poll(){const want=tf;let wait=5000;try{const full=!c.length,r=await klines(want,full?300:2);if(want===tf){r.forEach(a=>{const k={t:a[0],o:+a[1],h:+a[2],l:+a[3],c:+a[4]},z=c.at(-1);if(z&&z.t===k.t)c[c.length-1]=k;else if(!z||k.t>z.t){c.push(k);if(off>0)off++}});
if(c.length>500)c=c.slice(-500);draw()}}catch(e){msg.textContent='Chart data unavailable, retrying'}if(want===tf)timer=setTimeout(poll,wait)}
let timer;const bar=document.querySelector('#tf');['1m','5m','15m','1h','4h'].forEach(t=>{const b=document.createElement('button');b.textContent=t;b.className=t===tf?'sel':'';b.onclick=()=>{tf=t;c=[];off=0;clearTimeout(timer);[...bar.children].forEach(x=>x.className=x===b?'sel':'');draw();msg.textContent='Loading chart';poll()};bar.append(b)});
const zoom=f=>{count=clamp(count*f,20,300);draw()},pos=e=>({x:e.offsetX,y:e.offsetY}),dist=()=>{const[a,b]=[...pts.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,pos(e));last=pos(e);clearTimeout(hold);if(pts.size===2)pinch=dist();else if(e.pointerType!=='mouse')hold=setTimeout(()=>{cross=last;draw()},400)};
cv.onpointermove=e=>{const p=pos(e);if(pts.has(e.pointerId))pts.set(e.pointerId,p);if(pts.size===2){const d=dist();if(d){zoom(pinch/d);pinch=d}return}
if(cross&&pts.size){cross=p}else if(pts.size){if(Math.abs(p.x-last.x)<4)return;clearTimeout(hold);off=clamp(off+(p.x-last.x)/((cv.clientWidth-R)/count),0,Math.max(0,c.length-20));last=p;cross=null}else if(e.pointerType==='mouse')cross=p;draw()};
cv.onpointerup=cv.onpointercancel=cv.onpointerleave=e=>{pts.delete(e.pointerId);clearTimeout(hold);cross=null;draw()};
cv.addEventListener('touchmove',e=>{if(cross||e.touches.length>1)e.preventDefault()},{passive:false});
cv.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.1:.9)},{passive:false});
nowBtn.onclick=()=>{off=0;draw()};new ResizeObserver(draw).observe(cv);setTimeout(poll);
return{addLayer:l=>{layers.push(l);draw()},setPrice:p=>{price=p;draw()},setLevels:l=>{lv=l;draw()},setSignal:s=>{layers=layers.filter(l=>!l.signal);if(s)layers.push({signal:1,enabled:true,lines:s});draw()},redraw:draw}})();
