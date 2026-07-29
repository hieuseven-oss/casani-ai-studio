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

            // 1. Lấy generation completed mới nhất của project
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
                'Generation load failed for project:',
                p.id,
                generationError.message
              );
            }

            // 2. Lấy output đầu tiên làm thumbnail
            if (generation?.id) {
              const {
                data: output,
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
                  'Output load failed for project:',
                  p.id,
                  outputError.message
                );
              }

              if (output?.image_url) {
                imageUrl = output.image_url;
              }
            }

            const product = Array.isArray(p.products)
              ? p.products[0]
              : p.products;

            return {
              id: p.id,
              productName: product?.name || 'Untitled project',
              imageUrl,
              space: p.space || '',
              mood: p.mood || '',
            };
          })
        );

        setProjects(mapped);
      } catch (error) {
        console.error('Supabase projects load failed:', error);

        // Fallback local cũ nếu Supabase lỗi hoàn toàn
        const local = getProjects()
          .slice()
          .reverse()
          .map((p) => ({
            id: p.id,
            productName: p.productName,
            imageUrl: p.outputs?.[0] || '',
            space: p.space,
            mood: p.mood,
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
        <p>Every generated campaign stays organized here.</p>
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
                  {p.mood ? ' · ' + p.mood : ''}
                </span>
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
