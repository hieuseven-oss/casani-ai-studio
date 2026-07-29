import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { getProjectById } from '../lib/projectService';
import {
  createGeneration,
  saveGenerationOutputs,
  updateGenerationStatus,
} from '../lib/generationService';
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

type Generation = {
  id: string;
  status: string | null;
  model: string | null;
  created_at: string;
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

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<GenerationOutput[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingVersion, setLoadingVersion] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function loadOutputs(targetGenerationId: string) {
    const {
      data,
      error,
    } = await supabase
      .from('generation_outputs')
      .select(
        'id, generation_id, image_url, approved, created_at'
      )
      .eq('generation_id', targetGenerationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(
        `Generation outputs load failed: ${error.message}`
      );
    }

    setGenerationId(targetGenerationId);
    setOutputs((data ?? []) as GenerationOutput[]);
  }

  useEffect(() => {
    if (!id) {
      setErrorMsg('Project ID is missing.');
      setLoading(false);
      return;
    }

    const projectId = id;

    async function load() {
      try {
        // 1. Project + product
        const data = await getProjectById(projectId);
        const loaded = data as ProjectData;

        const product = Array.isArray(loaded.products)
          ? loaded.products[0]
          : loaded.products;

        // Original product image is stored privately.
        // Convert Storage path into a temporary signed URL.
        if (product?.image_url) {
          const {
            data: signed,
            error: signedError,
          } = await supabase.storage
            .from('product-images')
            .createSignedUrl(
              product.image_url,
              60 * 60
            );

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

        // 2. Load every completed generation.
        // Oldest first = Version 1, Version 2, Version 3...
        const {
          data: generationRows,
          error: generationError,
        } = await supabase
          .from('generations')
          .select('id, status, model, created_at')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .order('created_at', { ascending: true });

        if (generationError) {
          throw new Error(
            `Generation history load failed: ${generationError.message}`
          );
        }

        const history =
          (generationRows ?? []) as Generation[];

        setGenerations(history);

        if (!history.length) {
          setGenerationId(null);
          setOutputs([]);
          return;
        }

        // 3. Open newest version by default.
        const latest =
          history[history.length - 1];

        await loadOutputs(latest.id);
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

  async function selectVersion(targetGenerationId: string) {
    if (
      targetGenerationId === generationId ||
      loadingVersion ||
      regenerating
    ) {
      return;
    }

    setLoadingVersion(true);
    setErrorMsg('');

    try {
      await loadOutputs(targetGenerationId);
    } catch (error) {
      console.error(error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to load this version.'
      );
    } finally {
      setLoadingVersion(false);
    }
  }

  async function approveOutput(outputId: string) {
    if (!generationId || approvingId) return;

    setApprovingId(outputId);
    setErrorMsg('');

    try {
      // Approval belongs to the currently selected generation.
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

      const versionIndex =
        generations.findIndex(
          (generation) =>
            generation.id === generationId
        ) + 1;

      const fileName =
        `${safeName || 'casani'}` +
        `-v${versionIndex || 1}` +
        `-ai-visual-${index + 1}.${extension}`;

      const blobUrl =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

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

  async function regenerate() {
    if (!project || regenerating) return;

    const product = Array.isArray(project.products)
      ? project.products[0]
      : project.products;

    if (!product?.image_url) {
      setErrorMsg(
        'Original product image is missing.'
      );
      return;
    }

    setRegenerating(true);
    setErrorMsg('');

    let newGenerationId: string | null = null;

    try {
      // 1. New generation = new version.
      const generation =
        await createGeneration({
          projectId: project.id,
          prompt:
            `${product.name} | ` +
            `${project.space || ''} | ` +
            `${project.style || ''} | ` +
            `${project.mood || ''} | ` +
            `${project.aspect_ratio || ''}`,
          model:
            'black-forest-labs/FLUX.2-pro',
        });

      const createdGenerationId =
        generation.id as string;

      newGenerationId =
        createdGenerationId;

      await updateGenerationStatus(
        createdGenerationId,
        'processing'
      );

      // 2. Generate 4 new visuals.
      const {
        data,
        error,
      } = await supabase.functions.invoke(
        'generate-visual',
        {
          body: {
            image_url: product.image_url,
            space: project.space,
            style: project.style,
            mood: project.mood,
            ratio: project.aspect_ratio,
            name: product.name,
          },
        }
      );

      if (error) {
        throw error;
      }

      const imageUrls: string[] =
        Array.isArray(data?.images)
          ? data.images
              .map(
                (item: any) =>
                  item?.url || item
              )
              .filter(Boolean)
              .slice(0, 4)
          : [];

      if (!imageUrls.length) {
        throw new Error(
          'AI returned no regenerated images.'
        );
      }

      // 3. Persist new version.
      await saveGenerationOutputs(
        createdGenerationId,
        imageUrls
      );

      await updateGenerationStatus(
        createdGenerationId,
        'completed'
      );

      // 4. Add it to history and immediately open it.
      const newGeneration: Generation = {
        id: createdGenerationId,
        status: 'completed',
        model:
          'black-forest-labs/FLUX.2-pro',
        created_at:
          new Date().toISOString(),
      };

      setGenerations((current) => [
        ...current,
        newGeneration,
      ]);

      await loadOutputs(
        createdGenerationId
      );
    } catch (error) {
      console.error(error);

      if (newGenerationId) {
        try {
          await updateGenerationStatus(
            newGenerationId,
            'failed'
          );
        } catch (statusError) {
          console.error(
            'Unable to mark generation failed:',
            statusError
          );
        }
      }

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to regenerate visuals.'
      );
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="empty">
        Loading project...
      </div>
    );
  }

  if (errorMsg && !project) {
    return (
      <div className="empty">
        {errorMsg}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="empty">
        Project not found.
      </div>
    );
  }

  const product =
    Array.isArray(project.products)
      ? project.products[0]
      : project.products;

  const productName =
    product?.name ||
    'Untitled project';

  const selectedVersionIndex =
    generations.findIndex(
      (generation) =>
        generation.id === generationId
    );

  return (
    <>
      <header className="sectionHead topmini">
        <div>
          <Link
            to="/projects"
            className="back"
          >
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

        <button
          type="button"
          className="btn"
          onClick={regenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <>
              <Loader2 size={16} />
              Generating 4 visuals...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Regenerate
            </>
          )}
        </button>
      </header>

      {generations.length > 0 && (
        <section
          style={{
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 12,
            }}
          >
            <div>
              <b>Generation History</b>

              <div
                style={{
                  marginTop: 4,
                  opacity: 0.65,
                  fontSize: 13,
                }}
              >
                {generations.length}{' '}
                {generations.length === 1
                  ? 'version'
                  : 'versions'}
              </div>
            </div>

            {selectedVersionIndex >= 0 && (
              <span
                style={{
                  opacity: 0.65,
                  fontSize: 13,
                }}
              >
                Viewing Version{' '}
                {selectedVersionIndex + 1}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {generations.map(
              (generation, index) => {
                const selected =
                  generation.id ===
                  generationId;

                const latest =
                  index ===
                  generations.length - 1;

                return (
                  <button
                    type="button"
                    key={generation.id}
                    className={
                      selected
                        ? 'btn primary'
                        : 'btn'
                    }
                    disabled={
                      loadingVersion ||
                      regenerating
                    }
                    onClick={() =>
                      selectVersion(
                        generation.id
                      )
                    }
                  >
                    {loadingVersion &&
                    selected ? (
                      <Loader2 size={16} />
                    ) : null}

                    Version {index + 1}

                    {latest
                      ? ' · Latest'
                      : ''}
                  </button>
                );
              }
            )}
          </div>
        </section>
      )}

      {errorMsg && (
        <div className="empty">
          {errorMsg}
        </div>
      )}

      {loadingVersion ? (
        <div className="empty">
          Loading version...
        </div>
      ) : (
        <div className="resultGrid">
          {product?.image_url && (
            <article className="result">
              <img
                src={product.image_url}
                alt={productName}
              />

              <div className="resultActions">
                <span>
                  Original product
                </span>
              </div>
            </article>
          )}

          {outputs.length > 0 ? (
            outputs.map(
              (output, index) => {
                const isApproved =
                  Boolean(
                    output.approved
                  );

                const isApproving =
                  approvingId ===
                  output.id;

                const isDownloading =
                  downloadingId ===
                  output.id;

                return (
                  <article
                    className={`result ${
                      isApproved
                        ? 'approvedResult'
                        : ''
                    }`}
                    key={output.id}
                  >
                    <img
                      src={
                        output.image_url
                      }
                      alt={`AI visual ${
                        index + 1
                      }`}
                    />

                    <div className="resultActions">
                      <span>
                        AI visual{' '}
                        {index + 1}
                      </span>

                      <button
                        type="button"
                        className={
                          isApproved
                            ? 'btn primary'
                            : 'btn'
                        }
                        onClick={() =>
                          approveOutput(
                            output.id
                          )
                        }
                        disabled={
                          Boolean(
                            approvingId
                          ) ||
                          isApproved ||
                          regenerating
                        }
                      >
                        {isApproving ? (
                          <>
                            <Loader2
                              size={16}
                            />
                            Saving...
                          </>
                        ) : isApproved ? (
                          <>
                            <Check
                              size={16}
                            />
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
                        disabled={
                          Boolean(
                            downloadingId
                          ) ||
                          regenerating
                        }
                      >
                        {isDownloading ? (
                          <>
                            <Loader2
                              size={16}
                            />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download
                              size={16}
                            />
                            Download
                          </>
                        )}
                      </button>

                      <a
                        href={
                          output.image_url
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open image
                      </a>
                    </div>
                  </article>
                );
              }
            )
          ) : (
            <div className="empty">
              No generated visuals
              yet
            </div>
          )}
        </div>
      )}
    </>
  );
}
