import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

import {
  createProductWithImage,
} from '../lib/productService';

import {
  createProject,
} from '../lib/projectService';

import {
  generateVisualVersion,
} from '../lib/generationWorkflow';

import {
  creativePresets,
} from '../lib/creativePresets';

const spaces = [
  'Kitchen',
  'Dining Room',
  'Living Room',
  'Bedroom',
  'Hotel',
  'Villa',
];

const styles = [
  'Modern',
  'Luxury',
  'Minimal',
  'Contemporary',
  'Classic',
];

const moods = [
  'Warm',
  'Elegant',
  'Dramatic',
  'Natural',
  'Premium',
];

const ratios = [
  '1:1',
  '4:5',
  '9:16',
  '16:9',
];

const cameras = [
  'Hero',
  'Wide Interior',
  'Eye Level',
  'Low Angle',
  'Architectural',
];

export default function Create() {
  const nav = useNavigate();

  const [img, setImg] =
    useState('');

  const [file, setFile] =
    useState<File | null>(null);

  const [sku, setSku] =
    useState('');

  const [name, setName] =
    useState('');

  const [space, setSpace] =
    useState('Kitchen');

  const [style, setStyle] =
    useState('Luxury');

  const [mood, setMood] =
    useState('Warm');

  const [ratio, setRatio] =
    useState('4:5');

  const [camera, setCamera] =
    useState('Hero');

  const [presetPrompt, setPresetPrompt] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [statusText, setStatusText] =
    useState('');

  function upload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      e.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);

    const reader =
      new FileReader();

    reader.onload = () => {
      setImg(
        String(reader.result)
      );
    };

    reader.readAsDataURL(
      selectedFile
    );
  }

  async function generate() {
    if (
      !file ||
      !img ||
      !name.trim()
    ) {
      alert(
        'Hãy tải ảnh và nhập tên sản phẩm.'
      );

      return;
    }

    setLoading(true);
    setStatusText(
      'Saving product...'
    );

    let projectId:
      | string
      | null = null;

    try {
      // 1. Upload product image
      // and create product record.
      const {
        product,
        storagePath,
      } =
        await createProductWithImage({
          sku,
          name,
          file,
        });

      setStatusText(
        'Creating project...'
      );

      // 2. Create project in Supabase.
      const project =
        await createProject({
          productId:
            product.id,
          space,
          style,
          mood,
          ratio,
        });

      projectId =
        project.id;

      setStatusText(
        'Generating 4 AI visuals...'
      );

      // 3. Single AI workflow.
      // generationWorkflow handles:
      // project lifecycle
      // generation status
      // fresh signed URL
      // Edge Function
      // FLUX.2 Pro
      // generation_outputs
      await generateVisualVersion({
        projectId:
          project.id,

        productName:
          name.trim(),

        productImagePath:
          storagePath,

        space,
        style,
        mood,
        ratio,

        customPrompt:
          [
            presetPrompt,
            `Camera direction: ${camera}`,
          ]
            .filter(Boolean)
            .join('\n'),
      });

      setStatusText(
        'Opening results...'
      );

      // 4. Go directly to real Results page.
      nav(
        '/results/' +
          project.id
      );
    } catch (error) {
      console.error(
        'Create workflow failed:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Không thể tạo campaign.';

      alert(message);

      // If product/project were created but
      // generation failed, keep the project.
      // Results/Projects can show failed state.
      if (projectId) {
        console.info(
          'Project preserved after failed generation:',
          projectId
        );
      }
    } finally {
      setLoading(false);
      setStatusText('');
    }
  }

  return (
    <>
      <header className="pageTitle">
        <p className="eyebrow">
          NEW CAMPAIGN
        </p>

        <h1>
          Create a new visual
        </h1>

        <p>
          Start with the real product
          image. Casani AI Studio builds
          the surrounding advertising
          scene.
        </p>
      </header>

      <div className="createLayout">
        <section className="panel">
          <h2>
            1. Product
          </h2>

          <label
            className={
              'drop ' +
              (img
                ? 'hasImage'
                : '')
            }
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={upload}
              disabled={loading}
            />

            {img ? (
              <img
                src={img}
                alt="Product preview"
              />
            ) : (
              <>
                <Upload size={30} />

                <b>
                  Drop product photo here
                </b>

                <span>
                  JPG, PNG or WEBP · phone
                  photo is fine
                </span>
              </>
            )}
          </label>

          <div className="two">
            <label>
              SKU

              <input
                value={sku}
                onChange={(e) =>
                  setSku(
                    e.target.value
                  )
                }
                placeholder="CL-2088"
                disabled={loading}
              />
            </label>

            <label>
              Product name

              <input
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                placeholder="Luna Pendant Light"
                disabled={loading}
              />
            </label>
          </div>
        </section>

        <aside className="config panel">
          <h2>
            2. Creative direction
          </h2>

          <Pick
            title="Space"
            items={spaces}
            value={space}
            set={setSpace}
            disabled={loading}
          />

          <Pick
            title="Style"
            items={styles}
            value={style}
            set={setStyle}
            disabled={loading}
          />

          <Pick
            title="Mood"
            items={moods}
            value={mood}
            set={setMood}
            disabled={loading}
          />

          <Pick
            title="Format"
            items={ratios}
            value={ratio}
            set={setRatio}
            disabled={loading}
          />

          <Pick
            title="Camera"
            items={cameras}
            value={camera}
            set={setCamera}
            disabled={loading}
          />

          <div className="pick">
            <b>Creative preset</b>

            <div className="chips">
              {creativePresets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  disabled={loading}
                  className={
                    presetPrompt === preset.prompt
                      ? 'selected'
                      : ''
                  }
                  onClick={() => {
                    setSpace(preset.space);
                    setStyle(preset.style);
                    setMood(preset.mood);
                    setPresetPrompt(preset.prompt);
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn primary wide"
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <>
                <ImageIcon size={18} />
                {statusText ||
                  'Generating...'}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate 4 visuals
              </>
            )}
          </button>

          <small>
            Product, project, generation
            and AI outputs are stored
            directly in Supabase.
          </small>
        </aside>
      </div>
    </>
  );
}

function Pick({
  title,
  items,
  value,
  set,
  disabled,
}: {
  title: string;
  items: string[];
  value: string;
  set: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pick">
      <b>{title}</b>

      <div className="chips">
        {items.map(
          (item) => (
            <button
              className={
                value === item
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                set(item)
              }
              key={item}
              type="button"
              disabled={disabled}
            >
              {item}
            </button>
          )
        )}
      </div>
    </div>
  );
}
