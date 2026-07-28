import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjectsFromSupabase } from '../lib/projectService';
import { getProjects } from '../lib/store';

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

        const mapped: ProjectCard[] = data.map((p: any) => ({
          id: p.id,
          productName: p.products?.name || 'Untitled project',
          imageUrl: '',
          space: p.space || '',
          mood: p.mood || '',
        }));

        setProjects(mapped);
      } catch (error) {
        console.error('Supabase projects load failed:', error);

        // Fallback tạm thời để không phá dữ liệu demo/local cũ.
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
        <div className="empty">Loading projects...</div>
      ) : projects.length ? (
        <div className="grid cards">
          {projects.map((p) => (
            <Link
              to={'/results/' + p.id}
              className="projectCard"
              key={p.id}
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.productName} />
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
        <div className="empty">No generation history yet.</div>
      )}
    </>
  );
}
