import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getProjectById } from '../lib/projectService';
import { supabase } from '../lib/supabase';

type ProductData = {
  id: string;
  name: string;
  image_url: string | null;
  sku: string | null;
};

type ProjectData = {
  id: string;
  space: string | null;
  style: string | null;
  mood: string | null;
  aspect_ratio: string | null;
  status: string | null;
  products: ProductData | ProductData[] | null;
};

type GenerationOutput = {
  id: string;
  generation_id: string;
  image_url: string;
  approved: boolean | null;
  created_at: string;
};

export default function Results() {
  const { id } = useParams();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [outputs, setOutputs] = useState<GenerationOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id) {
      setErrorMsg('Project ID is missing.');
      setLoading(false);
      return;
    }

    const projectId = id;

    async function load() {
      try {
        // 1. Load project + related product
        const data = await getProjectById(projectId);
        const loaded = data as ProjectData;

        const product = Array.isArray(loaded.products)
          ? loaded.products[0]
          : loaded.products;

        // 2. Convert product Storage path to signed URL
        if (product?.image_url) {
          const { data: signed, error: signedError } =
            await supabase.storage
              .from('product-images')
              .createSignedUrl(product.image_url, 60 * 60);

          if (signedError) {
            console.warn(
              'Unable to create product image signed URL:',
              signedError.message
            );
          }

          if (signed?.signedUrl) {
            product.image_url = signed.signedUrl;
          }
        }

        setProject(loaded);

        // 3. Get latest completed generation for this project
        const {
          data: generation,
          error: generationError,
        } = await supabase
          .from('generations')
          .select('id, status, created_at')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (generationError) {
          throw new Error(
            `Generation load failed: ${generationError.message}`
          );
        }

        // Project exists but has no completed generation yet
        if (!generation) {
          setOutputs([]);
          return;
        }

        // 4. Load generated AI images
        const {
          data: generatedOutputs,
          error: outputsError,
        } = await supabase
          .from('generation_outputs')
          .select(
            'id, generation_id, image_url, approved, created_at'
          )
          .eq('generation_id', generation.id)
          .order('created_at', { ascending: true });

        if (outputsError) {
          throw new Error(
            `Generation outputs load failed: ${outputsError.message}`
          );
        }

        setOutputs(
          (generatedOutputs ?? []) as GenerationOutput[]
        );
      } catch (error) {
        console.error(error);

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to load project.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="empty">
        Loading project...
      </div>
    );
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

          <h1>
            {product?.name || 'Untitled project'}
          </h1>

          <p>
            {project.style || '—'} ·{' '}
            {project.space || '—'} ·{' '}
            {project.mood || '—'} ·{' '}
            {project.aspect_ratio || '—'}
          </p>
        </div>
      </header>

      <div className="resultGrid">
        {product?.image_url && (
          <article className="result">
            <img
              src={product.image_url}
              alt={product.name || 'Original product'}
            />

            <div className="resultActions">
              <span>Original product</span>
            </div>
          </article>
        )}

        {outputs.length > 0 ? (
          outputs.map((output, index) => (
            <article
              className="result"
              key={output.id}
            >
              <img
                src={output.image_url}
                alt={`AI visual ${index + 1}`}
              />

              <div className="resultActions">
                <span>
                  AI visual {index + 1}
                  {output.approved
                    ? ' · Approved'
                    : ''}
                </span>

                <a
                  href={output.image_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open image
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            No generated visuals yet
          </div>
        )}
      </div>
    </>
  );
}
