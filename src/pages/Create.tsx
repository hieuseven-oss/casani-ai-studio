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

import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_QUALITY_OPTIONS,
  imageQualityLabel,
  type ImageQuality,
} from '../lib/imageQuality';

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

const lightingOptions = [
  'Warm Ambient',
  'Natural Daylight',
  'Golden Hour',
  'Dramatic',
  'Soft Editorial',
];

const compositionOptions = [
  'Product Hero',
  'Balanced Interior',
  'Wide Architecture',
  'Close Editorial',
];

const materialOptions = [
  'Auto',
  'Stone & Wood',
  'Marble & Brass',
  'Warm Minimal',
  'Dark Luxury',
];

const optionLabels: Record<string, string> = {
  // Space
  'Kitchen': 'Bếp',
  'Dining Room': 'Phòng ăn',
  'Living Room': 'Phòng khách',
  'Bedroom': 'Phòng ngủ',
  'Hotel': 'Khách sạn',
  'Villa': 'Biệt thự',

  // Style
  'Modern': 'Hiện đại',
  'Luxury': 'Sang trọng',
  'Minimal': 'Tối giản',
  'Contemporary': 'Đương đại',
  'Classic': 'Cổ điển',

  // Mood
  'Warm': 'Ấm áp',
  'Elegant': 'Thanh lịch',
  'Dramatic': 'Ấn tượng',
  'Natural': 'Tự nhiên',
  'Premium': 'Cao cấp',

  // Camera
  'Hero': 'Chủ đạo',
  'Wide Interior': 'Toàn cảnh',
  'Eye Level': 'Tầm mắt',
  'Low Angle': 'Góc thấp',
  'Architectural': 'Kiến trúc',

  // Lighting
  'Warm Ambient': 'Ánh sáng ấm',
  'Natural Daylight': 'Ánh sáng tự nhiên',
  'Golden Hour': 'Giờ vàng',
  'Soft Editorial': 'Ánh sáng dịu',

  // Composition
  'Product Hero': 'Tập trung sản phẩm',
  'Balanced Interior': 'Cân bằng không gian',
  'Wide Architecture': 'Toàn cảnh kiến trúc',
  'Close Editorial': 'Cận cảnh',

  // Materials
  'Auto': 'Tự động',
  'Stone & Wood': 'Đá & gỗ',
  'Marble & Brass': 'Đá marble & đồng',
  'Warm Minimal': 'Tối giản ấm',
  'Dark Luxury': 'Sang trọng tối',
};

function optionLabel(value: string) {
  return optionLabels[value] ?? value;
}

const presetLabels: Record<string, string> = {
  'Luxury Villa': 'Biệt thự sang trọng',
  'Double-height Living': 'Phòng khách thông tầng',
  'Modern Mansion': 'Dinh thự hiện đại',
  'Luxury Dining': 'Phòng ăn sang trọng',
  'Hotel Lobby': 'Sảnh khách sạn',
  'Neo Classic': 'Tân cổ điển',
};

