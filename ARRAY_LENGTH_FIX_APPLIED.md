# array_length Function Error - Fix Applied

## Problem
Contract creation was failing with error:
```
Failed to create contract: function array_length(text[]) does not exist
```

Then after fixing that, a second error occurred:
```
Failed to create contract: upper bound of FOR loop cannot be null
```// HERO 7: GOLDEN CONSTELLATION — Star map, ink-black, gold nodes
// ============================================================
function Hero7() {
  const canvasRef = useRef(;
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

## Root Cause #1: Missing Dimension Parameter
The stored procedure [`create_contract_with_relations`](supabase/migrations/20260317000001_create_contract_stored_procedure.sql:8) used `array_length()` function without the required dimension parameter.

### PostgreSQL array_length() Function Requirements
PostgreSQL's `array_length()` function requires **two arguments**:
1. The array to measure
2. The dimension (1 for 1D arrays, 2 for 2D arrays, etc.)

### Incorrect Code
```sql
FOR i IN 1..array_length(p_tags) LOOP
```

### Correct Code
```sql
FOR i IN 1..array_length(p_tags, 1) LOOP
```

## Root Cause #2: NULL Upper Bound in FOR Loop
Even with the dimension parameter added, `array_length()` can return NULL in certain edge cases, causing "upper bound of FOR loop cannot be null" error.

### Problematic Code
```sql
FOR i IN 1..array_length(p_tags, 1) LOOP
```

**Issue**: If `array_length()` returns NULL, the loop upper bound becomes NULL, which is invalid.

### Fixed Code
```sql
FOR i IN 1..COALESCE(array_length(p_tags, 1), 0) LOOP
```

**Solution**: Use `COALESCE` to ensure the upper bound is always a number (0 if NULL).

## Additional Issue Fixed
The reminder INSERT used a CROSS JOIN that created a Cartesian product, resulting in duplicate reminder rows.

### Before (Incorrect)
```sql
INSERT INTO reminders (contract_id, days_before, reminder_days, notify_emails)
SELECT v_contract_id, unnest, unnest
FROM unnest(p_reminder_days) AS unnest
CROSS JOIN unnest(p_notify_emails) AS unnest;
```

**Problem**: If you have 3 reminder days and 2 notify emails, this creates **6 reminder rows** instead of 3.

### After (Correct)
```sql
INSERT INTO reminders (contract_id, days_before, reminder_days, notify_emails)
SELECT v_contract_id, days, days, COALESCE(p_notify_emails, ARRAY[]::TEXT[])
FROM unnest(p_reminder_days) AS days;
```

**Solution**: Uses the notify_emails array directly for all reminders, preventing duplicates.

## Files Modified

1. **supabase/migrations/20260318000001_fix_array_length_in_stored_procedure.sql** (UPDATED)
   - Fixed both `array_length()` calls with dimension parameter
   - Added `COALESCE` to prevent NULL upper bound in FOR loops
   - Fixed reminder INSERT logic
   - Applied to remote database via `supabase db push`

2. **supabase/migrations/20260318000002_fix_null_upper_bound_in_stored_procedure.sql** (NEW)
   - Final version with all fixes applied
   - Applied to remote database via `supabase db push`

3. **supabase/migrations/20260317000001_create_contract_stored_procedure.sql** (UPDATED)
   - Fixed both `array_length()` calls with dimension parameter
   - Added `COALESCE` to prevent NULL upper bound in FOR loops
   - Fixed reminder INSERT logic
   - Added comments explaining fixes

## Changes Summary

| Location | Change | Reason |
|-----------|--------|--------|
| Line 43 | `array_length(p_tags)` → `array_length(p_tags, 1)` | Add dimension parameter |
| Line 43 | Added `COALESCE(..., 0)` | Prevent NULL upper bound in FOR loop |
| Line 69 | `array_length(p_reminder_days)` → `array_length(p_reminder_days, 1)` | Add dimension parameter |
| Line 69 | Added `COALESCE(..., 0)` | Prevent NULL upper bound in IF condition |
| Lines 71-75 | CROSS JOIN → Direct INSERT with unnest | Prevent duplicate reminders |

## Testing
After applying this fix:
1. Contract creation with tags should work
2. Contract creation with reminder days should work
3. Contract creation with both tags and reminders should work
4. No duplicate reminder rows should be created
5. No NULL upper bound errors should occur

## Migration Status
✅ First migration applied successfully to remote database
✅ Second migration (final fix) applied successfully to remote database
✅ Original migration file updated for consistency
✅ Stored procedure now uses correct PostgreSQL syntax with NULL safety

## Related Errors
The client-side error "API error response: {}" was a result of the PostgreSQL error being caught and returned by the API. With all fixes applied, contract creation should succeed without errors.
