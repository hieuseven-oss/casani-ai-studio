import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  getProjectsFromSupabase,
} from '../lib/projectService';

import {
  resolveProductImageUrl,
} from '../lib/imageService';

import {
  supabase,
} from '../lib/supabase';

type ProjectStatus =
  | 'draft'
  | 'generating'
  | 'completed'
  | 'approved'
  | 'failed';

type ProjectCard = {
  id: string;
  productName: string;
  imageUrl: string;
  space: string;
  style: string;
  mood: string;
  status: ProjectStatus;
  hasApprovedVisual: boolean;
};

type FilterStatus =
  | 'all'
  | ProjectStatus;

const filters: {
  value: FilterStatus;
  label: string;
}[] = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'draft',
    label: 'Draft',
  },
  {
    value: 'generating',
    label: 'Generating',
  },
  {
    value: 'completed',
    label: 'Completed',
  },
  {
    value: 'approved',
    label: 'Approved',
  },
  {
    value: 'failed',
    label: 'Failed',
  },
];

export default function Projects() {
  const [
    projects,
    setProjects,
  ] =
    useState<ProjectCard[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMsg,
    setErrorMsg,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState<FilterStatus>(
      'all'
    );

  useEffect(() => {
    async function loadProjects() {
      try {
        setErrorMsg('');

        const data =
          await getProjectsFromSupabase();

        const mapped:
          ProjectCard[] =
          await Promise.all(
            data.map(
              async (
                project: any
              ) => {
                const product =
                  Array.isArray(
                    project.products
                  )
                    ? project.products[0]
                    : project.products;

                let imageUrl = '';
                let hasApprovedVisual =
                  false;

                // 1. Find every successful generation.
                const {
                  data:
                    completedGenerations,
                  error:
                    generationsError,
                } =
                  await supabase
                    .from(
                      'generations'
                    )
                    .select(
                      'id, created_at'
                    )
                    .eq(
                      'project_id',
                      project.id
                    )
                    .eq(
                      'status',
                      'completed'
                    )
                    .order(
                      'created_at',
                      {
                        ascending:
                          false,
                      }
                    );

                if (
                  generationsError
                ) {
                  console.warn(
                    'Project generation lookup failed:',
                    project.id,
                    generationsError.message
                  );
                }

                const generationIds =
                  (
                    completedGenerations ??
                    []
                  ).map(
                    (
                      generation
                    ) =>
                      generation.id
                  );

                // 2. Approved visual can belong
                // to ANY successful version.
                if (
                  generationIds.length
                ) {
                  const {
                    data:
                      approvedOutput,
                    error:
                      approvedError,
                  } =
                    await supabase
                      .from(
                        'generation_outputs'
                      )
                      .select(
                        'image_url, created_at'
                      )
                      .in(
                        'generation_id',
                        generationIds
                      )
                      .eq(
                        'approved',
                        true
                      )
                      .order(
                        'created_at',
                        {
                          ascending:
                            false,
                        }
                      )
                      .limit(1)
                      .maybeSingle();

                  if (
                    approvedError
                  ) {
                    console.warn(
                      'Approved visual lookup failed:',
                      project.id,
                      approvedError.message
                    );
                  }

                  if (
                    approvedOutput
                      ?.image_url
                  ) {
                    imageUrl =
                      approvedOutput.image_url;

                    hasApprovedVisual =
                      true;
                  }
                }

                // 3. If no approved visual exists,
                // use first output from latest successful generation.
                const latestGeneration =
                  completedGenerations?.[0];

                if (
                  !imageUrl &&
                  latestGeneration?.id
                ) {
                  const {
                    data:
                      latestOutput,
                    error:
                      outputError,
                  } =
                    await supabase
                      .from(
                        'generation_outputs'
                      )
                      .select(
                        'image_url, created_at'
                      )
                      .eq(
                        'generation_id',
                        latestGeneration.id
                      )
                      .order(
                        'created_at',
                        {
                          ascending:
                            true,
                        }
                      )
                      .limit(1)
                      .maybeSingle();

                  if (
                    outputError
                  ) {
                    console.warn(
                      'Latest output lookup failed:',
                      project.id,
                      outputError.message
                    );
                  }

                  if (
                    latestOutput
                      ?.image_url
                  ) {
                    imageUrl =
                      latestOutput.image_url;
                  }
                }

                // 4. Final fallback:
                // original product image.
                if (
                  !imageUrl &&
                  product?.image_url
                ) {
                  try {
                    imageUrl =
                      await resolveProductImageUrl(
                        product.image_url
                      );
                  } catch (
                    imageError
                  ) {
                    console.warn(
                      'Product thumbnail failed:',
                      project.id,
                      imageError
                    );
                  }
                }

                return {
                  id:
                    project.id,

                  productName:
                    product?.name ||
                    'Untitled project',

                  imageUrl,

                  space:
                    project.space ||
                    '',

                  style:
                    project.style ||
                    '',

                  mood:
                    project.mood ||
                    '',

                  status:
                    normalizeStatus(
                      project.status
                    ),

                  hasApprovedVisual,
                };
              }
            )
          );

        setProjects(
          mapped
        );
      } catch (error) {
        console.error(
          'Projects load failed:',
          error
        );

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to load projects.'
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    loadProjects();
  }, []);

  const filteredProjects =
    useMemo(() => {
      if (
        filter === 'all'
      ) {
        return projects;
      }

      return projects.filter(
        (project) =>
          project.status ===
          filter
      );
    }, [
      projects,
      filter,
    ]);

  return (
    <>
      <div className="pageTitle">
        <p className="eyebrow">
          HISTORY
        </p>

        <h1>
          Projects
        </h1>

        <p>
          Every generated campaign
          stays organized here.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        {filters.map(
          (item) => (
            <button
              key={
                item.value
              }
              type="button"
              className={
                filter ===
                item.value
                  ? 'btn primary'
                  : 'btn'
              }
              onClick={() =>
                setFilter(
                  item.value
                )
              }
            >
              {item.label}

              {' '}

              (
              {countStatus(
                projects,
                item.value
              )}
              )
            </button>
          )
        )}
      </div>

      {errorMsg && (
        <div className="empty">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty">
          Loading projects...
        </div>
      ) : filteredProjects.length ? (
        <div className="grid cards">
          {filteredProjects.map(
            (project) => (
              <Link
                to={
                  '/results/' +
                  project.id
                }
                className="projectCard"
                key={
                  project.id
                }
              >
                {project.imageUrl ? (
                  <img
                    src={
                      project.imageUrl
                    }
                    alt={
                      project.productName
                    }
                  />
                ) : (
                  <div className="projectPlaceholder">
                    No visual yet
                  </div>
                )}

                <div>
                  <b>
                    {
                      project.productName
                    }
                  </b>

                  <span>
                    {project.style ||
                      '—'}

                    {' · '}

                    {project.space ||
                      '—'}

                    {project.mood
                      ? ` · ${project.mood}`
                      : ''}
                  </span>

                  <small>
                    {statusLabel(
                      project.status
                    )}

                    {project.hasApprovedVisual &&
                    project.status !==
                      'approved'
                      ? ' · Approved visual exists'
                      : ''}
                  </small>
                </div>
              </Link>
            )
          )}
        </div>
      ) : (
        <div className="empty">
          {filter === 'all'
            ? 'No projects yet.'
            : `No ${filter} projects.`}
        </div>
      )}
    </>
  );
}

function normalizeStatus(
  status: unknown
): ProjectStatus {
  switch (status) {
    case 'generating':
    case 'completed':
    case 'approved':
    case 'failed':
    case 'draft':
      return status;

    default:
      return 'draft';
  }
}

function statusLabel(
  status: ProjectStatus
) {
  switch (status) {
    case 'approved':
      return '✓ Approved';

    case 'completed':
      return 'Completed';

    case 'generating':
      return 'Generating...';

    case 'failed':
      return 'Generation failed';

    case 'draft':
    default:
      return 'Draft';
  }
}

function countStatus(
  projects: ProjectCard[],
  filter: FilterStatus
) {
  if (
    filter === 'all'
  ) {
    return projects.length;
  }

  return projects.filter(
    (project) =>
      project.status ===
      filter
  ).length;
}