function presetLabel(value: string) {
  return presetLabels[value] ?? value;
}

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

  const [lighting, setLighting] =
    useState('Warm Ambient');

  const [composition, setComposition] =
    useState('Product Hero');

  const [materials, setMaterials] =
    useState('Auto');

  const [presetPrompt, setPresetPrompt] =
    useState('');

  const [customDirection, setCustomDirection] =
    useState('');

  const [imageQuality, setImageQuality] =
    useState<ImageQuality>(
      DEFAULT_IMAGE_QUALITY
    );

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

        imageQuality,

        preset:
          presetPrompt || undefined,

        camera,
        lighting,
        composition,
        materials,

        customDirection:
          customDirection.trim() ||
          undefined,
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
          TẠO HÌNH MỚI
        </p>

        <h1>
          Tạo hình ảnh sản phẩm
        </h1>

        <p>
          Bắt đầu từ ảnh sản phẩm thực tế.
          Casani AI Studio sẽ xây dựng
          không gian hình ảnh xung quanh sản phẩm.
        </p>
      </header>

      <div className="createLayout">
        <section className="panel">
          <h2>
            1. Sản phẩm
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
                  Thả ảnh sản phẩm vào đây
                </b>

                <span>
                  JPG, PNG hoặc WEBP · ảnh chụp
                  bằng điện thoại đều được
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
              Tên sản phẩm

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
            2. Định hướng sáng tạo
          </h2>

          <Pick
            title="Không gian"
            items={spaces}
            value={space}
            set={setSpace}
            disabled={loading}
          />

          <Pick
            title="Phong cách"
            items={styles}
            value={style}
            set={setStyle}
            disabled={loading}
          />

          <Pick
            title="Cảm xúc"
            items={moods}
            value={mood}
            set={setMood}
            disabled={loading}
          />

          <Pick
            title="Tỷ lệ ảnh"
            items={ratios}
            value={ratio}
            set={setRatio}
            disabled={loading}
          />

          <Pick
            title="Góc máy"
            items={cameras}
            value={camera}
            set={setCamera}
            disabled={loading}
          />

          <Pick
            title="Ánh sáng"
            items={lightingOptions}
            value={lighting}
            set={setLighting}
            disabled={loading}
          />

          <Pick
            title="Bố cục"
            items={compositionOptions}
            value={composition}
            set={setComposition}
            disabled={loading}
          />

          <Pick
            title="Vật liệu"
            items={materialOptions}
            value={materials}
            set={setMaterials}
            disabled={loading}
          />

          <div className="pick">
            <b>Phương án gợi ý</b>

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
                  {presetLabel(preset.name)}
                </button>
              ))}
            </div>
          </div>

        </aside>

        <section className="panel createBrief">
          <div className="createBriefHead">
            <div>
              <span className="createStepEyebrow">
                3. YÊU CẦU SÁNG TẠO
              </span>

              <h2>
                Hoàn thiện yêu cầu
              </h2>
            </div>

            <p>
              Bổ sung yêu cầu riêng nếu cần,
              sau đó bắt đầu tạo bộ hình.
            </p>
          </div>

          <div className="createBriefGrid">
            <div className="createDirection">
              <label>
                Yêu cầu sáng tạo

                <textarea
                  value={customDirection}
                  onChange={(event) =>
                    setCustomDirection(
                      event.target.value
                    )
                  }
                  disabled={loading}
                  rows={3}
                  placeholder="Ví dụ: Phòng khách thông tầng sang trọng, cửa kính lớn, đá tự nhiên, ánh sáng hoàng hôn ấm. Giữ đèn là điểm nhấn chính."
                />
              </label>

              <small>
                Không bắt buộc — bổ sung kiến trúc,
                vật liệu, ánh sáng hoặc bố cục.
              </small>
            </div>

            <div className="createGenerate">
              <div className="createGenerateSummary">
                <b>Tóm tắt lựa chọn</b>

                <span>
                  {optionLabel(space)} · {optionLabel(style)} ·{' '}
                  {optionLabel(mood)} · {ratio}
                </span>
              </div>

              <div className="imageQualityPicker">
                <span className="imageQualityTitle">
                  Chất lượng ảnh
                </span>

                <div className="imageQualityOptions">
                  {IMAGE_QUALITY_OPTIONS.map(
                    (option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={loading}
                        className={
                          imageQuality === option.value
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setImageQuality(
                            option.value
                          )
                        }
                      >
                        <b>{option.label}</b>
                        <span>
                          {option.description}
                        </span>
                      </button>
                    )
                  )}
                </div>

                <small className="imageQualityHint">
                  Đang chọn: {imageQualityLabel(imageQuality)}
                </small>
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
                      'Đang tạo...'}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Tạo 4 phương án
                  </>
                )}
              </button>

              <small>
                Sản phẩm, dự án và hình ảnh AI
                được lưu trực tiếp vào hệ thống.
              </small>
            </div>
          </div>
        </section>
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
              {optionLabel(item)}
            </button>
          )
        )}
      </div>
    </div>
  );
}
