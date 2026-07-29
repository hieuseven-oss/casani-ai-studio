import { supabase } from './supabase';

type CreateProjectInput = {
  productId: string;
  space: string;
  style: string;
  mood: string;
  ratio: string;
};

export async function createProject({
  productId,
  space,
  style,
  mood,
  ratio,
}: CreateProjectInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User is not authenticated');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      product_id: productId,
      space,
      style,
      mood,
      aspect_ratio: ratio,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Project save failed: ${error.message}`);
  }

  return project;
}

export async function getProjectsFromSupabase() {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      user_id,
      product_id,
      space,
      style,
      mood,
      aspect_ratio,
      status,
      created_at,
      products (
        id,
        name,
        image_url,
        sku
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Projects load failed: ${error.message}`);
  }

  return data ?? [];
}

export async function getProjectById(id: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      user_id,
      product_id,
      space,
      style,
      mood,
      aspect_ratio,
      status,
      created_at,
      products (
        id,
        name,
        image_url,
        sku
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Project load failed: ${error.message}`);
  }

  return data;
}

export type ProjectStatus =
  | 'draft'
  | 'generating'
  | 'completed'
  | 'approved'
  | 'failed';

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
) {
  const { error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', projectId);

  if (error) {
    throw new Error(
      `Project status update failed: ${error.message}`
    );
  }
}
