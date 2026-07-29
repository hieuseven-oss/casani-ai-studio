import { supabase } from './supabase';
import {
  createGeneration,
  saveGenerationOutputs,
  updateGenerationStatus,
} from './generationService';
import {
  resolveProductImageUrl,
} from './imageService';

import {
  updateProjectStatus,
} from './projectService';

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

  preset?: string | null;
  camera?: string | null;
  lighting?: string | null;
  composition?: string | null;
  materials?: string | null;
  customDirection?: string | null;

  // Backward compatibility for Results / older callers.
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
    input.preset || '',
    input.camera || '',
    input.lighting || '',
    input.composition || '',
    input.materials || '',
  ];

  if (input.customDirection?.trim()) {
    parts.push(
      `DIRECTION: ${input.customDirection.trim()}`
    );
  }

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
    // Project lifecycle: generation has started.
    await updateProjectStatus(
      input.projectId,
      'generating'
    );

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

          project_id:
            input.projectId,

          generation_id:
            generationId,

          name:
            input.productName,

          space:
            input.space,

          style:
            input.style,

          mood:
            input.mood,

          ratio:
            input.ratio,

          preset:
            input.preset,

          camera:
            input.camera,

          lighting:
            input.lighting,

          composition:
            input.composition,

          materials:
            input.materials,

          custom_direction:
            input.customDirection?.trim() ||
            undefined,

          // Keep legacy Results / Regenerate compatible.
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

    await updateProjectStatus(
      input.projectId,
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

    try {
      // A failed new attempt must not destroy the status
      // of a project that already has successful work.
      const {
        data: completedGenerations,
        error: completedError,
      } = await supabase
        .from('generations')
        .select('id')
        .eq('project_id', input.projectId)
        .eq('status', 'completed')
        .limit(1);

      if (completedError) {
        throw completedError;
      }

      if (completedGenerations?.length) {
        // Check whether this project already has an approved visual.
        const {
          data: successfulIds,
          error: successfulIdsError,
        } = await supabase
          .from('generations')
          .select('id')
          .eq('project_id', input.projectId)
          .eq('status', 'completed');

        if (successfulIdsError) {
          throw successfulIdsError;
        }

        const generationIds =
          (successfulIds ?? []).map(
            (generation) => generation.id
          );

        let hasApproved = false;

        if (generationIds.length) {
          const {
            data: approvedOutput,
            error: approvedError,
          } = await supabase
            .from('generation_outputs')
            .select('id')
            .in('generation_id', generationIds)
            .eq('approved', true)
            .limit(1)
            .maybeSingle();

          if (approvedError) {
            throw approvedError;
          }

          hasApproved = Boolean(approvedOutput);
        }

        await updateProjectStatus(
          input.projectId,
          hasApproved
            ? 'approved'
            : 'completed'
        );
      } else {
        await updateProjectStatus(
          input.projectId,
          'failed'
        );
      }
    } catch (projectStatusError) {
      console.error(
        'Unable to restore project status after failed generation:',
        projectStatusError
      );
    }

    throw error;
  }
}
