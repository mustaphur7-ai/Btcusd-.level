const $=s=>document.querySelector(s),SRC=['https://fapi.binance.com/fapi/v1/klines','https://api.binance.com/api/v3/klines'];
async function klines(i,n){for(let a=0;a<3;a++)for(const u of SRC){try{const r=await fetch(`${u}?symbol=BTCUSDT&interval=${i}&limit=${n}`,{signal:AbortSignal.timeout(8000)});if(r.ok)return await r.json()}catch(e){}}throw Error('offline')}
const usd=(v,d=0)=>v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const eat=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Nairobi',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
let data,price,loadError;
function list(){if(!data)return[];const o=[];const add=(n,l,c,dash)=>{if(l&&l.price)o.push({name:n,price:l.price,oi:l.open_interest,color:c,dash})};
add('Call wall',data.call_wall,'#ef5350');add('Put wall',data.put_wall,'#26a69a');add('Gamma flip',data.gamma_flip&&{price:data.gamma_flip},'#f5b942');
data.resistances.forEach((l,i)=>add('R'+(i+1),l,'#ef5350',true));data.supports.forEach((l,i)=>add('S'+(i+1),l,'#26a69a',true));return o}
function ladder(){const rows=list();if(price)rows.push({name:'Live price',price,live:1});
$('#ladder').innerHTML='<tr><td>Level</td><td>Price</td><td>Distance</td><td>OI, BTC</td></tr>'+rows.sort((a,b)=>b.price-a.price).map(l=>{const d=l.price-price;return `<tr class="${l.live?'live':''}"><td style="color:${l.color||''}">${l.name}</td><td>${usd(l.price,l.live?2:0)}</td><td>${l.live||!price?'':`${d>0?'+':'-'}$${usd(Math.abs(d))}<br><small>${(d/price*100).toFixed(2)}%</small>`}</td><td>${l.oi!=null?usd(l.oi):''}</td></tr>`}).join('')}
async function load(){try{const r=await fetch('levels.json?'+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;data=await r.json();loadError=false;
$('#session').innerHTML=`${data.session_label}<br><small>Analyzed ${eat(data.analyzed_at)} EAT</small>`;XChart.setLevels(list());ladder()}catch(e){loadError=true}banner()}
function banner(){const m=[];if(loadError)m.push('Could not read levels.json, retrying');if(data?.sample)m.push('Sample data. Run the workflow to get real levels.');
if(data&&Date.now()-Date.parse(data.analyzed_at)>14*36e5)m.push('Stale data: levels are more than 14 hours old.');$('#banner').innerHTML=m.map(x=>`<div>${x}</div>`).join('')}
function countdown(){const now=Date.now(),day=new Date(now).setUTCHours(0,0,0,0);
const slots=[[30,'Asian 03:30'],[540,'London 12:00'],[873,'New York 17:33']];
const [t,n]=[0,1].flatMap(d=>slots.map(([m,n])=>[day+d*864e5+m*6e4,n])).find(x=>x[0]>now);
const s=Math.floor((t-now)/1000);$('#countdown').innerHTML=`Next: ${n} EAT<br><small>${Math.floor(s/3600)}h ${Math.floor(s/60)%60}m ${s%60}s</small>`}
async function tick(){try{const k=await klines('1m',1);price=+k.at(-1)[4];$('#price').textContent=usd(price,2);$('#dot').className='on';$('#updated').textContent=eat(Date.now())+' EAT';XChart.setPrice(price);ladder()}catch(e){$('#dot').className='';$('#updated').textContent='Price unavailable, retrying'}setTimeout(tick,5000)}
function tab(t){for(const id of['dash','chart'])$('#'+id).hidden=id!==t;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('sel',b.dataset.tab===t));if(t==='chart')XChart.redraw()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{history.replaceState(0,'','#'+(b.dataset.tab==='chart'?'chart':'dash'));tab(b.dataset.tab)});
const route=()=>tab(location.hash==='#chart'?'chart':'dash');addEventListener('hashchange',route);route();
load();setInterval(load,60000);setInterval(countdown,1000);countdown();tick();
