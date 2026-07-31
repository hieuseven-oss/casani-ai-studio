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

  if (role === null) {
    return -1;
  }

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
                    Boolean(output.approved) ||
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

  const validSets =
    sets.filter(
      (set) =>
        set.assets.length > 0
    );

  // V15H.2
  // Production is grouped by PROJECT, not by generation.
  //
  // One project can have:
  // - a normal generation containing the approved main image
  // - another generation containing Camera Set outputs
  //
  // They must appear as ONE Production Set.
  //
  // generations are loaded newest first, so the first
  // approved/main asset and first asset for each camera role
  // are treated as the latest production choices.

  const grouped =
    new Map<string, ProductionSet>();

  for (const set of validSets) {
    const existing =
      grouped.get(set.projectId);

    if (!existing) {
      grouped.set(
        set.projectId,
        {
          ...set,
          assets: [],
        }
      );
    }

    const target =
      grouped.get(set.projectId)!;

    // Keep latest metadata / representative generation.
    if (
      !target.productionReadyAt ||
      (
        set.productionReadyAt &&
        set.productionReadyAt >
          target.productionReadyAt
      )
    ) {
      target.generationId =
        set.generationId;

      target.productionReadyAt =
        set.productionReadyAt;

      target.createdAt =
        set.createdAt;
    }

    for (const asset of set.assets) {
      if (asset.approved) {
        const existingMainIndex =
          target.assets.findIndex(
            (item) =>
              item.approved
          );

        if (existingMainIndex < 0) {
          target.assets.unshift(
            asset
          );
        }

        continue;
      }

      if (
        PRODUCTION_ROLES.includes(
          asset.role as typeof PRODUCTION_ROLES[number]
        )
      ) {
        const alreadyHasRole =
          target.assets.some(
            (item) =>
              !item.approved &&
              item.role === asset.role
          );

        if (!alreadyHasRole) {
          target.assets.push(
            asset
          );
        }
      }
    }
  }

  return Array.from(
    grouped.values()
  )
    .map(
      (set) => ({
        ...set,
        assets:
          [...set.assets].sort(
            (a, b) => {
              if (
                a.approved &&
                !b.approved
              ) {
                return -1;
              }

              if (
                !a.approved &&
                b.approved
              ) {
                return 1;
              }

              return (
                roleOrder(a.role) -
                roleOrder(b.role)
              );
            }
          ),
      })
    )
    .filter(
      (set) =>
        set.assets.length > 0
    );
}
