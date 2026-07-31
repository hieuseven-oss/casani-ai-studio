export type ImageQuality =
  | '1k'
  | '2k';

export type ImageDimensions = {
  width: number;
  height: number;
};

export type ImageQualityOption = {
  value: ImageQuality;
  label: string;
  description: string;
};

export const IMAGE_QUALITY_OPTIONS: ImageQualityOption[] = [
  {
    value: '1k',
    label: '1K Nhanh',
    description: 'Thử ý tưởng',
  },
  {
    value: '2k',
    label: '2K Tiêu chuẩn',
    description: 'Ảnh làm việc',
  },
];

export const DEFAULT_IMAGE_QUALITY: ImageQuality =
  '2k';

/*
 * Central resolution policy.
 *
 * IMPORTANT:
 * These are target dimensions for the Casani pipeline.
 * Provider support will be validated separately before
 * sending 2K / 4K dimensions directly to Together.
 *
 * 1K:
 *   fast previews / ideation
 *
 * 2K:
 *   normal production workflow
 *
 */
const QUALITY_LONG_EDGE: Record<
  ImageQuality,
  number
> = {
  '1k': 1024,
  '2k': 2048,
};

function normalizeRatio(
  ratio?: string | null
) {
  switch (ratio) {
    case '1:1':
    case '4:5':
    case '9:16':
    case '16:9':
      return ratio;

    default:
      return '1:1';
  }
}

export function getImageDimensions(
  quality: ImageQuality,
  ratio?: string | null
): ImageDimensions {
  const longEdge =
    QUALITY_LONG_EDGE[quality];

  const normalizedRatio =
    normalizeRatio(ratio);

  switch (normalizedRatio) {
    case '4:5':
      return {
        width: Math.round(
          longEdge * 4 / 5
        ),
        height: longEdge,
      };

    case '9:16':
      return {
        width: Math.round(
          longEdge * 9 / 16
        ),
        height: longEdge,
      };

    case '16:9':
      return {
        width: longEdge,
        height: Math.round(
          longEdge * 9 / 16
        ),
      };

    case '1:1':
    default:
      return {
        width: longEdge,
        height: longEdge,
      };
  }
}

export function imageQualityLabel(
  quality: ImageQuality
) {
  return (
    IMAGE_QUALITY_OPTIONS.find(
      (option) =>
        option.value === quality
    )?.label ?? quality
  );
}
