// Art-style library for the Nano Banana generation engine.
//
// Each style is reverse-engineered from curated reference images (see
// docs/art-style-references.md) and encoded as a detailed prompt template so
// every generation lands "on-model": same materials, same lighting, same
// framing, same background discipline. Nano Banana Pro responds strongly to
// concrete physical descriptors (materials + lighting + camera), so templates
// spell those out rather than naming the style vaguely.
//
// cutoutFriendly styles force a plain uniform background so the downstream
// background-removal step produces a clean transparent asset.

export interface ArtStyle {
  id: string;
  label: string;
  group: "Assets & Icons" | "Characters" | "Free";
  tagline: string; // one-liner shown in the picker
  cutoutFriendly: boolean;
  /** A subject that shows the style off well — used by "sample" generations. */
  sampleSubject: string;
  /**
   * Curated reference images (served from public/) attached to the generation
   * request so the model style-matches real examples instead of relying on the
   * text template alone. Paths are absolute URLs within the dev server.
   */
  referenceImagePaths?: string[];
  buildPrompt: (subject: string) => string;
}

const NO_JUNK =
  "No text, no letters, no watermark, no signature, no logo, no border, no frame.";

export const ART_STYLES: ArtStyle[] = [
  {
    id: "voxel-3d",
    label: "3D Voxel — toy blocks",
    group: "Assets & Icons",
    tagline: "Minecraft-toy cubes, glossy plastic, bold colors",
    cutoutFriendly: true,
    sampleSubject: "a potted cactus",
    referenceImagePaths: ["/style-refs/voxel-cactus.png", "/style-refs/voxel-icon-set.png"],
    buildPrompt: (subject) =>
      [
        "Match the exact art style of the attached reference images.",
        `${subject}, built entirely from small uniform 3D cubic voxel blocks, like a premium plastic building-block toy.`,
        "Each cube has softly beveled edges and a glossy injection-molded plastic finish with subtle specular highlights.",
        "Bold, saturated, cheerful colors with clean per-block color separation (no gradients inside a single block).",
        "Rendered in 3D with a slight 3/4 rotation so the cube depth reads clearly; soft studio lighting from the upper left; a faint soft contact shadow directly below the object only.",
        "The object floats perfectly centered on a plain solid very-light-gray (#F2F2F2) background with generous margins on all sides and never touches the edges.",
        `Crisp, high-resolution product-render quality. ${NO_JUNK}`,
      ].join(" "),
  },
  {
    id: "soft-3d",
    label: "Soft 3D Character — clay & fleece",
    group: "Characters",
    tagline: "Pixar-soft, matte fuzzy textures, pastel calm",
    cutoutFriendly: true,
    sampleSubject: "a curious young boy in a pale green hoodie shrugging",
    referenceImagePaths: ["/style-refs/soft-3d-boy.png"],
    buildPrompt: (subject) =>
      [
        "Match the exact art style of the attached reference image.",
        `${subject}, as a soft friendly 3D animated character in a modern animation-film style.`,
        "Matte clay-like skin with soft subsurface scattering; clothing made of fuzzy micro-fleece fabric with visible fine fiber texture; softly tousled stylized hair with chunky sculpted locks.",
        "Rounded gentle proportions, slightly oversized head, large glossy expressive eyes, small subtle mouth; warm innocent screen-friendly appeal.",
        "Soft diffuse even studio lighting, gentle ambient occlusion in the creases, no harsh shadows.",
        "Muted pastel palette; character framed waist-up, perfectly centered on a plain solid pastel background with nothing else in the scene.",
        `High-end 3D render, smooth and clean. ${NO_JUNK}`,
      ].join(" "),
  },
  {
    id: "toy-3d",
    label: "Designer Toy — glossy vinyl",
    group: "Characters",
    tagline: "Collectible vinyl, streetwear attitude, vivid pop",
    cutoutFriendly: true,
    sampleSubject:
      "a cool girl with white hair wearing a lime-green knitted beanie covered in rubber patches and chrome glasses",
    referenceImagePaths: [
      "/style-refs/designer-toy-cap.png",
      "/style-refs/designer-toy-beanie.png",
      "/style-refs/toy-3d-girl.png",
    ],
    buildPrompt: (subject) =>
      [
        "Match the exact art style of the attached reference image.",
        `${subject}, as a trendy collectible designer vinyl toy character, bust portrait framing.`,
        "Smooth glossy vinyl skin with delicate freckles and subtle subsurface glow; hyper-detailed accessories: chunky knitted textures with visible yarn loops, rubberized patches, polished chrome metal details with crisp reflections.",
        "Stylized fashion-forward proportions: large head, striking eyes with sharp catchlights, deadpan confident expression, streetwear energy.",
        "Dramatic soft key light with a gentle rim light separating the character from the background.",
        "One or two vivid saturated accent colors against a single bold solid background color (like hot pink or electric blue) — background perfectly uniform, nothing else in frame.",
        `Ultra-clean high-detail 3D render, collectible-product quality. ${NO_JUNK}`,
      ].join(" "),
  },
  {
    id: "anime-2d",
    label: "2D Anime — bold cel",
    group: "Characters",
    tagline: "Clean cel shading, thick lines, meme-grade expression",
    cutoutFriendly: true,
    sampleSubject: "a grumpy chubby yellow duck with half-lidded unimpressed eyes",
    referenceImagePaths: ["/style-refs/anime-2d-duck.png"],
    buildPrompt: (subject) =>
      [
        "Match the exact art style of the attached reference image.",
        `${subject}, as a 2D anime illustration with bold cartoon energy.`,
        "Clean confident dark outlines with varying line weight; flat cel shading with at most two tone steps per color; absolutely no 3D rendering, no gradients heavier than a soft blush.",
        "Exaggerated, instantly-readable facial expression; close-up composition cropping in tight on the character for maximum comedic or emotional impact.",
        "Simple flat solid muted background color (terracotta, dusty pink, or warm cream) with a subtle hand-drawn feel — nothing else in the scene.",
        `High-resolution key-visual quality, crisp edges. ${NO_JUNK}`,
      ].join(" "),
  },
  {
    id: "product-3d",
    label: "Product 3D — soft render",
    group: "Assets & Icons",
    tagline: "Matte designer objects, isometric, clean studio light",
    cutoutFriendly: true,
    sampleSubject: "a retro handheld gaming console",
    referenceImagePaths: [
      "/style-refs/product-3d-espresso.png",
      "/style-refs/product-3d-console.png",
      "/style-refs/product-3d-vinyl.png",
    ],
    buildPrompt: (subject) =>
      [
        "Match the exact art style of the attached reference images.",
        `${subject}, as a premium soft 3D product illustration.`,
        "Smooth matte plastic surfaces, rounded corners, bold saturated colors, slight isometric 3/4 view.",
        "Soft studio lighting from upper left, gentle contact shadow beneath the object only.",
        "NOT pixel art, NOT voxel blocks, NOT flat vector.",
        "Centered on plain solid very-light-gray (#F2F2F2) background with generous margins.",
        `High-resolution product render quality. ${NO_JUNK}`,
      ].join(" "),
  },
  {
    id: "flat-vector",
    label: "Flat Vector — infographic",
    group: "Assets & Icons",
    tagline: "Bold simple shapes, crisp edges, video-overlay ready",
    cutoutFriendly: true,
    sampleSubject: "a lightbulb with a small gear inside",
    buildPrompt: (subject) =>
      [
        `A single ${subject}, rendered as a flat vector infographic asset.`,
        "Clean 2D flat-design illustration with bold simple shapes, smooth curves and crisp edges.",
        "Consistent limited palette: vivid accent colors with soft shading only, no gradients heavier than two stops, no texture noise.",
        "The subject is perfectly centered with generous even margins on every side and never touches the image edges.",
        "Plain solid uniform light-gray (#EEEEEE) background with absolutely nothing else on it — no shadows on the background, no floor line.",
        `High resolution, sharp and crisp, suitable as a cut-out overlay asset in a video infographic. ${NO_JUNK}`,
      ].join(" "),
  },
  {
    id: "raw",
    label: "Raw prompt (no style)",
    group: "Free",
    tagline: "Your prompt goes to the model untouched",
    cutoutFriendly: false,
    sampleSubject: "anything",
    buildPrompt: (subject) => subject,
  },
];

export const DEFAULT_ART_STYLE_ID = "flat-vector";

export function getArtStyle(id: string): ArtStyle {
  return ART_STYLES.find((s) => s.id === id) ?? ART_STYLES[ART_STYLES.length - 1];
}

