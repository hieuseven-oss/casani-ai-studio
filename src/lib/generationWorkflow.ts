import { supabase } from './supabase';
import {
  createGeneration,
  saveGenerationOutputs,
  updateGenerationStatus,
} from './generationService';
import {
  resolveProductImageUrl,
} from './imageService';

export const DEFAULT_IMAGE_MODEL =
  'black-forest-labs/FLUX.2-pro';

export type GenerateVisualInput = {
  projectId: string;

  productName: string;
  productImagePath: string;

  space?: string | null;
  style?: string | null;
  mood?: string | null;
  ratio?: string | null;

  customPrompt?: string;
};

export type GeneratedVersion = {
  generationId: string;
  imageUrls: string[];
};

function buildGenerationPrompt(
  input: GenerateVisualInput
) {
  const parts = [
    input.productName,
    input.space || '',
    input.style || '',
    input.mood || '',
    input.ratio || '',
  ];

  if (input.customPrompt?.trim()) {
    parts.push(
      `CUSTOM: ${input.customPrompt.trim()}`
    );
  }

  return parts.join(' | ');
}

export async function generateVisualVersion(
  input: GenerateVisualInput
): Promise<GeneratedVersion> {
  let generationId: string | null = null;

  try {
    // 1. Create database generation
    const generation =
      await createGeneration({
        projectId: input.projectId,
        prompt:
          buildGenerationPrompt(input),
        model: DEFAULT_IMAGE_MODEL,
      });

    generationId =
      generation.id as string;

    await updateGenerationStatus(
      generationId,
      'processing'
    );

    // 2. Always create a fresh URL
    // from the original Storage path.
    const imageUrl =
      await resolveProductImageUrl(
        input.productImagePath
      );

    // 3. Call AI Edge Function
    const {
      data,
      error,
    } = await supabase.functions.invoke(
      'generate-visual',
      {
        body: {
          image_url: imageUrl,
          name: input.productName,
          space: input.space,
          style: input.style,
          mood: input.mood,
          ratio: input.ratio,
          custom_prompt:
            input.customPrompt?.trim() ||
            undefined,
        },
      }
    );

    if (error) {
      let detail = error.message;

      try {
        const context = (error as any)?.context;

        if (context instanceof Response) {
          const responseText = await context.text();

          if (responseText) {
            try {
              const parsed = JSON.parse(responseText);

              detail =
                parsed?.error ||
                parsed?.message ||
                responseText;
            } catch {
              detail = responseText;
            }
          }
        }
      } catch (contextError) {
        console.error(
          'Unable to read Edge Function error response:',
          contextError
        );
      }

      throw new Error(
        `AI generation failed: ${detail}`
      );
    }

    if (data?.error) {
      throw new Error(
        `AI generation failed: ${String(data.error)}`
      );
    }

    const imageUrls: string[] =
      Array.isArray(data?.images)
        ? data.images
            .map(
              (item: any) =>
                item?.url || item
            )
            .filter(
              (url: unknown):
                url is string =>
                typeof url === 'string' &&
                Boolean(url)
            )
            .slice(0, 4)
        : [];

    if (!imageUrls.length) {
      throw new Error(
        'AI returned no images.'
      );
    }

    // 4. Persist outputs
    await saveGenerationOutputs(
      generationId,
      imageUrls
    );

    await updateGenerationStatus(
      generationId,
      'completed'
    );

    return {
      generationId,
      imageUrls,
    };
  } catch (error) {
    if (generationId) {
      try {
        await updateGenerationStatus(
          generationId,
          'failed'
        );
      } catch (statusError) {
        console.error(
          'Unable to mark generation failed:',
          statusError
        );
      }
    }

    throw error;
  }
}
