// HERO 7: GOLDEN CONSTELLATION — Star map, ink-black, gold nodes
// ============================================================
function Hero7() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W=canvas.width, H=canvas.height;
    const nodes = Array.from({length:100},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*2.2+0.6,
      alpha:Math.random()*0.7+0.2,
      pulse:Math.random()*Math.PI*2,
      speed:Math.random()*0.018+0.008,
      vx:(Math.random()-0.5)*0.2,
      vy:(Math.random()-0.5)*0.2,
      hue:Math.random()*20+38,
    }));
    function draw(){
      ctx.clearRect(0,0,W,H);
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<130){
            ctx.beginPath();
            ctx.moveTo(nodes[i].x,nodes[i].y);
            ctx.lineTo(nodes[j].x,nodes[j].y);
            ctx.strokeStyle=`rgba(212,168,64,${(1-dist/130)*0.2})`;
            ctx.lineWidth=0.6;
            ctx.stroke();
          }
        }
      }
      nodes.forEach(p=>{
        p.pulse+=p.speed;
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=W;if(p.x>W)p.x=0;
        if(p.y<0)p.y=H;if(p.y>H)p.y=0;
        const glow=(Math.sin(p.pulse)+1)/2;
        const r=p.r*(0.8+glow*0.5);
        const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*5);
        grad.addColorStop(0,`hsla(${p.hue},80%,68%,${p.alpha*0.35})`);
        grad.addColorStop(1,"transparent");
        ctx.beginPath();
        ctx.arc(p.x,p.y,r*5,0,Math.PI*2);
        ctx.fillStyle=grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x,p.y,r,0,Math.PI*2);
        ctx.fillStyle=`hsla(${p.hue},90%,78%,${p.alpha})`;
        ctx.fill();
      });
      animRef.current=requestAnimationFrame(draw);
    }
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[]);
  return (
    <div style={{position:"relative",width:"100%",height:"100vh",background:"#06060A",overflow:"hidden",fontFamily:"Cormorant Garamond,Cormorant,Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <canvas ref={canvasRef} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>
      <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",maxWidth:700,padding:"0 48px"}}>
        <div style={{width:48,height:48,border:"1px solid rgba(212,168,64,0.4)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:32,position:"relative"}}>
          <div style={{width:20,height:20,border:"1px solid rgba(212,168,64,0.6)",transform:"rotate(45deg)"}}/>
          <div style={{position:"absolute",width:64,height:64,borderRadius:"50%",border:"1px solid rgba(212,168,64,0.12)"}}/>
        </div>
        <div style={{fontSize:10,letterSpacing:"0.55em",color:"rgba(212,168,64,0.55)",textTransform:"uppercase",marginBottom:28}}>Clavis · Contract Registry</div>
        <h1 style={{fontSize:"clamp(46px,6vw,86px)",fontWeight:300,lineHeight:1.1,color:"#F0E8D0",margin:"0 0 24px",letterSpacing:"0.03em"}}>
          Map your obligations.<br/><span style={{color:"#D4A840",fontStyle:"italic"}}>Never lose the stars</span><br/>you navigate by.
        </h1>
        <p style={{fontSize:17,color:"rgba(240,232,208,0.4)",lineHeight:1.8,marginBottom:52,fontStyle:"italic",maxWidth:480}}>Every contract a constellation. Clavis charts them all, signaling when renewal aligns.</p>
        <div style={{display:"flex",gap:24,alignItems:"center"}}>
          <button style={{background:"rgba(212,168,64,0.09)",color:"#D4A840",border:"1px solid rgba(212,168,64,0.32)",padding:"15px 48px",fontSize:13,cursor:"pointer",letterSpacing:"0.2em",fontFamily:"Cormorant Garamond,serif",textTransform:"uppercase"}}>Chart Contracts</button>
          <span style={{color:"rgba(212,168,64,0.22)",fontSize:18}}>✦</span>
          <button style={{background:"transparent",color:"rgba(240,232,208,0.3)",border:"1px solid rgba(240,232,208,0.1)",padding:"15px 40px",fontSize:13,cursor:"pointer",letterSpacing:"0.15em",fontFamily:"Cormorant Garamond,serif",textTransform:"uppercase"}}>View Atlas</button>
        </div>
      </div>
    </div>
  );
}