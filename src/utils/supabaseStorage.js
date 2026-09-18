const { createClient } = require("@supabase/supabase-js");

function getClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas no .env"
    );
  }

  console.log("🔗 Supabase URL:", url);
  console.log("🔑 Service Role configurada:", !!serviceKey);
  console.log("📦 Bucket:", process.env.SUPABASE_BUCKET || "terrenos-glb");

  return createClient(url, serviceKey);
}

async function uploadFile(
  buffer,
  originalName,
  mimeType,
  folder = "terrenos"
) {
  try {
    const supabase = getClient();

    const bucket = process.env.SUPABASE_BUCKET || "terrenos-glb";

    const ext = originalName.includes(".")
      ? originalName.split(".").pop()
      : "glb";

    const safeName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    console.log("📤 Iniciando upload...");
    console.log("📁 Bucket:", bucket);
    console.log("📄 Arquivo:", safeName);
    console.log("📦 Tamanho:", buffer.length, "bytes");
    console.log("📝 MIME:", mimeType);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(safeName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("❌ Supabase Storage retornou erro:");
      console.error(error);

      throw new Error(
        `Falha no upload para o Supabase Storage: ${error.message}`
      );
    }

    console.log("✅ Upload concluído:", data);

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(safeName);

    console.log("🌐 URL pública:", publicData.publicUrl);

    return publicData.publicUrl;
  } catch (error) {
    console.error("❌ ERRO COMPLETO NO UPLOAD:");

    console.error(error);

    if (error.cause) {
      console.error("🔍 CAUSA:", error.cause);
    }

    throw error;
  }
}

module.exports = {
  uploadFile,
};