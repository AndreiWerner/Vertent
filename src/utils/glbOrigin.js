// src/utils/glbOrigin.js
//
// Extrai origin_x/origin_y/origin_z (e o EPSG) gravados pelo Topo
// Textura nos `extras` do node "Terreno" de um arquivo .glb -- ver
// export/gltf_exporter.py:_build_gltf2 no projeto Topo Textura, que
// grava:
//
//   node.extras = {
//     "topotexture_origin_x": ...,
//     "topotexture_origin_y": ...,
//     "topotexture_origin_z": ...,
//     "topotexture_epsg": ...,
//   }
//
// Lê só o cabeçalho binário do GLB e o chunk JSON (nunca decodifica
// geometria/textura), seguindo o formato binário documentado na
// especificação glTF 2.0 (chunk 0 = JSON, chunk 1 = BIN) -- não
// depende de nenhuma biblioteca de glTF/three.js.
//
// NUNCA lança: retorna `null` sempre que o arquivo não for um .glb
// binário válido ou não tiver esses metadados -- esperado para GLBs
// gerados antes dessa funcionalidade existir no Topo Textura, ou
// vindos de qualquer fonte que não seja o Topo Textura. Nesses casos
// o terreno fica sem `origin` (colunas NULL), o mesmo tratamento já
// dado a pontos/confrontantes de terrenos antigos.

const JSON_CHUNK_TYPE = 0x4e4f534a; // 'JSON' em little-endian

function extractOriginFromGlb(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length < 20) return null;
    if (buffer.toString("ascii", 0, 4) !== "glTF") return null; // não é GLB binário

    let offset = 12; // pula o header (magic + version + length, 4 bytes cada)
    let json = null;

    while (offset + 8 <= buffer.length) {
      const chunkLength = buffer.readUInt32LE(offset);
      const chunkType = buffer.readUInt32LE(offset + 4);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkLength;
      if (chunkEnd > buffer.length) break;

      if (chunkType === JSON_CHUNK_TYPE) {
        json = JSON.parse(buffer.toString("utf8", chunkStart, chunkEnd));
        break; // o chunk JSON é sempre o primeiro no GLB; não precisa ler o resto
      }

      offset = chunkEnd;
    }

    if (!json || !Array.isArray(json.nodes)) return null;

    const node = json.nodes.find(
      (n) => n.extras && n.extras.topotexture_origin_x !== undefined
    );
    if (!node) return null;

    const {
      topotexture_origin_x: origin_x,
      topotexture_origin_y: origin_y,
      topotexture_origin_z: origin_z,
      topotexture_epsg: epsg,
    } = node.extras;

    if (
      typeof origin_x !== "number" ||
      typeof origin_y !== "number" ||
      typeof origin_z !== "number"
    ) {
      return null;
    }

    return { origin_x, origin_y, origin_z, epsg: typeof epsg === "number" ? epsg : null };
  } catch {
    return null;
  }
}

module.exports = { extractOriginFromGlb };
