import { supabase } from './supabase';

type CreateGenerationInput = {
  projectId: string;
  prompt?: string;
  model?: string;
};

export async function createGeneration({
  projectId,
  prompt = '',
  model = 'black-forest-labs/FLUX.1-schnell',
}: CreateGenerationInput) {
  const { data, error } = await supabase
    .from('generations')
    .insert({
      project_id: projectId,
      prompt,
      model,
      status: 'queued',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Generation save failed: ${error.message}`);
  }

  return data;
}

export async function saveGenerationOutputs(
  generationId: string,
  imageUrls: string[]
) {
  if (!imageUrls.length) {
    throw new Error('AI returned no images');
  }

  const rows = imageUrls.map((imageUrl) => ({
    generation_id: generationId,
    image_url: imageUrl,
    approved: false,
  }));

  const { error } = await supabase
    .from('generation_outputs')
    .insert(rows);

  if (error) {
    throw new Error(`Generation outputs save failed: ${error.message}`);
  }
}

export async function updateGenerationStatus(
  generationId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed'
) {
  const { error } = await supabase
    .from('generations')
    .update({ status })
    .eq('id', generationId);

  if (error) {
    throw new Error(`Generation status update failed: ${error.message}`);
  }
}
