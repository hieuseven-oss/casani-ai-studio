export type LightingPromptInput = {
  name?: string;
  space?: string;
  style?: string;
  mood?: string;
  ratio?: string;
  custom_prompt?: string;
};

const SPACE_PROMPTS: Record<string, string> = {
  Kitchen:
    'a sophisticated high-end kitchen with premium cabinetry, stone surfaces and refined architectural detailing',
  'Dining Room':
    'an elegant luxury dining room with a carefully composed dining setting and strong visual focus on the lighting fixture',
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
    'modern architecture, clean geometry, refined contemporary materials',
  Luxury:
    'high-end luxury interior design, exceptional materials, sophisticated detailing',
  Minimal:
    'minimal architecture, restrained composition, clean surfaces and carefully controlled details',
  Contemporary:
    'contemporary luxury architecture, current premium interior design, sophisticated material palette',
  Classic:
    'refined classic architecture, elegant proportions, timeless luxury detailing',
};

const MOOD_PROMPTS: Record<string, string> = {
  Warm:
    'warm ambient illumination, inviting atmosphere, realistic warm light',
  Elegant:
    'elegant restrained atmosphere, sophisticated lighting and premium visual balance',
  Dramatic:
    'dramatic architectural lighting, controlled contrast and cinematic depth',
  Natural:
    'natural daylight combined with realistic architectural illumination',
  Premium:
    'premium editorial atmosphere, polished architectural photography and sophisticated lighting',
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
    'warm premium architectural lighting';

  const custom =
    input.custom_prompt?.trim();

  return `
Create a premium photorealistic architectural lighting advertising photograph.

REFERENCE PRODUCT
Use the supplied product image as the authoritative visual reference.

Product:
${product}

PRODUCT IDENTITY LOCK — HIGHEST PRIORITY
The lighting fixture itself must remain visually faithful to the supplied reference image.

Preserve:
- overall silhouette
- original proportions and scale relationships
- number and arrangement of lighting elements
- metal structure and finish
- material colors
- crystal or glass configuration
- decorative components
- canopy and ceiling mount
- suspension cables, chains or rods
- recognizable construction details

Do not redesign the fixture.
Do not replace it with another fixture.
Do not add or remove arms, bulbs, crystals, decorative pieces or structural components.
Do not simplify its construction.
Do not alter its material identity.
Do not change its fundamental proportions.

Only create or change the architectural environment surrounding the product.

ARCHITECTURAL ENVIRONMENT
Space:
${space}

Interior style:
${style}

Atmosphere:
${mood}

Create a believable professionally designed interior appropriate for this fixture.

LIGHTING
The fixture must appear naturally installed and operational.
Produce physically believable illumination from the fixture.
Use realistic indirect architectural lighting and natural light where appropriate.
Preserve highlight detail in metal, crystal and glass.
Avoid blown highlights.

COMPOSITION
Make the product the visual hero.
Use premium architectural photography composition.
Maintain realistic perspective and believable scale.
Keep the scene sophisticated and uncluttered.
Show enough architecture to communicate the quality of the space without distracting from the fixture.

IMAGE QUALITY
Photorealistic.
High-end interior photography.
Realistic materials.
Accurate reflections.
Natural shadows.
Fine product detail.
Premium advertising quality.
No artificial CGI appearance.

${custom ? `CREATIVE DIRECTION\n${custom}` : ''}

Do not add text.
Do not add logos.
Do not add watermarks.
Do not add unrelated lighting fixtures that compete with the reference product.
`.trim();
}
