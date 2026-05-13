/**
 * Face detection + embedding extraction via Python/DeepFace subprocess.
 * Uses DeepFace with Facenet model (128-dim embeddings).
 * Node subprocess → python3 face_detect.py <image_path> → JSON stdout
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

const execFileAsync = promisify(execFile);

// Path to the Python detector script (same directory as this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DETECTOR_SCRIPT = join(__dirname, "face_detect.py");

export interface FaceResult {
  embedding: number[];
  box: { x: number; y: number; width: number; height: number }; // pixels (not normalized)
  confidence: number;
}

/**
 * Detect faces in an image buffer and return embeddings + bounding boxes.
 * Writes buffer to a temp file, calls Python script, parses JSON output.
 */
export async function detectFaces(imageBuffer: Buffer): Promise<FaceResult[]> {
  const tmpPath = join(tmpdir(), `face_${randomBytes(8).toString("hex")}.jpg`);

  try {
    // Write buffer to temp file
    await writeFile(tmpPath, imageBuffer);

    const { stdout, stderr } = await execFileAsync(
      "python3",
      [DETECTOR_SCRIPT, tmpPath],
      {
        timeout: 30_000,
        env: {
          ...process.env,
          TF_CPP_MIN_LOG_LEVEL: "3",
          CUDA_VISIBLE_DEVICES: "",
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB for large embeddings arrays
      }
    );

    if (stderr) {
      console.warn("[face-detection] stderr:", stderr.slice(0, 300));
    }

    const faces: FaceResult[] = JSON.parse(stdout.trim() || "[]");
    return faces;
  } catch (e: any) {
    console.error("[face-detection] error:", e?.message ?? e);
    return [];
  } finally {
    // Clean up temp file
    unlink(tmpPath).catch(() => {});
  }
}

/**
 * Cosine similarity between two embeddings (range -1 to 1, 1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
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

/** Match threshold: above this cosine similarity → same person */
export const FACE_MATCH_THRESHOLD = 0.6;
