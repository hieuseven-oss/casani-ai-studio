import { supabase } from './supabase';

type CreateGenerationInput = {
  projectId: string;
  prompt?: string;
  model?: string;
};

export async function createGeneration({
  projectId,
  prompt = '',
  model = 'black-forest-labs/FLUX.2-pro',
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

export async function updateOutputShortlist(
  outputId: string,
  shortlisted: boolean
) {
  const { error } = await supabase
    .from('generation_outputs')
    .update({
      shortlisted,
    })
    .eq('id', outputId);

  if (error) {
    throw new Error(
      `Output shortlist update failed: ${error.message}`
    );
  }
}


export async function updateOutputDecisionMeta(
  outputId: string,
  values: {
    shortlist_rank?: number | null;
    shortlist_note?: string | null;
    finalist?: boolean;
  }
) {
  const { error } = await supabase
    .from('generation_outputs')
    .update(values)
    .eq('id', outputId);

  if (error) {
    throw new Error(
      `Output decision metadata update failed: ${error.message}`
    );
  }
}

export async function approveGenerationOutput(
  outputId: string,
  projectId: string
) {
  const { data: generations, error: generationsError } = await supabase
    .from('generations')
    .select('id')
    .eq('project_id', projectId);

  if (generationsError) {
    throw new Error(`Project generations load failed: ${generationsError.message}`);
  }

  const generationIds = (generations ?? [])
    .map((generation) => generation.id)
    .filter(Boolean);

  if (!generationIds.length) {
    throw new Error('No generations found for this project.');
  }

  const { error: resetError } = await supabase
    .from('generation_outputs')
    .update({ approved: false })
    .in('generation_id', generationIds);

  if (resetError) {
    throw new Error(`Approval reset failed: ${resetError.message}`);
  }

  const { data: approvedOutput, error: approveError } = await supabase
    .from('generation_outputs')
    .update({
      approved: true,
      shortlisted: true,
    })
    .eq('id', outputId)
    .in('generation_id', generationIds)
    .select('id')
    .maybeSingle();

  if (approveError) {
    throw new Error(`Output approval failed: ${approveError.message}`);
  }

  if (!approvedOutput) {
    throw new Error('Output does not belong to this project.');
  }
}
