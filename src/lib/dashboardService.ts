import { supabase } from './supabase';
import { resolveProductImageUrl } from './imageService';

export type DashboardProject = {
  id: string;
  productName: string;
  imageUrl: string;
  style: string;
  space: string;
  mood: string;
  status: string;
};

export type DashboardData = {
  productCount: number;
  visualCount: number;
  approvedProjectCount: number;
  projectCount: number;
  recentProjects: DashboardProject[];
};

export async function getDashboardData(): Promise<DashboardData> {
  // 1. Real product count
  const {
    count: productCount,
    error: productCountError,
  } = await supabase
    .from('products')
    .select('*', {
      count: 'exact',
      head: true,
    });

  if (productCountError) {
    throw new Error(
      `Product count failed: ${productCountError.message}`
    );
  }

  // 2. Real AI output count
  const {
    count: visualCount,
    error: visualCountError,
  } = await supabase
    .from('generation_outputs')
    .select('*', {
      count: 'exact',
      head: true,
    });

  if (visualCountError) {
    throw new Error(
      `AI visual count failed: ${visualCountError.message}`
    );
  }

  // 3. Approved project count
  const {
    count: approvedProjectCount,
    error: approvedCountError,
  } = await supabase
    .from('projects')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'approved');

  if (approvedCountError) {
    throw new Error(
      `Approved project count failed: ${approvedCountError.message}`
    );
  }

  // 4. Total project count
  const {
    count: projectCount,
    error: projectCountError,
  } = await supabase
    .from('projects')
    .select('*', {
      count: 'exact',
      head: true,
    });

  if (projectCountError) {
    throw new Error(
      `Project count failed: ${projectCountError.message}`
    );
  }

  // 5. Latest projects
  const {
    data: projectRows,
    error: projectsError,
  } = await supabase
    .from('projects')
    .select(`
      id,
      space,
      style,
      mood,
      status,
      created_at,
      products (
        id,
        name,
        image_url,
        sku
      )
    `)
    .order('created_at', {
      ascending: false,
    })
    .limit(4);

  if (projectsError) {
    throw new Error(
      `Recent projects failed: ${projectsError.message}`
    );
  }

  const recentProjects: DashboardProject[] =
    await Promise.all(
      (projectRows ?? []).map(async (project: any) => {
        const product = Array.isArray(project.products)
          ? project.products[0]
          : project.products;

        let imageUrl = '';

        // Find newest successful generation.
        const {
          data: generation,
          error: generationError,
        } = await supabase
          .from('generations')
          .select('id, created_at')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (generationError) {
          console.warn(
            'Dashboard generation lookup failed:',
            generationError.message
          );
        }

        if (generation?.id) {
          // Prefer Approved output.
          const {
            data: approvedOutput,
            error: approvedError,
          } = await supabase
            .from('generation_outputs')
            .select('image_url')
            .eq('generation_id', generation.id)
            .eq('approved', true)
            .limit(1)
            .maybeSingle();

          if (approvedError) {
            console.warn(
              'Dashboard approved output lookup failed:',
              approvedError.message
            );
          }

          if (approvedOutput?.image_url) {
            imageUrl = approvedOutput.image_url;
          } else {
            // Otherwise use first generated visual.
            const {
              data: firstOutput,
              error: outputError,
            } = await supabase
              .from('generation_outputs')
              .select('image_url, created_at')
              .eq('generation_id', generation.id)
              .order('created_at', {
                ascending: true,
              })
              .limit(1)
              .maybeSingle();

            if (outputError) {
              console.warn(
                'Dashboard output lookup failed:',
                outputError.message
              );
            }

            if (firstOutput?.image_url) {
              imageUrl = firstOutput.image_url;
            }
          }
        }

        // Final fallback = original product photo.
        if (!imageUrl && product?.image_url) {
          try {
            imageUrl = await resolveProductImageUrl(
              product.image_url
            );
          } catch (error) {
            console.warn(
              'Dashboard product image failed:',
              error
            );
          }
        }

        return {
          id: project.id,
          productName:
            product?.name || 'Untitled project',
          imageUrl,
          style: project.style || '',
          space: project.space || '',
          mood: project.mood || '',
          status: project.status || 'draft',
        };
      })
    );

  return {
    productCount: productCount ?? 0,
    visualCount: visualCount ?? 0,
    approvedProjectCount:
      approvedProjectCount ?? 0,
    projectCount: projectCount ?? 0,
    recentProjects,
  };
}
