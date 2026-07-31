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
  approveGenerationOutput,
  updateOutputShortlist,
  updateOutputDecisionMeta,
} from '../lib/generationService';

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

  // V12 semantic output role.
  // Camera Set examples:
  // left_three_quarter
  // right_three_quarter
  // hero_close
  role: string | null;

  approved: boolean | null;
  shortlisted: boolean;
  shortlist_rank: number | null;
  shortlist_note: string | null;
  finalist: boolean;
  created_at: string;
};

type ShortlistItem = GenerationOutput & {
  versionNumber: number;
  visualNumber: number;
};

const CAMERA_SET_ROLES = [
  'left_three_quarter',
  'right_three_quarter',
  'hero_close',
] as const;

function isCameraSetOutput(
  output: GenerationOutput
) {
  return CAMERA_SET_ROLES.includes(
    output.role as typeof CAMERA_SET_ROLES[number]
  );
}

function isCompleteCameraSet(
  outputs: GenerationOutput[]
) {
  return CAMERA_SET_ROLES.every(
    (role) =>
      outputs.some(
        (output) =>
          output.role === role
      )
  );
}

function outputRoleLabel(
  role: string | null,
  fallbackIndex?: number
) {
  switch (role) {
    case 'front':
      return 'Chính diện';

    case 'left_three_quarter':
      return '3/4 trái';

    case 'right_three_quarter':
      return '3/4 phải';

    case 'hero_close':
      return 'Cận cảnh đèn';

    case 'detail':
      return 'Chi tiết';

    case 'catalog':
      return 'Catalogue';

    case 'lifestyle':
      return 'Lifestyle';

    case 'social':
      return 'Social';

    default:
      return fallbackIndex
        ? `AI visual ${fallbackIndex}`
        : 'AI visual';
  }
}

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

  const [shortlistItems, setShortlistItems] =
    useState<ShortlistItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingVersion, setLoadingVersion] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [approvingId, setApprovingId] =
    useState<string | null>(null);

  const [shortlistingId, setShortlistingId] =
    useState<string | null>(null);

  const [downloadingId, setDownloadingId] =
    useState<string | null>(null);

  const [regenerating, setRegenerating] =
    useState(false);

  const [customPrompt, setCustomPrompt] =
    useState('');

  const [cameraPreset, setCameraPreset] =
    useState<
      'front' | 'left_three_quarter' | 'right_three_quarter' | 'hero_close'
    >('front');

  const [generatingMore, setGeneratingMore] =
    useState(false);

  // Results Studio V1
  const [selectedOutputId, setSelectedOutputId] =
    useState<string | null>(null);

  // Camera Master V10.2
  //
  // Independent from the Version currently being viewed.
  // Camera variations must always branch from this stable
  // visual instead of chaining from the latest camera output.
  const [cameraMaster, setCameraMaster] =
    useState<{
      outputId?: string;
      generationId: string;
      imageUrl: string;
      label: string;
    } | null>(null);

  const [referenceMode, setReferenceMode] =
    useState<'visual' | 'product'>('visual');

  const [variationType, setVariationType] =
    useState<
      'scene' | 'lighting' | 'camera' | 'creative'
    >('scene');

  type CompareItem = {
    outputId: string;
    generationId: string;
    imageUrl: string;

    // V12 semantic output role
    role: string | null;

    approved: boolean;
    versionNumber: number;
    visualNumber: number;
  };

  // Cross-version Compare
  const [compareItems, setCompareItems] =
    useState<CompareItem[]>([]);

  const compareMode =
    compareItems.length > 0;

  async function loadProjectShortlist(
    history: Generation[]
  ) {
    const generationIds =
      history.map(
        (generation) => generation.id
      );

    if (!generationIds.length) {
      setShortlistItems([]);
      return;
    }

    const { data, error } =
      await supabase
        .from('generation_outputs')
        .select(
          'id, generation_id, image_url, role, approved, shortlisted, shortlist_rank, shortlist_note, finalist, created_at'
        )
        .in(
          'generation_id',
          generationIds
        )
        .eq(
          'shortlisted',
          true
        )
        .order(
          'created_at',
          { ascending: true }
        );

    if (error) {
      throw new Error(
        `Project shortlist load failed: ${error.message}`
      );
    }

    const resolved =
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

    const visualCounters =
      new Map<string, number>();

    const items =
      resolved.map(
        (output: GenerationOutput) => {
          const visualNumber =
            (visualCounters.get(
              output.generation_id
            ) || 0) + 1;

          visualCounters.set(
            output.generation_id,
            visualNumber
          );

          const versionIndex =
            history.findIndex(
              (generation) =>
                generation.id ===
                output.generation_id
            );

          return {
            ...output,
            versionNumber:
              versionIndex >= 0
                ? versionIndex + 1
                : 1,
            visualNumber,
          };
        }
      );

    setShortlistItems(items);
  }

  async function loadOutputs(
    targetGenerationId: string
  ) {
    const { data, error } =
      await supabase
        .from('generation_outputs')
        .select(
          'id, generation_id, image_url, role, approved, shortlisted, shortlist_rank, shortlist_note, finalist, created_at'
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

    const nextOutputs =
      resolvedOutputs as GenerationOutput[];

    setOutputs(nextOutputs);

    const preferred =
      nextOutputs.find(
        (output) => output.approved
      ) || nextOutputs[0];

    setSelectedOutputId(
      preferred?.id || null
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
          setShortlistItems([]);
          return;
        }

        await loadProjectShortlist(
          history
        );

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

  async function toggleShortlist(
    output: GenerationOutput
  ) {
    if (shortlistingId) {
      return;
    }

    const nextValue =
      !Boolean(output.shortlisted);

    setShortlistingId(
      output.id
    );

    setErrorMsg('');

    try {
      await updateOutputShortlist(
        output.id,
        nextValue
      );

      setOutputs(
        (current) =>
          current.map(
            (item) =>
              item.id === output.id
                ? {
                    ...item,
                    shortlisted:
                      nextValue,
                  }
                : item
          )
      );

      await loadProjectShortlist(
        generations
      );

    } catch (error) {
      console.error(
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to update shortlist.'
      );
    } finally {
      setShortlistingId(
        null
      );
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
      await approveGenerationOutput(
        outputId,
        project.id
      );

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

              shortlisted:
                output.id ===
                outputId
                  ? true
                  : output.shortlisted,
            })
          )
      );

      await loadProjectShortlist(
        generations
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

  function toggleCompareOutput(
    output: GenerationOutput,
    visualNumber: number
  ) {
    if (!generationId) {
      return;
    }

    const versionIndex =
      generations.findIndex(
        (generation) =>
          generation.id === generationId
      );

    const item: CompareItem = {
      outputId: output.id,
      generationId,
      imageUrl: output.image_url,
      role: output.role,
      approved: Boolean(
        output.approved
      ),
      versionNumber:
        versionIndex >= 0
          ? versionIndex + 1
          : 1,
      visualNumber,
    };

    setCompareItems(
      (current) => {
        const exists =
          current.some(
            (compareItem) =>
              compareItem.outputId ===
              output.id
          );

        if (exists) {
          return current.filter(
            (compareItem) =>
              compareItem.outputId !==
              output.id
          );
        }

        if (current.length >= 2) {
          return [
            current[1],
            item,
          ];
        }

        return [
          ...current,
          item,
        ];
      }
    );
  }

  async function useShortlistAsReference(
    item: ShortlistItem
  ) {
    if (
      item.generation_id !==
      generationId
    ) {
      await selectVersion(
        item.generation_id
      );
    }

    setSelectedOutputId(
      item.id
    );

    setReferenceMode(
      'visual'
    );

    setTimeout(() => {
      document
        .getElementById(
          'results-studio'
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 100);
  }

  function toggleCompareShortlistItem(
    item: ShortlistItem
  ) {
    const compareItem: CompareItem = {
      outputId: item.id,
      generationId:
        item.generation_id,
      imageUrl:
        item.image_url,
      role:
        item.role,
      approved:
        Boolean(item.approved),
      versionNumber:
        item.versionNumber,
      visualNumber:
        item.visualNumber,
    };

    setCompareItems(
      (current) => {
        const exists =
          current.some(
            (entry) =>
              entry.outputId ===
              item.id
          );

        if (exists) {
          return current.filter(
            (entry) =>
              entry.outputId !==
              item.id
          );
        }

        if (current.length >= 2) {
          return [
            current[1],
            compareItem,
          ];
        }

        return [
          ...current,
          compareItem,
        ];
      }
    );
  }

  async function updateShortlistRank(
    item: ShortlistItem,
    value: string
  ) {
    const rank =
      value.trim() === ''
        ? null
        : Number(value);

    if (
      rank !== null &&
      (
        !Number.isInteger(rank) ||
        rank < 1
      )
    ) {
      setErrorMsg(
        'Rank must be a positive whole number.'
      );
      return;
    }

    try {
      await updateOutputDecisionMeta(
        item.id,
        {
          shortlist_rank: rank,
        }
      );

      setShortlistItems(
        (current) =>
          current.map(
            (entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    shortlist_rank:
                      rank,
                  }
                : entry
          )
      );
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to update rank.'
      );
    }
  }

  async function updateShortlistNote(
    item: ShortlistItem,
    note: string
  ) {
    try {
      await updateOutputDecisionMeta(
        item.id,
        {
          shortlist_note:
            note.trim() || null,
        }
      );

      setShortlistItems(
        (current) =>
          current.map(
            (entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    shortlist_note:
                      note.trim() || null,
                  }
                : entry
          )
      );
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to update note.'
      );
    }
  }

  async function toggleFinalist(
    item: ShortlistItem
  ) {
    const nextValue =
      !Boolean(item.finalist);

    try {
      await updateOutputDecisionMeta(
        item.id,
        {
          finalist: nextValue,
        }
      );

      setShortlistItems(
        (current) =>
          current.map(
            (entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    finalist:
                      nextValue,
                  }
                : entry
          )
      );
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to update finalist.'
      );
    }
  }

  async function removeShortlistItem(
    item: ShortlistItem
  ) {
    if (
      shortlistingId ||
      item.approved
    ) {
      return;
    }

    setShortlistingId(
      item.id
    );

    setErrorMsg('');

    try {
      await updateOutputShortlist(
        item.id,
        false
      );

      setShortlistItems(
        (current) =>
          current.filter(
            (entry) =>
              entry.id !==
              item.id
          )
      );

      if (
        item.generation_id ===
        generationId
      ) {
        setOutputs(
          (current) =>
            current.map(
              (output) =>
                output.id === item.id
                  ? {
                      ...output,
                      shortlisted:
                        false,
                    }
                  : output
            )
        );
      }
    } catch (error) {
      console.error(error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to remove shortlist item.'
      );
    } finally {
      setShortlistingId(
        null
      );
    }
  }

  function removeCompareItem(
    outputId: string
  ) {
    setCompareItems(
      (current) =>
        current.filter(
          (item) =>
            item.outputId !== outputId
        )
    );
  }

  function exitCompareMode() {
    setCompareItems([]);
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
    instruction?: string,
    forceOriginalProduct = false
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

    const selectedOutput =
      outputs.find(
        (output) =>
          output.id === selectedOutputId
      );

    const cameraReference =
      variationType === 'camera'
        ? cameraMaster
        : null;

    const referenceImageUrl =
      cameraReference?.imageUrl ||
      selectedOutput?.image_url;

    const useSelectedVisual =
      !forceOriginalProduct &&
      variationType !== 'scene' &&
      referenceMode === 'visual' &&
      Boolean(referenceImageUrl);

    const variationInstruction =
      instruction?.trim()
        ? [
            `Variation type: ${variationType}.`,
            useSelectedVisual
              ? 'Use the supplied AI visual as the scene reference. Preserve everything not explicitly requested to change.'
              : 'Use the original product as the reference and create a new architectural scene.',
            instruction.trim(),
          ].join('\n\n')
        : undefined;

    const result =
      await generateVisualVersion({
        projectId:
          project.id,

        productName:
          product.name,

        productImagePath:
          product.image_url,

        referenceMode:
          useSelectedVisual
            ? 'visual'
            : 'product',

        referenceImageUrl:
          useSelectedVisual
            ? referenceImageUrl
            : undefined,

        variationType:
          variationType,

        space:
          project.space,

        style:
          project.style,

        mood:
          project.mood,

        ratio:
          project.aspect_ratio,

        camera:
          variationType === 'camera'
            ? cameraPreset
            : undefined,

        customPrompt:
          variationInstruction,
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
      await createNewVersion(
        undefined,
        true
      );
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

    const typedInstruction =
      customPrompt.trim();

    const defaultInstruction =
      variationType === 'scene'
        ? 'Create a genuinely NEW premium architectural interior around the original product. The new result must visibly differ in architecture, room layout, furniture composition and spatial character from previous scenes, while preserving the exact product identity, geometry, finish, believable scale and realistic installation.'
        : variationType === 'lighting'
        ? 'Create a refined lighting variation of the same scene. Preserve the architecture, furniture, materials, product geometry, installation position and camera concept.'
        : variationType === 'camera'
        ? ''
        : 'Create a tasteful controlled creative variation while preserving the product identity, believable scale and core visual direction.';

    const instruction =
      typedInstruction ||
      defaultInstruction;

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
    'Dự án chưa đặt tên';

  const selectedVersionIndex =
    generations.findIndex(
      (generation) =>
        generation.id ===
        generationId
    );

  const busy =
    regenerating ||
    generatingMore;

  const selectedOutput =
    outputs.find(
      (output) =>
        output.id === selectedOutputId
    ) || null;

  const currentVersionIndex =
    generations.findIndex(
      (generation) =>
        generation.id === generationId
    );

  const currentVersionNumber =
    currentVersionIndex >= 0
      ? currentVersionIndex + 1
      : null;

  const cameraSetOutputs =
    outputs.filter(
      isCameraSetOutput
    );

  // V12.5C
  // Camera Set must always follow the production order:
  // 3/4 left -> 3/4 right -> hero close.
  // Do not depend on database row order.
  const orderedOutputs =
    cameraSetOutputs.length > 0
      ? [
          ...CAMERA_SET_ROLES.flatMap(
            (role) =>
              outputs.filter(
                (output) =>
                  output.role === role
              )
          ),
          ...outputs.filter(
            (output) =>
              !isCameraSetOutput(output)
          ),
        ]
      : outputs;

  const hasCompleteCameraSet =
    isCompleteCameraSet(outputs);

  return (
    <>
      <header className="sectionHead topmini">
        <div>
          <Link
            to="/projects"
            className="back"
          >
            <ArrowLeft size={16} />
            Dự án
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
              Đang tạo 4 phương án...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Tạo lại
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

      {compareMode && (
        <section
          className="panel"
          style={{
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div>
              <p className="eyebrow">
                CROSS-VERSION COMPARE
              </p>

              <h2>
                Compare visuals
              </h2>

              <div
                style={{
                  opacity: 0.65,
                  fontSize: 13,
                }}
              >
                Compare up to two visuals
                from different versions.
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={
                exitCompareMode
              }
              disabled={busy}
            >
              Đóng so sánh
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 18,
            }}
          >
            {compareItems.map(
              (item) => {
                const isCurrentVersion =
                  item.generationId ===
                  generationId;

                const liveOutput =
                  isCurrentVersion
                    ? outputs.find(
                        (output) =>
                          output.id ===
                          item.outputId
                      )
                    : null;

                const approved =
                  liveOutput
                    ? Boolean(
                        liveOutput.approved
                      )
                    : item.approved;

                return (
                  <article
                    className={`result ${
                      approved
                        ? 'approvedResult'
                        : ''
                    }`}
                    key={
                      item.outputId
                    }
                  >
                    <img
                      src={
                        item.imageUrl
                      }
                      alt={`Version ${
                        item.versionNumber
                      } · ${outputRoleLabel(
                        item.role,
                        item.visualNumber
                      )}`}
                    />

                    <div className="resultActions">
                      <b>
                        Version{' '}
                        {item.versionNumber}
                        {' · '}
                        {outputRoleLabel(
                          item.role,
                          item.visualNumber
                        )}
                      </b>

                      <button
                        type="button"
                        className={
                          selectedOutputId ===
                          item.outputId
                            ? 'btn primary'
                            : 'btn'
                        }
                        disabled={busy}
                        onClick={async () => {
                          if (
                            item.generationId !==
                            generationId
                          ) {
                            await selectVersion(
                              item.generationId
                            );
                          }

                          setSelectedOutputId(
                            item.outputId
                          );

                          setReferenceMode(
                            'visual'
                          );

                          setTimeout(() => {
                            document
                              .getElementById(
                                'results-studio'
                              )
                              ?.scrollIntoView({
                                behavior:
                                  'smooth',
                                block:
                                  'start',
                              });
                          }, 100);
                        }}
                      >
                        {selectedOutputId ===
                        item.outputId
                          ? 'Đã chọn làm mẫu'
                          : 'Dùng làm mẫu'}
                      </button>

                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          removeCompareItem(
                            item.outputId
                          )
                        }
                      >
                        Remove
                      </button>

                      {approved && (
                        <span>
                          ✓ Approved
                        </span>
                      )}
                    </div>
                  </article>
                );
              }
            )}

            {compareItems.length < 2 && (
              <div
                className="empty"
                style={{
                  minHeight: 240,
                }}
              >
                Switch version and select
                another visual to compare.
              </div>
            )}
          </div>
        </section>
      )}

      <section
        id="results-studio"
        className="panel"
        style={{
          marginBottom: 28,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <p className="eyebrow">
            XƯỞNG SÁNG TẠO
          </p>

          <h2 style={{ marginBottom: 6 }}>
            Tạo phương án biến thể
          </h2>

          <div
            style={{
              opacity: 0.65,
              fontSize: 13,
            }}
          >
            Refine a selected visual or start again
            from the original product.
          </div>
        </div>

        {referenceMode === 'visual' &&
          selectedOutput && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 20,
                padding: 12,
                border:
                  '1px solid var(--line, #d8d0c5)',
                borderRadius: 12,
              }}
            >
              <img
                src={
                  selectedOutput.image_url
                }
                alt="Selected reference"
                style={{
                  width: 92,
                  height: 92,
                  objectFit: 'cover',
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />

              <div>
                <b>
                  Phương án AI đang làm mẫu
                </b>

                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.65,
                    marginTop: 4,
                  }}
                >
                  The next variation will
                  start from this visual.
                </div>

                <button
                  type="button"
                  className="btn"
                  style={{
                    marginTop: 8,
                  }}
                  disabled={busy}
                  onClick={() =>
                    setReferenceMode(
                      'product'
                    )
                  }
                >
                  Dùng sản phẩm gốc thay thế
                </button>
              </div>
            </div>
          )}

        <div
          style={{
            display: 'grid',
            gap: 18,
          }}
        >
          <div>
            <b>Nguồn tham chiếu</b>

            <div
              className="chips"
              style={{ marginTop: 10 }}
            >
              <button
                type="button"
                className={
                  referenceMode === 'visual'
                    ? 'selected'
                    : ''
                }
                disabled={
                  busy || !selectedOutputId
                }
                onClick={() =>
                  setReferenceMode('visual')
                }
              >
                Ảnh AI đã chọn
              </button>

              <button
                type="button"
                className={
                  referenceMode === 'product'
                    ? 'selected'
                    : ''
                }
                disabled={busy}
                onClick={() =>
                  setReferenceMode('product')
                }
              >
                Sản phẩm gốc
              </button>
            </div>
          </div>

          <div>
            <b>Kiểu biến thể</b>

            <div
              className="chips"
              style={{ marginTop: 10 }}
            >
              {[
                ['scene', 'Không gian mới'],
                ['lighting', 'Ánh sáng'],
                ['camera', 'Góc máy'],
                ['creative', 'Sáng tạo'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    variationType === value
                      ? 'selected'
                      : ''
                  }
                  disabled={busy}
                  onClick={() =>
                    setVariationType(
                      value as
                        | 'scene'
                        | 'lighting'
                        | 'camera'
                        | 'creative'
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {variationType === 'camera' && (
            <div
              style={{
                display: 'grid',
                gap: 14,
              }}
            >
              <div>
                <b>Camera Master</b>

                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    border:
                      '1px solid var(--line, #d8d0c5)',
                    borderRadius: 10,
                  }}
                >
                  {cameraMaster ? (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <img
                          src={cameraMaster.imageUrl}
                          alt="Camera Master"
                          style={{
                            width: 92,
                            height: 92,
                            objectFit: 'cover',
                            borderRadius: 8,
                            flexShrink: 0,
                          }}
                        />

                        <div>
                          <b>
                            {cameraMaster.label}
                          </b>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              opacity: 0.65,
                            }}
                          >
                            Camera Master cố định.
                            Chuyển Version sẽ không thay đổi ảnh này.
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              opacity: 0.5,
                            }}
                          >
                            Master Generation: {cameraMaster.generationId}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        opacity: 0.65,
                      }}
                    >
                      Chưa có Camera Master.
                      Hãy chọn một ảnh chính diện,
                      sau đó đặt làm Camera Master.
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn"
                    style={{
                      marginTop: 10,
                    }}
                    disabled={
                      busy ||
                      !selectedOutput
                    }
                    onClick={() => {
                      if (
                        !selectedOutput ||
                        !generationId
                      ) {
                        return;
                      }

                      setCameraMaster({
                        generationId,

                        imageUrl:
                          selectedOutput.image_url,

                        label:
                          `Version ${
                            selectedVersionIndex >= 0
                              ? selectedVersionIndex + 1
                              : ''
                          } · Chính diện`,
                      });

                      setCameraPreset(
                        'front'
                      );

                      setReferenceMode(
                        'visual'
                      );
                    }}
                  >
                    Đặt ảnh đang chọn làm Camera Master
                  </button>
                </div>
              </div>

              <div>
                <b>Bộ góc máy</b>

                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    border:
                      '1px solid var(--line, #d8d0c5)',
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    Từ Camera Master chính diện,
                    hệ thống sẽ tạo cùng một không gian
                    ở 3 góc bổ sung:
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <span className="selected">
                      3/4 trái
                    </span>

                    <span className="selected">
                      3/4 phải
                    </span>

                    <span className="selected">
                      Cận cảnh đèn
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      opacity: 0.6,
                    }}
                  >
                    Cả 3 ảnh sẽ dùng trực tiếp
                    cùng một Camera Master.
                    Không tạo nối tiếp từ ảnh trước.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <b>Yêu cầu bổ sung <span style={{ opacity: 0.55, fontWeight: 400 }}>(không bắt buộc)</span></b>

            <textarea
              value={customPrompt}
              onChange={(event) =>
                setCustomPrompt(
                  event.target.value
                )
              }
              disabled={busy}
              placeholder="Có thể để trống. Hoặc mô tả thêm điều bạn muốn thay đổi..."
              rows={4}
              style={{
                width: '100%',
                resize: 'vertical',
                marginTop: 10,
              }}
            />
          </div>

          <div>
            <button
              type="button"
              className="btn primary"
              onClick={generateMore}
              disabled={
                busy ||
                (
                  referenceMode === 'visual' &&
                  !selectedOutputId
                ) ||
                (
                  variationType === 'camera' &&
                  (
                    referenceMode !== 'visual' ||
                    (
                      cameraPreset !== 'front' &&
                      !cameraMaster
                    ) ||
                    (
                      cameraPreset === 'front' &&
                      !selectedOutputId
                    )
                  )
                )
              }
            >
              {generatingMore ? (
                <>
                  <Loader2 size={16} />
                  {variationType === 'camera'
                    ? 'Đang tạo bộ góc máy...'
                    : 'Đang tạo biến thể...'}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {variationType === 'camera'
                    ? 'Tạo bộ góc máy'
                    : 'Tạo biến thể'}
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="empty">
          {errorMsg}
        </div>
      )}

      {loadingVersion ? (
        <div className="empty">
          Đang tải phiên bản...
        </div>
      ) : (
        <>
        {cameraSetOutputs.length > 0 && (
          <section
            className={`cameraSetPanel ${
              hasCompleteCameraSet
                ? 'complete'
                : ''
            }`}
          >
            <div className="cameraSetHeading">
              <div>
                <span className="cameraSetEyebrow">
                  CAMERA SET
                </span>

                <h2>
                  {currentVersionNumber
                    ? `Version ${currentVersionNumber}`
                    : 'Bộ góc máy'}
                </h2>

                <p>
                  {hasCompleteCameraSet
                    ? '3 ảnh · Cùng một không gian · Bộ góc máy hoàn chỉnh'
                    : `${cameraSetOutputs.length}/3 ảnh · Đang hoàn thiện bộ góc máy`}
                </p>
              </div>

              <span
                className={`cameraSetStatus ${
                  hasCompleteCameraSet
                    ? 'ready'
                    : ''
                }`}
              >
                {hasCompleteCameraSet
                  ? 'Hoàn chỉnh'
                  : `${cameraSetOutputs.length}/3`}
              </span>
            </div>

            <div className="cameraSetRoles">
              {CAMERA_SET_ROLES.map(
                (role) => {
                  const available =
                    cameraSetOutputs.some(
                      (output) =>
                        output.role === role
                    );

                  return (
                    <span
                      key={role}
                      className={
                        available
                          ? 'available'
                          : ''
                      }
                    >
                      {available
                        ? '✓ '
                        : '○ '}
                      {outputRoleLabel(role)}
                    </span>
                  );
                }
              )}
            </div>
          </section>
        )}

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
                  Sản phẩm gốc
                </span>
              </div>
            </article>
          )}

          {orderedOutputs.length > 0 ? (
            orderedOutputs.map(
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

                const isShortlisting =
                  shortlistingId ===
                  output.id;

                const isShortlisted =
                  Boolean(
                    output.shortlisted
                  );

                const isSelected =
                  selectedOutputId ===
                  output.id;

                const isCompared =
                  compareItems.some(
                    (item) =>
                      item.outputId ===
                      output.id
                  );

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
                      alt={outputRoleLabel(
                        output.role,
                        index + 1
                      )}
                    />

                    <div className="resultActions">
                      <span>
                        {outputRoleLabel(
                          output.role,
                          index + 1
                        )}
                      </span>

                      <button
                        type="button"
                        className={
                          isCompared
                            ? 'btn primary'
                            : 'btn'
                        }
                        onClick={() =>
                          toggleCompareOutput(
                            output,
                            index + 1
                          )
                        }
                        disabled={busy}
                      >
                        {isCompared
                          ? 'Đang so sánh'
                          : 'So sánh'}
                      </button>

                      <button
                        type="button"
                        className={
                          isSelected
                            ? 'btn primary'
                            : 'btn'
                        }
                        onClick={() => {
                          setSelectedOutputId(
                            output.id
                          );
                          setReferenceMode(
                            'visual'
                          );
                        }}
                        disabled={busy}
                      >
                        {isSelected
                          ? 'Đã chọn'
                          : 'Chọn'}
                      </button>

                      <button
                        type="button"
                        className={
                          isShortlisted
                            ? 'btn primary'
                            : 'btn'
                        }
                        onClick={() =>
                          toggleShortlist(
                            output
                          )
                        }
                        disabled={
                          Boolean(
                            shortlistingId
                          ) ||
                          busy ||
                          isApproved
                        }
                      >
                        {isShortlisting
                          ? 'Đang lưu...'
                          : isShortlisted
                          ? '★ Đã chọn'
                          : '☆ Thêm vào danh sách'}
                      </button>

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
                          'Duyệt'
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
        </>
      )}
    </>
  );
}
