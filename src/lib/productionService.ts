import { supabase } from './supabase';
import { resolveAIOutputUrl } from './imageService';

export type ProductionAsset = {
  id: string;
  generationId: string;
  imageUrl: string;
  role: string | null;
  approved: boolean;
};

export type ProductionSet = {
  generationId: string;
  projectId: string;

  productId: string | null;
  productName: string;
  productSku: string | null;

  space: string;
  style: string;
  mood: string;

  productionReadyAt: string | null;
  createdAt: string;

  assets: ProductionAsset[];
};

const PRODUCTION_ROLES = [
  'left_three_quarter',
  'right_three_quarter',
  'hero_close',
] as const;

function roleOrder(
  role: string | null
) {
  const index =
    PRODUCTION_ROLES.indexOf(
      role as typeof PRODUCTION_ROLES[number]
    );

  return index >= 0
    ? index
    : 999;
}

export async function getProductionSets():
  Promise<ProductionSet[]> {

  const {
    data: generations,
    error: generationsError,
  } = await supabase
    .from('generations')
    .select(`
      id,
      project_id,
      production_ready,
      production_ready_at,
      created_at,
      projects (
        id,
        space,
        style,
        mood,
        product_id,
        products (
          id,
          name,
          sku
        )
      )
    `)
    .eq(
      'production_ready',
      true
    )
    .order(
      'production_ready_at',
      {
        ascending: false,
        nullsFirst: false,
      }
    );

  if (generationsError) {
    throw new Error(
      `Production sets load failed: ${generationsError.message}`
    );
  }

  const sets =
    await Promise.all(
      (generations ?? []).map(
        async (generation: any) => {

          const project =
            Array.isArray(
              generation.projects
            )
              ? generation.projects[0]
              : generation.projects;

          const product =
            Array.isArray(
              project?.products
            )
              ? project.products[0]
              : project?.products;

          const {
            data: outputs,
            error: outputsError,
          } = await supabase
            .from(
              'generation_outputs'
            )
            .select(
              'id, generation_id, image_url, role, approved'
            )
            .eq(
              'generation_id',
              generation.id
            );

          if (outputsError) {
            throw new Error(
              `Production assets load failed: ${outputsError.message}`
            );
          }

          const resolvedAssets =
            await Promise.all(
              (outputs ?? [])
                .filter(
                  (output: any) =>
                    PRODUCTION_ROLES.includes(
                      output.role
                    )
                )
                .sort(
                  (
                    a: any,
                    b: any
                  ) =>
                    roleOrder(a.role) -
                    roleOrder(b.role)
                )
                .map(
                  async (output: any) => ({
                    id:
                      output.id,

                    generationId:
                      output.generation_id,

                    imageUrl:
                      await resolveAIOutputUrl(
                        output.image_url
                      ),

                    role:
                      output.role,

                    approved:
                      Boolean(
                        output.approved
                      ),
                  })
                )
            );

          return {
            generationId:
              generation.id,

            projectId:
              generation.project_id,

            productId:
              project?.product_id ??
              null,

            productName:
              product?.name ??
              'Untitled product',

            productSku:
              product?.sku ??
              null,

            space:
              project?.space ??
              '',

            style:
              project?.style ??
              '',

            mood:
              project?.mood ??
              '',

            productionReadyAt:
              generation.production_ready_at,

            createdAt:
              generation.created_at,

            assets:
              resolvedAssets,
          } satisfies ProductionSet;
        }
      )
    );

  return sets.filter(
    (set) =>
      set.assets.length > 0
  );
}
