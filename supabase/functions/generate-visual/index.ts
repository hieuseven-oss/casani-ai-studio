import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildLightingPrompt } from '../_shared/promptEngine.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const AI_BUCKET = 'ai-outputs';

const MIN_OUTPUT_DIMENSION = 256;
const MAX_OUTPUT_DIMENSION = 2048;
const DIMENSION_STEP = 16;
const MAX_OUTPUT_PIXELS = 4_194_304;

function clampDimensions(
  width: number,
  height: number
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      width: 1024,
      height: 1024,
    };
  }

  const pixels =
    width * height;

  const scale =
    Math.min(
      1,
      MAX_OUTPUT_DIMENSION / width,
      MAX_OUTPUT_DIMENSION / height,
      Math.sqrt(
        MAX_OUTPUT_PIXELS / pixels
      )
    );

  const scaledWidth =
    width * scale;

  const scaledHeight =
    height * scale;

  const snap = (
    value: number
  ) => {
    const snapped =
      Math.round(
        value / DIMENSION_STEP
      ) * DIMENSION_STEP;

    return Math.min(
      MAX_OUTPUT_DIMENSION,
      Math.max(
        MIN_OUTPUT_DIMENSION,
        snapped
      )
    );
  };

  return {
    width:
      snap(scaledWidth),

    height:
      snap(scaledHeight),
  };
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: cors,
    });
  }

  try {
    const body = await req.json();

    const apiKey =
      Deno.env.get('TOGETHER_API_KEY');

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey) {
      throw new Error(
        'Missing TOGETHER_API_KEY secret'
      );
    }

    if (!supabaseUrl) {
      throw new Error(
        'Missing SUPABASE_URL'
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    if (!body.image_url) {
      throw new Error(
        'Missing image_url'
      );
    }

    if (!body.project_id) {
      throw new Error(
        'Missing project_id'
      );
    }

    if (!body.generation_id) {
      throw new Error(
        'Missing generation_id'
      );
    }

    const referenceMode =
      body.reference_mode || 'product';

    const referenceImages =
      referenceMode === 'visual' &&
      body.original_product_image_url
        ? [
            body.original_product_image_url,
            body.image_url,
          ]
        : [
            body.image_url,
          ];

    const variationType =
      body.variation_type || 'creative';

    const cameraPreset =
      body.camera || '';

    const prompt = buildLightingPrompt({
      name: body.name,
      space: body.space,
      style: body.style,
      mood: body.mood,
      ratio: body.ratio,
      preset: body.preset,
      camera: body.camera,
      lighting: body.lighting,
      composition: body.composition,
      materials: body.materials,
      custom_direction:
        body.custom_direction,

      reference_mode:
        referenceMode,

      variation_type:
        variationType,

      // Backward compatibility.
      custom_prompt:
        body.custom_prompt,
    });

    const requestedDimensions =
      clampDimensions(
        Number(body.target_width || 1024),
        Number(body.target_height || 1024)
      );

    console.log(
      'Image quality request:',
      {
        image_quality:
          body.image_quality || 'legacy',
        target_width:
          body.target_width,
        target_height:
          body.target_height,
        provider_width:
          requestedDimensions.width,
        provider_height:
          requestedDimensions.height,
      }
    );

    // =====================================================
    // 1. GENERATE WITH TOGETHER
    // =====================================================

    const response = await fetch(
      'https://api.together.xyz/v1/images/generations',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          model:
            'black-forest-labs/FLUX.2-pro',

          prompt,

          width:
            requestedDimensions.width,

          height:
            requestedDimensions.height,

          n: 4,

          response_format:
            'url',

          reference_images:
            referenceImages,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        JSON.stringify(data)
      );
    }

    const providerUrls: string[] =
      data?.data
        ?.map(
          (item: any) =>
            item?.url
        )
        .filter(Boolean) ?? [];

    if (!providerUrls.length) {
      throw new Error(
        'Together returned no images'
      );
    }

    // =====================================================
    // 2. SUPABASE ADMIN CLIENT
    // =====================================================

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    // =====================================================
    // 3. COPY PROVIDER IMAGES TO PRIVATE STORAGE
    // =====================================================

    const storagePaths: string[] = [];

    for (
      let index = 0;
      index < providerUrls.length;
      index++
    ) {
      const providerUrl =
        providerUrls[index];

      const imageResponse =
        await fetch(providerUrl);

      if (!imageResponse.ok) {
        throw new Error(
          `Unable to fetch generated image ${index + 1}: ${imageResponse.status}`
        );
      }

      const contentType =
        imageResponse.headers.get(
          'content-type'
        ) || 'image/jpeg';

      const extension =
        extensionFromContentType(
          contentType
        );

      const bytes =
        await imageResponse.arrayBuffer();

      const storagePath =
        `${body.project_id}/` +
        `${body.generation_id}/` +
        `visual-${index + 1}.${extension}`;

      const {
        error: uploadError,
      } =
        await admin.storage
          .from(AI_BUCKET)
          .upload(
            storagePath,
            bytes,
            {
              contentType,
              cacheControl:
                '31536000',

              upsert: true,
            }
          );

      if (uploadError) {
        throw new Error(
          `AI image Storage upload failed: ${uploadError.message}`
        );
      }

      storagePaths.push(
        storagePath
      );
    }

    // =====================================================
    // 4. RETURN STORAGE PATHS
    // =====================================================

    return new Response(
      JSON.stringify({
        images:
          storagePaths,

        provider:
          'together',

        model:
          'black-forest-labs/FLUX.2-pro',

        stored:
          true,

        bucket:
          AI_BUCKET,
      }),
      {
        headers: {
          ...cors,
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      'generate-visual error:',
      error
    );

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
          'Content-Type':
            'application/json',
        },
      }
    );
  }
});
