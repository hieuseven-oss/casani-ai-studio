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

  reference_mode?: 'product' | 'visual';
  variation_type?: 'scene' | 'lighting' | 'camera' | 'creative';

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

  const referenceMode =
    input.reference_mode || 'product';

  const variationType =
    input.variation_type || 'creative';

  const cameraPreset = input.camera?.trim();
  let cameraInstruction = cameraPreset || '';

  if (variationType === 'camera') {
    const movementRule = `CAMERA MOVEMENT IS REQUIRED.
Scene consistency must NEVER mean camera immobility.
SCENE LOCK defines WHAT EXISTS AND WHERE IT EXISTS.
CAMERA DIRECTIVE defines WHERE THE PHOTOGRAPHER STANDS.

For left/right three-quarter views, do not satisfy the request with:
- crop only
- zoom only
- tiny yaw adjustment
- lens change only
- moving furniture
- moving fixture
- mirroring/flipping the scene

The physical camera must relocate through the frozen scene.`;

    const parallaxRule = `PARALLAX EVIDENCE REQUIRED.
The new viewpoint should cause:
- foreground furniture to shift relative to background
- railing perspective/convergence to change
- different proportions of wall planes to become visible
- natural architectural depth changes
- fixture to remain attached to exactly the same ceiling location

If the output could have been created simply by cropping the reference image, camera variation has failed.`;

    let presetText = '';

    switch (cameraPreset) {
      case 'front':
        presetText = 'FRONT HERO VIEW. Camera centered on the primary fixture axis. Show the complete fixture and enough architecture to establish the room.';
        break;
      case 'left_three_quarter':
        presetText = 'LEFT THREE-QUARTER CAMERA ORBIT. Physically move camera approximately 30–45 degrees LEFT from the front/reference viewing axis. This must create a clearly different perspective. Look toward the SAME fixture in the SAME frozen room. Do not mirror the room.';
        break;
      case 'right_three_quarter':
        presetText = 'RIGHT THREE-QUARTER CAMERA ORBIT. Physically move camera approximately 30–45 degrees RIGHT from the front/reference viewing axis. This must create a clearly different perspective. Look toward the SAME fixture in the SAME frozen room. Do not mirror the room.';
        break;
      case 'hero_close':
        presetText = 'PRODUCT HERO CLOSE VIEW. Physically move camera closer to the fixture. Do NOT enlarge the physical fixture. Show the COMPLETE fixture from canopy to lowest decorative element. Keep enough recognizable architecture in the background to prove this is the same room.';
        break;
      default:
        presetText = cameraPreset || '';
    }

    cameraInstruction = [presetText, movementRule, (cameraPreset === 'left_three_quarter' || cameraPreset === 'right_three_quarter') ? parallaxRule : '']
      .filter(Boolean)
      .join('\n\n');
  }

  const visualReferenceRules =
    referenceMode === 'visual'
      ? `
DUAL REFERENCE SYSTEM — CRITICAL

IMAGE 1 = ORIGINAL PRODUCT MASTER
Image 1 is the authoritative manufactured product reference.

Use Image 1 to preserve:
- exact product silhouette
- exact decorative element shapes
- leaf, crystal, glass or petal geometry
- canopy design
- suspension structure
- product colors and finishes
- component proportions and construction identity

IMAGE 2 = SCENE MASTER
Image 2 is the authoritative architectural scene reference.

Use Image 2 to preserve:
- room architecture
- product installation position
- product scale within the room
- furniture
- materials
- lighting
- spatial proportions
- visual direction

When Image 1 and Image 2 differ in PRODUCT DETAIL,
IMAGE 1 wins.

When Image 1 and Image 2 differ in ROOM OR INSTALLATION CONTEXT,
IMAGE 2 wins.

Do not copy the background of Image 1 into the scene.
Do not redesign the product based on Image 2.

REFERENCE SCENE LOCK — CRITICAL
Treat Image 2 as an existing approved visual direction, not merely inspiration.

Treat it as the authoritative scene reference.

SCENE TOPOLOGY LOCK — HIGHEST PRIORITY
Treat the scene reference as one real, completed interior with one immutable floor plan.

Every major architectural landmark has a fixed physical position in the room.

LOCK:
- window walls and their orientation
- full-height glazing
- curtains and window bays
- doors and glass doors
- corridors and circulation openings
- solid walls
- TV feature wall
- built-in shelving
- mezzanine edges
- balcony and railing
- stairs if visible
- structural columns
- ceiling geometry
- fixture mounting point
- sofa position
- coffee table position
- rug position
- major furniture orientation
- large decorative objects

A window must remain a window.
A corridor must remain a corridor.
A wall opening must remain the same opening.
The TV wall must remain the same physical wall.
The mezzanine must remain attached to the same side of the room.

DO NOT:
- mirror the room
- horizontally flip the room
- move the window wall to another side
- replace a window with a doorway
- replace a corridor with glazing
- relocate the TV wall
- relocate the mezzanine
- rearrange furniture for a prettier composition
- invent a new opening
- remove an existing architectural landmark

IMPORTANT CAMERA LOGIC
An object may move from the left side of the IMAGE to the right side of the IMAGE because the photographer walks around the room.

That does NOT mean the object moved inside the ROOM.

Always derive new viewpoints from the same fixed spatial layout.

Think like a photographer documenting one finished interior,
not an interior designer rebuilding the room for each image.

Preserve unless the requested variation explicitly requires a change:
- exact lighting fixture identity and proportions
- architectural design and room geometry
- ceiling height and major spatial proportions
- furniture identity, placement and scale
- material palette and surface colors
- decorative objects and styling
- overall art direction
- product installation position
- believable product-to-room scale

Do not redesign the room.
Do not substitute furniture.
Do not randomly add architectural elements.
Do not change product size relative to the room.
Do not create a different interior unless scene variation is explicitly requested.
`
      : `
ORIGINAL PRODUCT MODE
The supplied image is the authoritative product reference.

Create a new architectural environment around the product while preserving the product identity exactly.
The environment must be designed at a believable real-world scale for this fixture.
`;

  const variationRules =
    referenceMode !== 'visual'
      ? ''
      : variationType === 'camera'
      ? `
CAMERA VARIATION — FIXED SCENE / MOVING CAMERA ONLY
Treat the reference image as one view of a fixed real-world 3D scene.

Imagine the room, furniture and installed fixture are physically frozen in place.
Only the photographer moves the camera.

ABSOLUTELY PRESERVE:
- exact room architecture and geometry
- ceiling and mezzanine geometry
- doors, windows and wall openings
- furniture identity, dimensions and placement
- architectural materials and colors
- fixture ceiling attachment point
- fixture overall dimensions
- fixture hanging height
- fixture lowest point above the occupied zone
- fixture orientation in the room
- lighting conditions and time of day

The fixture must NOT become larger because the camera moves closer.
The fixture must NOT become longer because the camera angle changes.
The room must NOT be redesigned to fit the fixture.

Change only:
- camera position
- camera height
- camera yaw/pitch
- framing
- natural lens perspective

CAMERA POSITION MUST OBEY THE FIXED FLOOR PLAN.

Treat camera variation as a camera orbit through one frozen 3D scene.

For front, left three-quarter, right three-quarter and close hero views:
- keep the same world coordinate system
- keep architectural landmarks on their true physical sides
- preserve distances between furniture and walls
- preserve distances between fixture and architecture
- preserve the fixture mounting coordinate
- preserve ceiling height
- preserve mezzanine height
- preserve window orientation

Never mirror or flip the scene to simulate another camera angle.

A right three-quarter view means the CAMERA moves to the right side of the same room.
A left three-quarter view means the CAMERA moves to the left side of the same room.

Do not regenerate an alternate version of the room.

FULL FIXTURE FRAMING — REQUIRED
For normal architectural and camera-variation views, show the COMPLETE fixture.

The frame must include:
- the complete ceiling canopy / mounting plate
- all suspension wires or rods needed to understand installation
- the full sculptural body
- the lowest decorative element

Leave visible breathing room around the fixture.
Do not crop the canopy.
Do not crop the lowest portion.
Do not let the fixture continue outside the top, bottom, left or right edge of the image.

Only an explicitly requested product-detail or macro close-up may crop part of the fixture.

When a closer product view is requested, move the CAMERA closer while choosing a framing that still shows the complete fixture whenever possible.
DO NOT enlarge, stretch or lower the fixture.

Keep enough recognizable architecture in the background to prove this is the same real interior.

The result must look like another photograph from the same professional interior photo shoot.

CROSS-VIEW VISUAL CONTINUITY
Across camera angles, preserve the same:
- daylight direction
- time of day
- artificial lighting state
- color temperature
- exposure character
- wood tone
- stone color and veining character
- metal finishes
- sofa upholstery color
- curtain color
- rug color
- decorative styling

Camera variation must not create a different color grade or different design scheme.

The complete set should feel like photographs captured within minutes of each other by one photographer in one real interior.
`
      : variationType === 'lighting'
      ? `
LIGHTING VARIATION — CHANGE LIGHTING ONLY
Keep the SAME room, SAME camera concept, SAME furniture, SAME materials and SAME fixture.

Change only the requested illumination characteristics.

Light must behave physically:
- realistic falloff
- believable shadows
- indirect bounce light
- correct reflections
- controlled highlights
- realistic interaction with glass, crystal, metal, stone, timber and fabric

Do not redesign the interior.
`
      : variationType === 'scene'
      ? `
SCENE VARIATION
A new architectural environment may be created.

The lighting fixture itself remains locked to the reference identity.

Preserve its geometry, proportions, construction, finish and color.
Place it naturally into a newly designed but believable premium interior.
`
      : `
CONTROLLED CREATIVE VARIATION
Stay strongly related to the supplied visual.

Preserve product identity, believable scale and the core visual DNA.
Make only intentional changes requested by the creative direction.
Avoid unnecessary redesign.
`;

  return `
Create a premium photorealistic architectural lighting advertising photograph.

${visualReferenceRules}

${variationRules}

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

PRODUCT GEOMETRY LOCK — CRITICAL
Treat every visible decorative element as manufactured product geometry, not artistic decoration.

For leaf, crystal, glass, petal, branch, ring, arm or sculptural fixtures, preserve:
- individual element shape
- element aspect ratio
- curvature and contour
- relative size of large and small elements
- density and spacing
- sequence and distribution
- orientation pattern
- cluster structure
- overall sculptural flow
- relationship between decorative elements and suspension wires

A leaf must remain the same leaf design from every camera angle.
Do not transform leaves into crystals, droplets, petals, feathers or abstract shapes.
Do not invent additional leaf shapes.
Do not simplify detailed leaves into generic ornaments.
Do not make decorative pieces longer, wider or more pointed in close views.

Occlusion and perspective may naturally hide parts of the product,
but visible components must remain consistent with the same physical manufactured fixture.

Only create or change the architectural environment surrounding the product when the selected variation mode allows it.

INSTALLATION ENVELOPE — CRITICAL
The fixture is a real architectural product installed in a usable occupied interior.

First infer a believable installation envelope from:
- fixture type
- room type
- ceiling height
- furniture
- circulation zones
- mezzanine or double-height architecture

Then keep the complete fixture inside that believable envelope.

For large suspended or double-height fixtures:
- provide sufficient architectural height for the fixture
- preserve generous visual clearance around the sculpture
- keep the lowest decorative element safely above normal occupied furniture and circulation zones
- never let the fixture nearly touch the floor
- never let decorative elements collide with sofas, tables, balustrades or people zones
- never stretch the fixture vertically merely to fill the image
- never enlarge the fixture merely to make it more prominent

If the fixture needs greater visual prominence:
MOVE THE CAMERA CLOSER.
DO NOT SCALE THE PRODUCT UP.

The architecture must accommodate the fixture realistically,
rather than forcing the fixture to occupy the entire room height.

ARCHITECTURAL SCALE ANCHORS
Use fixed real-world objects as scale references.

Preserve believable relationships between:
- fixture and sofa
- fixture and coffee table
- fixture and floor
- fixture and mezzanine
- fixture and ceiling
- fixture and windows
- fixture and door openings

If the product needs to appear more important,
change camera distance, framing or depth of field.

Never solve composition by increasing the physical size of the fixture.

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
${cameraInstruction || camera || 'Hero architectural product photography'}

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

PHOTOREALISM AND PHYSICAL REALISM — HIGH PRIORITY
The final image must look like a real professional architectural photograph, not an AI render.

Require:
- physically plausible architecture
- realistic room dimensions
- believable ceiling height
- correct furniture scale
- correct fixture scale relative to furniture and architecture
- natural perspective
- coherent vanishing points
- realistic lens behavior
- physically believable illumination
- natural shadow softness and direction
- realistic indirect light and bounce
- accurate reflections
- believable material roughness
- realistic glass and crystal transmission
- controlled metal highlights
- natural tonal range
- realistic photographic exposure

SPATIAL BALANCE
The fixture must be correctly sized for the room.

For dining scenes:
- center the fixture logically with the dining composition
- maintain believable distance above the table
- avoid oversized or undersized fixture scale

For living rooms and large interiors:
- respect ceiling height
- preserve architectural breathing space
- avoid floating or implausibly positioned fixtures

The fixture must feel intentionally specified by a professional lighting designer.

PRODUCT HERO COMPOSITION WITHOUT SCALE DISTORTION
The lighting fixture is the visual hero because of composition, focus, camera placement and lighting — not because it is unrealistically oversized.

For hero views:
- allow the fixture to occupy a strong portion of the frame
- preserve enough room context to communicate true scale
- include useful architectural scale references such as sofa, table, wall, mezzanine, doorway or window
- use foreground and background depth naturally
- keep vertical architecture believable
- avoid extreme wide-angle distortion
- avoid making the room look miniature around the fixture

For closer editorial views:
- move the camera physically closer
- frame selected product details naturally
- allow background depth and mild photographic separation
- retain enough environmental context to understand installation
- preserve exact product geometry

COLOR FIDELITY
Preserve the reference product's actual material colors.

Do not allow environmental lighting to permanently recolor:
- brass
- bronze
- chrome
- black metal
- clear glass
- crystal

Warm light may create physically plausible warm reflections, but the underlying material identity must remain recognizable.

IMAGE QUALITY
Photorealistic.
High-end architectural interior photography.
Premium advertising quality.
Realistic materials and reflections.
Natural shadows.
Fine product detail.
Natural photographic depth.
No artificial CGI appearance.
No obvious AI artifacts.
No warped architecture.
No distorted furniture.
No duplicated objects.

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
