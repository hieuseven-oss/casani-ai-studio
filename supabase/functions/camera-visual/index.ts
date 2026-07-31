import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const CAMERA_PROMPTS: Record<string, string> = {
  front: `
Use the supplied image as the master reference for one real completed interior.

Create a professional frontal architectural photograph of THE SAME PHYSICAL ROOM
with THE SAME INSTALLED CHANDELIER.

Preserve the identity and layout of:
- architecture
- double-height volume
- mezzanine and railing
- windows, doors and openings
- walls and ceiling
- stone and wood materials
- sofa, tables and furniture
- chandelier design
- chandelier mounting point
- chandelier proportions and construction

Camera:
- frontal architectural viewpoint
- camera level
- vertical architectural lines remain vertical
- chandelier centered as the principal subject

Do not redesign, mirror, restyle or replace objects.
Perspective may change naturally only as required by the camera viewpoint.
`,

  left_three_quarter: `
Use the supplied image as the MASTER REFERENCE for one real completed interior.

Generate a NEW PHOTOGRAPH of THE SAME PHYSICAL ROOM and THE SAME INSTALLED CHANDELIER
from a clearly different LEFT THREE-QUARTER CAMERA VIEW.

CAMERA TRANSFORMATION IS REQUIRED.

Move the camera laterally to the LEFT side of the original camera position
by a substantial amount, approximately equivalent to a 35 to 45 degree
three-quarter architectural viewpoint.

Then rotate the camera toward the chandelier and center of the room.

The result MUST NOT look frontal.
The result MUST NOT look like the original camera position.
The new viewpoint must be immediately recognizable from the changed perspective.

Required geometric evidence:
- strong but natural horizontal parallax
- foreground furniture shifts relative to background windows
- side walls change apparent width
- mezzanine and railing show a different perspective
- ceiling lines converge according to the new viewpoint
- chandelier remains attached to the SAME ceiling mounting location
- chandelier remains the SAME physical size and design

Preserve scene identity:
same architecture, same windows, same doors, same walls,
same ceiling, same mezzanine, same railing, same furniture,
same materials and same chandelier.

This is a CAMERA MOVE around the same room,
not a redesign and not a different interior.

Do NOT mirror the source image.
Do NOT simulate the change using crop or zoom.
Do NOT simply move the chandelier inside the frame.

Camera level.
Architectural vertical lines remain vertical.
Use realistic architectural photography perspective.
`,

  right_three_quarter: `
Use the supplied image as the MASTER REFERENCE for one real completed interior.

Generate a NEW PHOTOGRAPH of THE SAME PHYSICAL ROOM and THE SAME INSTALLED CHANDELIER
from a clearly different RIGHT THREE-QUARTER CAMERA VIEW.

CAMERA TRANSFORMATION IS REQUIRED.

Move the camera laterally to the RIGHT side of the original camera position
by a substantial amount, approximately equivalent to a 35 to 45 degree
three-quarter architectural viewpoint.

Then rotate the camera toward the chandelier and center of the room.

The result MUST NOT look frontal.
The result MUST NOT look like the original camera position.
The result must clearly be the OPPOSITE three-quarter viewpoint
from a left three-quarter photograph.

Required geometric evidence:
- strong but natural horizontal parallax in the opposite direction
- foreground furniture shifts relative to background windows
- side walls change apparent width
- mezzanine and railing show a different perspective
- ceiling lines converge according to the new viewpoint
- chandelier remains attached to the SAME ceiling mounting location
- chandelier remains the SAME physical size and design

Preserve scene identity:
same architecture, same windows, same doors, same walls,
same ceiling, same mezzanine, same railing, same furniture,
same materials and same chandelier.

This is a CAMERA MOVE around the same room,
not a redesign and not a different interior.

Do NOT mirror the source image.
Do NOT simulate the change using crop or zoom.
Do NOT simply move the chandelier inside the frame.

Camera level.
Architectural vertical lines remain vertical.
Use realistic architectural photography perspective.
`,

  hero_close: `
Use the supplied image as the MASTER REFERENCE.

Create a PROFESSIONAL HERO CLOSE-UP PHOTOGRAPH
of the EXACT SAME INSTALLED CHANDELIER in the SAME ROOM.

A MAJOR FRAMING CHANGE IS REQUIRED.

Physically move the virtual camera much closer to the chandelier.
This must NOT remain a wide architectural room photograph.

COMPOSITION:
- chandelier is the dominant subject
- chandelier occupies approximately 60 to 75 percent of the image height
- show the complete chandelier from ceiling canopy to lowest crystal
- ceiling canopy must remain visible
- chandelier should occupy a large central portion of the frame
- surrounding architecture is secondary context
- sofa, floor and distant furniture may be partially cropped or absent
- use the existing room only as background context

Preserve the chandelier exactly:
- same canopy
- same suspension wires
- same crystal arrangement
- same number and distribution of elements
- same proportions
- same materials
- same warm illumination
- same ceiling mounting point

Do NOT redesign or replace the chandelier.
Do NOT invent another chandelier.
Do NOT enlarge the physical chandelier itself.

The apparent increase in size must come from CAMERA PROXIMITY
and photographic framing.

This is a luxury lighting product HERO SHOT,
not a full-room interior photograph.

Maintain realistic perspective and premium architectural photography quality.
`,
};

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
        'Missing TOGETHER_API_KEY'
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
        'Missing scene image_url'
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

    const requestedDimensions =
      clampDimensions(
        Number(
          body.target_width || 1024
        ),
        Number(
          body.target_height || 1024
        )
      );

    console.log(
      'Camera image quality request:',
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

    const cameraSet =
      body.camera_set === true;

    const requestedCamera =
      String(body.camera || '');

    const cameras = cameraSet
      ? [
          'left_three_quarter',
          'right_three_quarter',
          'hero_close',
        ]
      : [requestedCamera];

    for (const camera of cameras) {
      if (!CAMERA_PROMPTS[camera]) {
        throw new Error(
          `Unsupported camera preset: ${camera}`
        );
      }
    }

    const extra =
      String(
        body.custom_direction || ''
      ).trim();

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

    const storedImages: string[] = [];
    const results: Array<{
      camera: string;
      image: string;
    }> = [];

    // Camera Set V11:
    // Generate sequentially from the SAME master.
    // Never use one generated camera output as the
    // reference for the next camera.
    for (
      let index = 0;
      index < cameras.length;
      index += 1
    ) {
      const camera =
        cameras[index];

      const cameraPrompt =
        CAMERA_PROMPTS[camera];

      const prompt = extra
        ? `${cameraPrompt}\n\nADDITIONAL USER DIRECTION:\n${extra}`
        : cameraPrompt;

      console.log(
        'Camera Engine V11',
        {
          cameraSet,
          camera,
          cameraIndex:
            index + 1,
          cameraCount:
            cameras.length,
          hasScene:
            Boolean(body.image_url),
        }
      );

      const response =
        await fetch(
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
                'black-forest-labs/FLUX.1-kontext-max',

              prompt,

              width:
                requestedDimensions.width,

              height:
                requestedDimensions.height,

              n: 1,

              response_format:
                'url',

              image_url:
                body.image_url,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          'Camera V11 provider error:',
          {
            camera,
            data,
          }
        );

        throw new Error(
          JSON.stringify(data)
        );
      }

      const providerUrl =
        data?.data?.[0]?.url;

      if (!providerUrl) {
        throw new Error(
          `Camera Engine returned no image for ${camera}`
        );
      }

      const imageResponse =
        await fetch(providerUrl);

      if (!imageResponse.ok) {
        throw new Error(
          `Unable to fetch camera image for ${camera}: ${imageResponse.status}`
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
          `Camera image Storage upload failed for ${camera}: ${uploadError.message}`
        );
      }

      storedImages.push(
        storagePath
      );

      results.push({
        camera,
        image:
          storagePath,
      });
    }

    return new Response(
      JSON.stringify({
        images:
          storedImages,

        results,

        provider:
          'together',

        model:
          'black-forest-labs/FLUX.1-kontext-max',

        engine:
          'camera-v11-camera-set',

        camera_set:
          cameraSet,

        stored: true,

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
      'camera-visual error:',
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,

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
