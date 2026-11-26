import json, math, os, time, urllib.request
from datetime import datetime, timezone, timedelta
API="https://www.deribit.com/api/v2/public/"
def get(path):
    for i in range(3):
        try:
            req=urllib.request.Request(API+path,headers={"User-Agent":"btcusd-levels/1.0"})
            with urllib.request.urlopen(req,timeout=30) as r: return json.load(r)["result"]
        except Exception:
            if i==2: raise
            time.sleep(3*(i+1))
N=lambda x:.5*(1+math.erf(x/math.sqrt(2)))
pdf=lambda x:math.exp(-x*x/2)/math.sqrt(2*math.pi)
def greeks(S,K,T,v,call):
    d=(math.log(S/K)+v*v*T/2)/(v*math.sqrt(T))
    return N(d)-(0 if call else 1), pdf(d)/(S*v*math.sqrt(T)), S*pdf(d)*math.sqrt(T)/100

def compute(book,S,now,prev):
    opts=[]
    for o in book:
        _,e,k,cp=o["instrument_name"].split("-")
        exp=datetime.strptime(e,"%d%b%y").replace(hour=8,tzinfo=timezone.utc)
        h=(exp-now).total_seconds()/3600; oi=o.get("open_interest") or 0; iv=(o.get("mark_iv") or 0)/100
        if not (1<=h<=45*24 and oi>0 and iv>0): continue
        opts.append(dict(e=exp,K=float(k),call=cp=="C",oi=oi,iv=iv,T=h/8760,h=h))
    if not opts: raise SystemExit("No usable options")
    exps=sorted({o["e"] for o in opts}); front=exps[0]; nxt=exps[1] if len(exps)>1 else None
    rows={}
    for o in opts:
        d,g,v=greeks(S,o["K"],o["T"],o["iv"],o["call"])
        r=rows.setdefault(o["K"],dict(strike=o["K"],net_gex=0,front_gex=0,next_gex=0,call_oi=0,put_oi=0,vega_exposure=0,front_vega=0,cg=0,pg=0,cd=0,pd=0,civ=[],piv=[]))
        x=g*o["oi"]*S*S*.01; s="c" if o["call"] else "p"; sx=x if o["call"] else -x
        r["net_gex"]+=sx; r[s+"g"]+=x; r[s+"d"]+=abs(d)*o["oi"]*S; r[s+"iv"].append(o["iv"])
        r["call_oi" if o["call"] else "put_oi"]+=o["oi"]; r["vega_exposure"]+=v*o["oi"]
        if o["e"]==front: r["front_gex"]+=sx; r["front_vega"]+=v*o["oi"]
        if o["e"]==nxt: r["next_gex"]+=sx
    ref=next((e for e in exps if (e-now).total_seconds()>86400),exps[-1])
    atm=min((o for o in opts if o["e"]==ref),key=lambda o:abs(o["K"]-S))["iv"]
    move=S*atm*math.sqrt(1/365)
    def wall(side):
        up=side=="c"
        c=[r for r in rows.values() if (r["strike"]>S if up else r["strike"]<S) and (r["net_gex"]>0 if up else r["net_gex"]<0)]
        if not c: return None
        r=max(c,key=lambda r:abs(r["net_gex"]))
        return dict(price=r["strike"],open_interest=r["call_oi" if up else "put_oi"],gex=r["net_gex"])
    cw,pw=wall("c"),wall("p")
    def total(p): return sum((1 if o["call"] else -1)*greeks(p,o["K"],o["T"],o["iv"],o["call"])[1]*o["oi"]*p*p*.01 for o in opts)
    grid=[S*(.92+.0025*i) for i in range(65)]; vals=[total(p) for p in grid]
    zeros=[a+(b-a)*x/(x-y) for a,b,x,y in zip(grid,grid[1:],vals,vals[1:]) if x*y<0]
    flip=min(zeros,key=lambda z:abs(z-S)) if zeros else None
    def levels(s,sign):
        oik="call_oi" if s=="c" else "put_oi"
        near=[r for r in rows.values() if abs(r["strike"]/S-1)<=.06 and (r["strike"]-S)*sign>0]
        top=lambda f:max([f(r) for r in near]+[1e-9])
        mo,mg,md,mv=top(lambda r:r[oik]),top(lambda r:r[s+"g"]),top(lambda r:r[s+"d"]),top(lambda r:r["vega_exposure"])
        out=[]
        for p in [r["strike"] for r in near]+[S+sign*move,S+sign*2*move]:
            r=rows.get(p); close=lambda q:max(0,1-abs(p-q)/(S*.01))
            score=0; ivs=r[s+"iv"] if r else []
            if r: score=35*r[oik]/mo+25*r[s+"g"]/mg+15*(r[s+"d"]/md+r["vega_exposure"]/mv)/2
            skew=min(1,abs(sum(ivs)/len(ivs)-atm)/atm*4) if ivs else 0
            score+=15*(skew+max(close(S+sign*move),close(S+sign*2*move)))/2
            score+=10*max([close(q) for q in [flip,cw and cw["price"],pw and pw["price"]] if q]+[0])
            out.append(dict(price=round(p),score=round(score,1),open_interest=r[oik] if r else 0,gex=r[s+"g"]*sign if r else 0))
        pick=[]
        for c in sorted(out,key=lambda c:-c["score"]):
            if all(abs(c["price"]-q["price"])>=S*.0025 for q in pick): pick.append(c)
            if len(pick)==3: break
        return sorted(pick,key=lambda c:abs(c["price"]-S))
    cur={str(k):r["net_gex"] for k,r in rows.items()}
    ts=now.timestamp()
    if prev and ts-prev["ts"]<1200: base,keep_ts=prev["prev_net_all"],prev["ts"]
    else: base,keep_ts=(prev["net_all"] if prev else None),ts
    strikes=[]
    for k,r in sorted(rows.items()):
        if abs(k/S-1)<=.10:
            d={x:r[x] for x in ("strike","net_gex","front_gex","next_gex","call_oi","put_oi","vega_exposure")}
            d["change_1d"]=r["net_gex"]-base.get(str(k),0) if base is not None else None; strikes.append(d)
    def topn(key,n): return [dict(rank=i+1,price=r["strike"],net_gex=r[key]) for i,r in enumerate(sorted([r for r in rows.values() if r[key]],key=lambda r:-abs(r[key]))[:n])]
    def each(fn): return {"front":fn("front_gex","front_vega"),"all":fn("net_gex","vega_exposure")}
    def ivw(sign): return each(lambda g,v:max([(r[v],r["strike"]) for r in rows.values() if (r["strike"]-S)*sign>0],default=(0,None))[1])
    eat=now.astimezone(timezone(timedelta(hours=3)))
    m=now.hour*60+now.minute
    sess,label=("asian","Asian, 03:30 EAT") if m<480 else ("london","London, 12:00 EAT") if m<810 else ("new_york","New York, 17:33 EAT")
    out=dict(sample=False,session=sess,session_label=label,analyzed_at=eat.isoformat(timespec="seconds"),
      analyzed_at_utc=now.isoformat(timespec="seconds"),spot_source="Deribit btc_usd index",spot_at_analysis=S,atm_iv=atm*100,
      expected_move_1sd=move,call_wall=cw,put_wall=pw,gamma_flip=flip,resistances=levels("c",1),supports=levels("p",-1),
      front_expiry=front.isoformat(),next_expiry=nxt and nxt.isoformat(),gex_strikes=strikes,
      peak_gex=each(lambda g,v:max(rows.values(),key=lambda r:abs(r[g]))["strike"]),iv_wall_above=ivw(1),iv_wall_below=ivw(-1),
      top_front=topn("front_gex",10),top_next=topn("next_gex",5),top_all=topn("net_gex",10),sources=[API])
    return out,dict(ts=keep_ts,net_all=cur,prev_net_all=base)

def write(path,data):
    with open(path+".tmp","w") as f: json.dump(data,f,separators=(",",":"))
    os.replace(path+".tmp",path)
if __name__=="__main__":
    book=get("get_book_summary_by_currency?currency=BTC&kind=option")
    spot=get("get_index_price?index_name=btc_usd")["index_price"]
    try:
        with open("data_prev.json") as f: prev=json.load(f)
    except (OSError,ValueError): prev=None
    out,state=compute(book,spot,datetime.now(timezone.utc),prev)
    write("levels.json",out); write("data_prev.json",state)
