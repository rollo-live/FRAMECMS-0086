/**
 * Face detection + embedding extraction using @vladmandic/human (TF.js node)
 * Runs server-side on photo upload.
 */

let humanInstance: any = null;

async function getHuman() {
  if (humanInstance) return humanInstance;

  // Dynamic import to avoid loading TF at startup
  const { Human } = await import("@vladmandic/human");

  const config = {
    modelBasePath: "https://vladmandic.github.io/human/models/",
    face: {
      enabled: true,
      detector: { enabled: true, rotation: true, minConfidence: 0.3 },
      mesh: { enabled: false },
      iris: { enabled: false },
      emotion: { enabled: false },
      description: { enabled: true }, // produces 128-dim embedding
      age: { enabled: false },
      gender: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    gesture: { enabled: false },
    object: { enabled: false },
    segmentation: { enabled: false },
    // Use tfjs-node backend
    backend: "tensorflow" as const,
    wasmPath: "",
    debug: false,
  };

  humanInstance = new Human(config);
  await humanInstance.load();
  return humanInstance;
}

export interface FaceResult {
  embedding: number[];
  box: { x: number; y: number; width: number; height: number }; // normalized 0-1
  confidence: number;
}

/**
 * Detect faces in an image buffer and return embeddings + bounding boxes.
 */
export async function detectFaces(imageBuffer: Buffer): Promise<FaceResult[]> {
  try {
    const human = await getHuman();

    // Convert buffer to tensor via sharp or raw decode
    // @vladmandic/human accepts ImageData-like objects
    // We'll use jimp (bundled with human) or sharp
    let tensor: any;

    try {
      // Try using tfjs to decode image
      const tf = (await import("@tensorflow/tfjs-node")).default;
      tensor = tf.node.decodeImage(imageBuffer, 3);
    } catch {
      return [];
    }

    const result = await human.detect(tensor, {});
    tensor.dispose?.();

    if (!result.face || result.face.length === 0) return [];

    const faces: FaceResult[] = result.face
      .filter((f: any) => f.score > 0.3 && f.embedding && f.embedding.length > 0)
      .map((f: any) => {
        // box is [x, y, width, height] in pixels — normalize by image dims
        const [bx, by, bw, bh] = f.box ?? [0, 0, 0, 0];
        const iw = result.width ?? 1;
        const ih = result.height ?? 1;
        return {
          embedding: Array.from(f.embedding as number[]),
          box: {
            x: bx / iw,
            y: by / ih,
            width: bw / iw,
            height: bh / ih,
          },
          confidence: f.score,
        };
      });

    return faces;
  } catch (e) {
    console.error("[face-detection] error:", e);
    return [];
  }
}

/**
 * Cosine similarity between two embeddings (range -1 to 1, 1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Average two embeddings (for updating the mean embedding of a person)
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const len = embeddings[0].length;
  const sum = new Array(len).fill(0);
  for (const e of embeddings) {
    for (let i = 0; i < len; i++) sum[i] += e[i];
  }
  return sum.map((v) => v / embeddings.length);
}

/** Match threshold: above this similarity → same person */
export const FACE_MATCH_THRESHOLD = 0.6;
