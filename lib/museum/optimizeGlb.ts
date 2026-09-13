// lib/museum/optimizeGlb.ts
//
// Server-side .glb compression — the same pass that took the museum's 76
// existing props from 771.4 MB to 77.5 MB (Docs/Museum_AssetOptimization.md),
// but run automatically on every new upload instead of as a one-off batch.
//
// Without this the problem returns one prop at a time: a raw Sketchfab export
// is typically ~9 MB and can be 47 MB, and one was uploaded within a day of
// that batch finishing. Compressing on the way in is what stops the egress
// quota being an ongoing chore.
//
// Node-only (sharp, draco3dgltf). Never import this from a client component.
import { NodeIO, type Transform } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, flatten, join, prune, textureCompress, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import sharp from "sharp";

let ioPromise: Promise<NodeIO> | null = null;

// The draco encoder/decoder are WASM modules that take a moment to instantiate;
// one instance is reused for the lifetime of the serverless container.
function getIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () =>
      new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        "draco3d.decoder": await draco3d.createDecoderModule(),
        "draco3d.encoder": await draco3d.createEncoderModule(),
      }))();
  }
  return ioPromise;
}

export interface OptimizeResult {
  data: Uint8Array;
  beforeBytes: number;
  afterBytes: number;
}

/**
 * Compresses one .glb in memory. Geometry goes to Draco and textures to WebP;
 * unused vertex attributes (Sketchfab exports routinely carry two spare UV sets
 * and a tangent nothing reads) are dropped along the way.
 *
 * Deliberately NOT simplifying meshes. Decimation is the one transform here
 * that a visitor could actually see — it softens silhouettes — and the whole
 * point of this pass is that the model looks identical afterwards. Triangle
 * counts come out unchanged; only the encoding differs.
 */
export async function optimizeGlb(input: Uint8Array): Promise<OptimizeResult> {
  const io = await getIO();
  const doc = await io.readBinary(input);

  const transforms: Transform[] = [
    dedup(),
    flatten(),
    join(),
    weld(),
    // keepAttributes:false is what actually removes TEXCOORD_1/TEXCOORD_2 and
    // TANGENT when no material samples them.
    prune({ keepAttributes: false, keepLeaves: false }),
    textureCompress({ encoder: sharp, targetFormat: "webp" }),
    draco(),
  ];

  await doc.transform(...transforms);
  const data = await io.writeBinary(doc);
  return { data, beforeBytes: input.byteLength, afterBytes: data.byteLength };
}
