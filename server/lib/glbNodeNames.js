// glbNodeNames.js
//
// Reads a .glb file's named nodes straight out of its binary container - no glTF/three.js
// dependency needed server-side, since all we actually need is the list of names an admin can
// assign to a slot in routes/characterSets.js. A GLB is: a 12-byte header (magic/version/length),
// then one or more 8-byte-prefixed chunks; the first chunk is always the glTF JSON document
// itself (chunk type "JSON"), which is all this reads.
//
// Returns node names rather than mesh names deliberately - CharacterCustomizer3D.jsx matches
// slots by walking the loaded scene's Object3D hierarchy and comparing node.name (via
// gltf.scene.traverse), not the glTF mesh list, so these are the names that actually matter for
// wiring a slot up correctly.

import fs from "fs";

export function readGlbNodeNames(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67 /* "glTF" */) {
    throw new Error("Not a valid .glb file (bad magic number).");
  }

  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString("ascii", 16, 20);
  if (chunkType !== "JSON") {
    throw new Error("Not a valid .glb file (first chunk isn't JSON).");
  }

  const json = JSON.parse(buffer.toString("utf-8", 20, 20 + chunkLength));
  const names = (json.nodes || [])
    .map((node) => node.name)
    .filter((name) => typeof name === "string" && name.length > 0);

  // De-duplicated, but order preserved - admins read this top-to-bottom same as the JSON's own
  // node order, which usually matches how the model was built in Blender.
  return [...new Set(names)];
}
