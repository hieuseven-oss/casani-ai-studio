import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjectsFromSupabase } from '../lib/projectService';
import { getProjects } from '../lib/store';
import { supabase } from '../lib/supabase';

type ProjectCard = {
  id: string;
  productName: string;
  imageUrl: string;
  space: string;
  mood: string;
  approved: boolean;
};

export default function Projects() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjectsFromSupabase();

        const mapped: ProjectCard[] = await Promise.all(
          data.map(async (p: any) => {
            let imageUrl = '';
            let approved = false;

            // 1. Get latest completed generation
            const {
              data: generation,
              error: generationError,
            } = await supabase
              .from('generations')
              .select('id, created_at')
              .eq('project_id', p.id)
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (generationError) {
              console.warn(
                'Generation load failed:',
                p.id,
                generationError.message
              );
            }

            if (generation?.id) {
              // 2. Prefer approved output
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
                  'Approved output load failed:',
                  p.id,
                  approvedError.message
                );
              }

              if (approvedOutput?.image_url) {
                imageUrl = approvedOutput.image_url;
                approved = true;
              } else {
                // 3. No approved image yet:
                // use first generated visual
                const {
                  data: firstOutput,
                  error: outputError,
                } = await supabase
                  .from('generation_outputs')
                  .select('image_url, created_at')
                  .eq('generation_id', generation.id)
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                if (outputError) {
                  console.warn(
                    'Output load failed:',
                    p.id,
                    outputError.message
                  );
                }

                if (firstOutput?.image_url) {
                  imageUrl = firstOutput.image_url;
                }
              }
            }

            const product = Array.isArray(p.products)
              ? p.products[0]
              : p.products;

            return {
              id: p.id,
              productName:
                product?.name || 'Untitled project',
              imageUrl,
              space: p.space || '',
              mood: p.mood || '',
              approved,
            };
          })
        );

        setProjects(mapped);
      } catch (error) {
        console.error(
          'Supabase projects load failed:',
          error
        );

        // Temporary fallback for old local projects
        const local = getProjects()
          .slice()
          .reverse()
          .map((p) => ({
            id: p.id,
            productName: p.productName,
            imageUrl: p.outputs?.[0] || '',
            space: p.space,
            mood: p.mood,
            approved: false,
          }));

        setProjects(local);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  return (
    <>
      <div className="pageTitle">
        <p className="eyebrow">HISTORY</p>
        <h1>Projects</h1>
        <p>
          Every generated campaign stays organized here.
        </p>
      </div>

      {loading ? (
        <div className="empty">
          Loading projects...
        </div>
      ) : projects.length ? (
        <div className="grid cards">
          {projects.map((p) => (
            <Link
              to={'/results/' + p.id}
              className="projectCard"
              key={p.id}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.productName}
                />
              ) : (
                <div className="projectPlaceholder">
                  No generated visual yet
                </div>
              )}

              <div>
                <b>{p.productName}</b>

                <span>
                  {p.space}
                  {p.mood
                    ? ' · ' + p.mood
                    : ''}
                </span>

                {p.approved && (
                  <small>
                    ✓ Approved visual
                  </small>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          No generation history yet.
        </div>
      )}
    </>
  );
}
