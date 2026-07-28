import { supabase } from './supabase';

type CreateGenerationInput = {
  projectId: string;
  prompt?: string;
  model?: string;
};

export async function createGeneration({
  projectId,
  prompt = '',
  model = 'fal',
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
