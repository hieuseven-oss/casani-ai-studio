import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import {
  getProjectById,
  updateProjectStatus,
} from '../lib/projectService';
import { supabase } from '../lib/supabase';

import {
  generateVisualVersion,
  DEFAULT_IMAGE_MODEL,
} from '../lib/generationWorkflow';

import {
  resolveProductImageUrl,
  resolveAIOutputUrl,
  downloadRemoteImage,
  makeSafeFileName,
} from '../lib/imageService';

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

  const [project, setProject] =
    useState<ProjectData | null>(null);

  // Signed URL chỉ dùng để hiển thị.
  // Không ghi đè product.image_url.
  const [productDisplayUrl, setProductDisplayUrl] =
    useState('');

  const [generations, setGenerations] =
    useState<Generation[]>([]);

  const [generationId, setGenerationId] =
    useState<string | null>(null);

  const [outputs, setOutputs] =
    useState<GenerationOutput[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingVersion, setLoadingVersion] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [approvingId, setApprovingId] =
    useState<string | null>(null);

  const [downloadingId, setDownloadingId] =
    useState<string | null>(null);

  const [regenerating, setRegenerating] =
    useState(false);

  const [customPrompt, setCustomPrompt] =
    useState('');

  const [generatingMore, setGeneratingMore] =
    useState(false);

  async function loadOutputs(
    targetGenerationId: string
  ) {
    const { data, error } =
      await supabase
        .from('generation_outputs')
        .select(
          'id, generation_id, image_url, approved, created_at'
        )
        .eq(
          'generation_id',
          targetGenerationId
        )
        .order(
          'created_at',
          { ascending: true }
        );

    if (error) {
      throw new Error(
        `Generation outputs load failed: ${error.message}`
      );
    }

    const resolvedOutputs =
      await Promise.all(
        (data ?? []).map(
          async (output: any) => ({
            ...output,
            image_url:
              await resolveAIOutputUrl(
                output.image_url
              ),
          })
        )
      );

    setGenerationId(
      targetGenerationId
    );

    setOutputs(
      resolvedOutputs as GenerationOutput[]
    );
  }

  async function loadGenerationHistory(
    projectId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('generations')
      .select(
        'id, status, model, created_at'
      )
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'status',
        'completed'
      )
      .order(
        'created_at',
        { ascending: true }
      );

    if (error) {
      throw new Error(
        `Generation history load failed: ${error.message}`
      );
    }

    return (data ?? []) as Generation[];
  }

  useEffect(() => {
    if (!id) {
      setErrorMsg(
        'Project ID is missing.'
      );
      setLoading(false);
      return;
    }

    const projectId = id;

    async function load() {
      try {
        setErrorMsg('');

        // 1. Load project.
        const data =
          await getProjectById(
            projectId
          );

        const loaded =
          data as ProjectData;

        setProject(loaded);

        const product =
          Array.isArray(
            loaded.products
          )
            ? loaded.products[0]
            : loaded.products;

        // 2. Tạo URL hiển thị riêng.
        // product.image_url vẫn giữ Storage path gốc.
        if (product?.image_url) {
          try {
            const displayUrl =
              await resolveProductImageUrl(
                product.image_url
              );

            setProductDisplayUrl(
              displayUrl
            );
          } catch (imageError) {
            console.error(
              imageError
            );

            setProductDisplayUrl('');
          }
        } else {
          setProductDisplayUrl('');
        }

        // 3. Load version history.
        const history =
          await loadGenerationHistory(
            projectId
          );

        setGenerations(
          history
        );

        if (!history.length) {
          setGenerationId(null);
          setOutputs([]);
          return;
        }

        // 4. Mở version mới nhất.
        const latest =
          history[
            history.length - 1
          ];

        await loadOutputs(
          latest.id
        );
      } catch (error) {
        console.error(
          error
        );

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

  async function selectVersion(
    targetGenerationId: string
  ) {
    if (
      targetGenerationId ===
        generationId ||
      loadingVersion ||
      regenerating ||
      generatingMore
    ) {
      return;
    }

    setLoadingVersion(true);
    setErrorMsg('');

    try {
      await loadOutputs(
        targetGenerationId
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to load this version.'
      );
    } finally {
      setLoadingVersion(false);
    }
  }

  async function approveOutput(
    outputId: string
  ) {
    if (
      !project ||
      !generationId ||
      approvingId
    ) {
      return;
    }

    setApprovingId(
      outputId
    );

    setErrorMsg('');

    try {
      const {
        error: resetError,
      } = await supabase
        .from(
          'generation_outputs'
        )
        .update({
          approved: false,
        })
        .eq(
          'generation_id',
          generationId
        );

      if (resetError) {
        throw new Error(
          `Unable to reset approval: ${resetError.message}`
        );
      }

      const {
        error: approveError,
      } = await supabase
        .from(
          'generation_outputs'
        )
        .update({
          approved: true,
        })
        .eq(
          'id',
          outputId
        )
        .eq(
          'generation_id',
          generationId
        );

      if (approveError) {
        throw new Error(
          `Unable to approve image: ${approveError.message}`
        );
      }

      await updateProjectStatus(
        project.id,
        'approved'
      );

      setProject(
        (current) =>
          current
            ? {
                ...current,
                status: 'approved',
              }
            : current
      );

      setOutputs(
        (current) =>
          current.map(
            (output) => ({
              ...output,
              approved:
                output.id ===
                outputId,
            })
          )
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to approve image.'
      );
    } finally {
      setApprovingId(
        null
      );
    }
  }

  async function downloadOutput(
    output: GenerationOutput,
    index: number,
    productName: string
  ) {
    if (downloadingId) {
      return;
    }

    setDownloadingId(
      output.id
    );

    setErrorMsg('');

    try {
      const versionIndex =
        generations.findIndex(
          (generation) =>
            generation.id ===
            generationId
        ) + 1;

      const safeName =
        makeSafeFileName(
          productName
        ) || 'casani';

      const fileName =
        `${safeName}` +
        `-v${versionIndex || 1}` +
        `-ai-visual-${index + 1}`;

      await downloadRemoteImage(
        output.image_url,
        fileName
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to download image.'
      );
    } finally {
      setDownloadingId(
        null
      );
    }
  }

  async function createNewVersion(
    instruction?: string
  ) {
    if (!project) {
      throw new Error(
        'Project is missing.'
      );
    }

    const product =
      Array.isArray(
        project.products
      )
        ? project.products[0]
        : project.products;

    if (!product) {
      throw new Error(
        'Product is missing.'
      );
    }

    // Đây là Storage path gốc,
    // không phải signed URL hiển thị.
    if (!product.image_url) {
      throw new Error(
        'Original product image is missing.'
      );
    }

    const result =
      await generateVisualVersion({
        projectId:
          project.id,

        productName:
          product.name,

        productImagePath:
          product.image_url,

        space:
          project.space,

        style:
          project.style,

        mood:
          project.mood,

        ratio:
          project.aspect_ratio,

        customPrompt:
          instruction,
      });

    const newGeneration: Generation = {
      id:
        result.generationId,

      status:
        'completed',

      model:
        DEFAULT_IMAGE_MODEL,

      created_at:
        new Date().toISOString(),
    };

    setGenerations(
      (current) => [
        ...current,
        newGeneration,
      ]
    );

    await loadOutputs(
      result.generationId
    );

    return result;
  }

  async function regenerate() {
    if (
      !project ||
      regenerating ||
      generatingMore
    ) {
      return;
    }

    setRegenerating(
      true
    );

    setErrorMsg('');

    try {
      await createNewVersion();
    } catch (error) {
      console.error(
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to regenerate visuals.'
      );
    } finally {
      setRegenerating(
        false
      );
    }
  }

  async function generateMore() {
    if (
      !project ||
      generatingMore ||
      regenerating
    ) {
      return;
    }

    const instruction =
      customPrompt.trim();

    if (!instruction) {
      setErrorMsg(
        'Hãy nhập yêu cầu cho phiên bản mới.'
      );
      return;
    }

    setGeneratingMore(
      true
    );

    setErrorMsg('');

    try {
      await createNewVersion(
        instruction
      );

      setCustomPrompt('');
    } catch (error) {
      console.error(
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to generate new version.'
      );
    } finally {
      setGeneratingMore(
        false
      );
    }
  }

  if (loading) {
    return (
      <div className="empty">
        Loading project...
      </div>
    );
  }

  if (
    errorMsg &&
    !project
  ) {
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
    Array.isArray(
      project.products
    )
      ? project.products[0]
      : project.products;

  const productName =
    product?.name ||
    'Untitled project';

  const selectedVersionIndex =
    generations.findIndex(
      (generation) =>
        generation.id ===
        generationId
    );

  const busy =
    regenerating ||
    generatingMore;

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

          <h1>
            {productName}
          </h1>

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
          onClick={
            regenerate
          }
          disabled={busy}
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
              alignItems:
                'center',
              justifyContent:
                'space-between',
              gap: 16,
              marginBottom: 12,
            }}
          >
            <div>
              <b>
                Generation History
              </b>

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

            {selectedVersionIndex >=
              0 && (
              <span
                style={{
                  opacity: 0.65,
                  fontSize: 13,
                }}
              >
                Viewing Version{' '}
                {selectedVersionIndex +
                  1}
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
              (
                generation,
                index
              ) => {
                const selected =
                  generation.id ===
                  generationId;

                const latest =
                  index ===
                  generations.length -
                    1;

                return (
                  <button
                    type="button"
                    key={
                      generation.id
                    }
                    className={
                      selected
                        ? 'btn primary'
                        : 'btn'
                    }
                    disabled={
                      loadingVersion ||
                      busy
                    }
                    onClick={() =>
                      selectVersion(
                        generation.id
                      )
                    }
                  >
                    Version{' '}
                    {index + 1}

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

      <section
        className="panel"
        style={{
          marginBottom: 28,
        }}
      >
        <div
          style={{
            marginBottom: 12,
          }}
        >
          <b>
            Create a new version
          </b>

          <div
            style={{
              marginTop: 4,
              opacity: 0.65,
              fontSize: 13,
            }}
          >
            Describe what you want to
            change. The original product
            should remain unchanged.
          </div>
        </div>

        <textarea
          value={customPrompt}
          onChange={(event) =>
            setCustomPrompt(
              event.target.value
            )
          }
          disabled={busy}
          placeholder="Ví dụ: Phòng khách trần cao, ánh sáng buổi tối, tường đá tối màu, phong cách luxury hiện đại, giữ nguyên mẫu đèn..."
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            marginBottom: 12,
          }}
        />

        <button
          type="button"
          className="btn primary"
          onClick={
            generateMore
          }
          disabled={
            busy ||
            !customPrompt.trim()
          }
        >
          {generatingMore ? (
            <>
              <Loader2 size={16} />
              Generating new version...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate More
            </>
          )}
        </button>
      </section>

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
          {productDisplayUrl && (
            <article className="result">
              <img
                src={
                  productDisplayUrl
                }
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
              (
                output,
                index
              ) => {
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
                          busy
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
                          busy
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
              No generated visuals yet
            </div>
          )}
        </div>
      )}
    </>
  );
}
