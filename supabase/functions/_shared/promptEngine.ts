export type LightingPromptInput = {
  name?: string;
  space?: string;
  style?: string;
  mood?: string;
  ratio?: string;

  preset?: string;
  camera?: string;
  lighting?: string;
  composition?: string;
  materials?: string;
  custom_direction?: string;

  // Backward compatibility for Results / older generations.
  custom_prompt?: string;
};

const SPACE_PROMPTS: Record<string, string> = {
  Kitchen:
    'a sophisticated high-end kitchen with premium cabinetry, stone surfaces and refined architectural detailing',
  'Dining Room':
    'an elegant luxury dining room with a carefully composed dining setting',
  'Living Room':
    'a spacious premium living room with sophisticated furniture, refined materials and architectural depth',
  Bedroom:
    'a luxurious bedroom with calm proportions, premium finishes and an intimate upscale atmosphere',
  Hotel:
    'a five-star luxury hotel interior with refined hospitality design and premium architectural materials',
  Villa:
    'an exclusive luxury villa interior with generous proportions, premium finishes and sophisticated architecture',
};

const STYLE_PROMPTS: Record<string, string> = {
  Modern:
    'modern architecture, clean geometry and refined contemporary materials',
  Luxury:
    'high-end luxury interior design, exceptional materials and sophisticated detailing',
  Minimal:
    'minimal architecture, restrained composition and clean surfaces',
  Contemporary:
    'contemporary luxury architecture with a sophisticated material palette',
  Classic:
    'refined classic architecture, elegant proportions and timeless luxury detailing',
};

const MOOD_PROMPTS: Record<string, string> = {
  Warm:
    'warm, inviting and sophisticated atmosphere',
  Elegant:
    'elegant restrained atmosphere with premium visual balance',
  Dramatic:
    'dramatic sophisticated atmosphere with controlled contrast',
  Natural:
    'natural, calm and believable atmosphere',
  Premium:
    'premium editorial atmosphere suitable for a luxury advertising campaign',
};

const LIGHTING_PROMPTS: Record<string, string> = {
  'Warm Ambient':
    'warm architectural ambient light, soft practical illumination and realistic warm highlights',
  'Natural Daylight':
    'soft natural daylight, believable window illumination and neutral material rendering',
  'Golden Hour':
    'late-afternoon golden-hour sunlight with warm directional illumination and refined long shadows',
  Dramatic:
    'controlled dramatic architectural illumination with deeper contrast while preserving product detail',
  'Soft Editorial':
    'soft diffused editorial lighting with controlled highlights and premium interior-photography quality',
};

const COMPOSITION_PROMPTS: Record<string, string> = {
  'Product Hero':
    'make the reference lighting fixture the unmistakable hero of the image',
  'Balanced Interior':
    'balance the reference fixture with enough surrounding architecture to communicate the complete interior',
  'Wide Architecture':
    'use a wider architectural composition showing spatial scale while keeping the reference fixture clearly identifiable',
  'Close Editorial':
    'use a tighter premium editorial composition emphasizing product detail, materials and craftsmanship',
};

const MATERIAL_PROMPTS: Record<string, string> = {
  Auto:
    'select premium interior materials naturally appropriate for the selected architecture',
  'Stone & Wood':
    'use sophisticated natural stone and premium timber as the dominant architectural material palette',
  'Marble & Brass':
    'use refined marble surfaces and restrained brass architectural accents',
  'Warm Minimal':
    'use warm neutral plaster, light natural stone and subtle timber with minimal material transitions',
  'Dark Luxury':
    'use dark natural stone, deep timber tones and sophisticated luxury finishes with controlled reflections',
};

export function buildLightingPrompt(
  input: LightingPromptInput
) {
  const product =
    input.name?.trim() ||
    'premium architectural lighting fixture';

  const space =
    SPACE_PROMPTS[input.space || ''] ||
    input.space ||
    'luxury interior';

  const style =
    STYLE_PROMPTS[input.style || ''] ||
    input.style ||
    'high-end luxury interior design';

  const mood =
    MOOD_PROMPTS[input.mood || ''] ||
    input.mood ||
    'premium architectural atmosphere';

  const lighting =
    LIGHTING_PROMPTS[input.lighting || ''] ||
    input.lighting ||
    'physically believable premium architectural illumination';

  const composition =
    COMPOSITION_PROMPTS[input.composition || ''] ||
    input.composition ||
    'make the reference lighting fixture the visual hero';

  const materials =
    MATERIAL_PROMPTS[input.materials || ''] ||
    input.materials ||
    MATERIAL_PROMPTS.Auto;

  const preset = input.preset?.trim();
  const camera = input.camera?.trim();
  const customDirection =
    input.custom_direction?.trim();
  const legacyCustom =
    input.custom_prompt?.trim();

  return `
Create a premium photorealistic architectural lighting advertising photograph.

REFERENCE PRODUCT
Use the supplied product image as the authoritative visual reference.

Product:
${product}

PRODUCT IDENTITY LOCK — HIGHEST PRIORITY
The reference lighting fixture must remain visually faithful to the supplied product image.

Preserve exactly:
- overall silhouette
- geometry and proportions
- number and arrangement of arms, bulbs and lighting elements
- crystal and glass count, placement, shape and transparency
- metal structure, finish and original color
- decorative components
- canopy and ceiling mount
- suspension cables, chains or rods
- recognizable construction details

Crystal and clear glass must remain optically transparent when transparent in the reference.
Do not tint clear crystal gold, amber, bronze or opaque.
Do not recolor the product to match the surrounding interior palette.

Do not redesign the fixture.
Do not replace it with another fixture.
Do not add or remove components.
Do not simplify its construction.
Do not alter its fundamental proportions.
Only create or change the architectural environment surrounding the product.

ARCHITECTURAL ENVIRONMENT
Space:
${space}

Interior style:
${style}

Atmosphere:
${mood}

${preset ? `SCENE PRESET:
${preset}` : ''}

MATERIAL DIRECTION
${materials}

PHOTOGRAPHY
Camera direction:
${camera || 'Hero architectural product photography'}

Camera direction controls viewpoint and framing only.
It must not change the physical design of the reference fixture.

COMPOSITION
${composition}

Maintain realistic perspective and believable scale.
Keep the scene sophisticated and uncluttered.

LIGHTING
${lighting}

The fixture must appear naturally installed and operational.
Use physically believable light behavior.
Preserve highlight detail in metal, crystal and glass.
Transparent crystal should show realistic refraction, internal reflections and background transmission.
Avoid blown highlights and opaque plastic-looking crystal.

OUTPUT
Target aspect ratio:
${input.ratio || '4:5'}

IMAGE QUALITY
Photorealistic.
High-end architectural interior photography.
Premium advertising quality.
Realistic materials and reflections.
Natural shadows.
Fine product detail.
No artificial CGI appearance.

${customDirection ? `USER CREATIVE DIRECTION
${customDirection}` : ''}

${legacyCustom ? `ADDITIONAL CREATIVE DIRECTION
${legacyCustom}` : ''}

No text.
No logos.
No watermark.
Do not add unrelated lighting fixtures that compete with the reference product.
`.trim();
}
