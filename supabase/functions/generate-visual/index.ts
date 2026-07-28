// Supabase Edge Function. Set secret: FAL_KEY
// Deploy as: generate-visual
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{const body=await req.json();const key=Deno.env.get('FAL_KEY');if(!key)throw new Error('Missing FAL_KEY secret');const prompt=`Create a premium photorealistic ${body.style} ${body.space} advertising scene for architectural lighting. Mood: ${body.mood}. Preserve the supplied lighting product as faithfully as possible: shape, materials, number of bulbs, proportions, finish and cables. Warm layered architectural lighting, editorial interior photography, refined materials, uncluttered luxury composition. No text, no logo, no watermark.`;
const r=await fetch('https://queue.fal.run/fal-ai/gpt-image-1.5/edit',{method:'POST',headers:{'Authorization':`Key ${key}`,'Content-Type':'application/json'},body:JSON.stringify({prompt,image_urls:[body.image_url],num_images:4})});const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));
// Queue endpoints may return request_id first. For production, add polling/webhook handling.
if(data.images)return new Response(JSON.stringify({images:data.images}),{headers:{...cors,'Content-Type':'application/json'}});
return new Response(JSON.stringify({queued:true,request_id:data.request_id||data.requestId,raw:data}),{headers:{...cors,'Content-Type':'application/json'}});
}catch(e){return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}});
