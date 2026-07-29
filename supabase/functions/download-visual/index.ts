import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: cors,
    });
  }

  try {
    const body = await req.json();

    const imageUrl = body?.image_url;

    if (
      typeof imageUrl !== 'string' ||
      !imageUrl.startsWith('https://')
    ) {
      throw new Error('Invalid image_url');
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(
        `Image download failed: ${response.status}`
      );
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const contentType =
      response.headers.get('content-type') ||
      'image/jpeg';

    return new Response(
      JSON.stringify({
        base64: bytesToBase64(bytes),
        contentType,
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
        error:
          error instanceof Error
            ? error.message
            : String(error),
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
