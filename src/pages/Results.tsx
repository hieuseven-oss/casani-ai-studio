import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
} from 'lucide-react';
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
  const [generationId, setGenerationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setErrorMsg('Project ID is missing.');
      setLoading(false);
      return;
    }

    const projectId = id;

    async function load() {
      try {
        const data = await getProjectById(projectId);
        const loaded = data as ProjectData;

        const product = Array.isArray(loaded.products)
          ? loaded.products[0]
          : loaded.products;

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

        if (!generation) {
          setGenerationId(null);
          setOutputs([]);
          return;
        }

        setGenerationId(generation.id);

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

  async function approveOutput(outputId: string) {
    if (!generationId || approvingId) return;

    setApprovingId(outputId);
    setErrorMsg('');

    try {
      const { error: resetError } = await supabase
        .from('generation_outputs')
        .update({ approved: false })
        .eq('generation_id', generationId);

      if (resetError) {
        throw new Error(
          `Unable to reset approval: ${resetError.message}`
        );
      }

      const { error: approveError } = await supabase
        .from('generation_outputs')
        .update({ approved: true })
        .eq('id', outputId)
        .eq('generation_id', generationId);

      if (approveError) {
        throw new Error(
          `Unable to approve image: ${approveError.message}`
        );
      }

      setOutputs((current) =>
        current.map((output) => ({
          ...output,
          approved: output.id === outputId,
        }))
      );
    } catch (error) {
      console.error(error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to approve image.'
      );
    } finally {
      setApprovingId(null);
    }
  }

  async function downloadOutput(
    output: GenerationOutput,
    index: number,
    productName: string
  ) {
    if (downloadingId) return;

    setDownloadingId(output.id);
    setErrorMsg('');

    try {
      const response = await fetch(output.image_url);

      if (!response.ok) {
        throw new Error(
          `Download failed with status ${response.status}`
        );
      }

      const blob = await response.blob();

      const extension =
        blob.type.includes('png')
          ? 'png'
          : blob.type.includes('webp')
          ? 'webp'
          : 'jpg';

      const safeName = productName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const fileName =
        `${safeName || 'casani'}-ai-visual-${index + 1}.${extension}`;

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = blobUrl;
      anchor.download = fileName;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error(error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to download image.'
      );
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return <div className="empty">Loading project...</div>;
  }

  if (errorMsg && !project) {
    return <div className="empty">{errorMsg}</div>;
  }

  if (!project) {
    return <div className="empty">Project not found.</div>;
  }

  const product = Array.isArray(project.products)
    ? project.products[0]
    : project.products;

  const productName =
    product?.name || 'Untitled project';

  return (
    <>
      <header className="sectionHead topmini">
        <div>
          <Link to="/projects" className="back">
            <ArrowLeft size={16} />
            Projects
          </Link>

          <h1>{productName}</h1>

          <p>
            {project.style || '—'} ·{' '}
            {project.space || '—'} ·{' '}
            {project.mood || '—'} ·{' '}
            {project.aspect_ratio || '—'}
          </p>
        </div>
      </header>

      {errorMsg && (
        <div className="empty">
          {errorMsg}
        </div>
      )}

      <div className="resultGrid">
        {product?.image_url && (
          <article className="result">
            <img
              src={product.image_url}
              alt={productName}
            />

            <div className="resultActions">
              <span>Original product</span>
            </div>
          </article>
        )}

        {outputs.length > 0 ? (
          outputs.map((output, index) => {
            const isApproved = Boolean(output.approved);
            const isApproving = approvingId === output.id;
            const isDownloading = downloadingId === output.id;

            return (
              <article
                className={`result ${
                  isApproved ? 'approvedResult' : ''
                }`}
                key={output.id}
              >
                <img
                  src={output.image_url}
                  alt={`AI visual ${index + 1}`}
                />

                <div className="resultActions">
                  <span>
                    AI visual {index + 1}
                  </span>

                  <button
                    type="button"
                    className={
                      isApproved
                        ? 'btn primary'
                        : 'btn'
                    }
                    onClick={() => approveOutput(output.id)}
                    disabled={
                      Boolean(approvingId) || isApproved
                    }
                  >
                    {isApproving ? (
                      <>
                        <Loader2 size={16} />
                        Saving...
                      </>
                    ) : isApproved ? (
                      <>
                        <Check size={16} />
                        Approved
                      </>
                    ) : (
                      'Approve'
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      downloadOutput(
                        output,
                        index,
                        productName
                      )
                    }
                    disabled={Boolean(downloadingId)}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 size={16} />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download
                      </>
                    )}
                  </button>

                  <a
                    href={output.image_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open image
                  </a>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty">
            No generated visuals yet
          </div>
        )}
      </div>
    </>
  );
}
