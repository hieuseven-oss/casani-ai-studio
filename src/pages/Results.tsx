import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getProjectById } from '../lib/projectService';
import { supabase } from '../lib/supabase';

type ProjectData = {
  id: string;
  space: string | null;
  style: string | null;
  mood: string | null;
  aspect_ratio: string | null;
  status: string | null;
  products:
    | {
        id: string;
        name: string;
        image_url: string | null;
        sku: string | null;
      }
    | {
        id: string;
        name: string;
        image_url: string | null;
        sku: string | null;
      }[]
    | null;
};

export default function Results() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id) {
      setErrorMsg('Project ID is missing.');
      setLoading(false);
      return;
    }

    getProjectById(id)
      .then(async (data) => {
        const loaded = data as ProjectData;

        const product = Array.isArray(loaded.products)
          ? loaded.products[0]
          : loaded.products;

        if (product?.image_url) {
          const { data: signed } = await supabase.storage
            .from('product-images')
            .createSignedUrl(product.image_url, 60 * 60);

          if (signed?.signedUrl) {
            product.image_url = signed.signedUrl;
          }
        }

        setProject(loaded);
      })
      .catch((error) => {
        setErrorMsg(
          error instanceof Error ? error.message : 'Unable to load project.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="empty">Loading project...</div>;
  }

  if (errorMsg || !project) {
    return (
      <div className="empty">
        {errorMsg || 'Project not found.'}
      </div>
    );
  }

  const product = Array.isArray(project.products)
    ? project.products[0]
    : project.products;

  return (
    <>
      <header className="sectionHead topmini">
        <div>
          <Link to="/projects" className="back">
            <ArrowLeft size={16} />
            Projects
          </Link>

          <h1>{product?.name || 'Untitled project'}</h1>

          <p>
            {project.style || '—'} · {project.space || '—'} ·{' '}
            {project.mood || '—'} · {project.aspect_ratio || '—'}
          </p>
        </div>
      </header>

      <div className="resultGrid">
        {product?.image_url && (
          <article className="result">
            <img
              src={product.image_url}
              alt={product.name || 'Product'}
            />

            <div className="resultActions">
              <span>Original product</span>
            </div>
          </article>
        )}

        <div className="empty">
          No generated visuals yet
        </div>
      </div>
    </>
  );
}
