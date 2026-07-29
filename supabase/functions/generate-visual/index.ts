import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json();

    const apiKey = Deno.env.get('TOGETHER_API_KEY');

    if (!apiKey) {
      throw new Error('Missing TOGETHER_API_KEY secret');
    }

    if (!body.image_url) {
      throw new Error('Missing image_url');
    }

    const prompt = `
Create a premium photorealistic architectural lighting advertising image.

Use the supplied lighting product as the reference product.

Product: ${body.name || 'architectural lighting product'}
Space: ${body.space || 'luxury interior'}
Style: ${body.style || 'luxury'}
Mood: ${body.mood || 'warm'}

Preserve the product identity as faithfully as possible:
shape, proportions, materials, finish, color, number of bulbs,
decorative details, cables and mounting structure.

Place the product naturally in a professionally designed interior.
Realistic architectural lighting, premium materials,
editorial interior photography, uncluttered luxury composition.

No text.
No logo.
No watermark.
`.trim();

    const response = await fetch(
      'https://api.together.xyz/v1/images/generations',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell',
          prompt,
          width: 1024,
          height: 1024,
          steps: 4,
          n: 4,
          response_format: 'url',
          image_url: body.image_url,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    const images =
      data?.data
        ?.map((item: any) => item?.url)
        .filter(Boolean) ?? [];

    return new Response(
      JSON.stringify({
        images,
        provider: 'together',
        model: 'black-forest-labs/FLUX.1-schnell',
        raw: data,
      }),
      {
        headers: {
          ...cors,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
