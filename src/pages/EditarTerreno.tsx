import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { GlbDropzone } from "../components/GlbDropzone";
import { GlbPreview, fileToPreviewUrl } from "../components/GlbPreview";
import { api, ApiError } from "../lib/api";

type Terreno = {
  id: number;
  matricula: string;
  proprietario: string;
  area: string | null;
  perimetro: string | null;
  altura_max: number | null;
  altura_min: number | null;
  url_terreno: string;
};

export function EditarTerreno() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [terreno, setTerreno] = useState<Terreno | null>(null);
  const [area, setArea] = useState("");
  const [perimetro, setPerimetro] = useState("");
  const [alturaMax, setAlturaMax] = useState("");
  const [alturaMin, setAlturaMin] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/admin/terrenos/${id}`)
      .then((data: Terreno) => {
        setTerreno(data);
        setArea(data.area ?? "");
        setPerimetro(data.perimetro ?? "");
        setAlturaMax(data.altura_max?.toString() ?? "");
        setAlturaMin(data.altura_min?.toString() ?? "");
      })
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar terreno")
      );
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const formData = new FormData();
    formData.append("area", area);
    formData.append("perimetro", perimetro);
    formData.append("altura_max", alturaMax);
    formData.append("altura_min", alturaMin);
    if (file) formData.append("glb", file);

    setEnviando(true);
    setProgress(file ? 0 : null);

    try {
      await api.uploadForm(`/admin/terrenos/${id}`, "PUT", formData, setProgress);
      setSucesso("Terreno atualizado com sucesso.");
      setTimeout(() => navigate("/terrenos"), 900);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao atualizar terreno");
    } finally {
      setEnviando(false);
    }
  }

  if (!terreno) {
    return (
      <Layout>
        {erro ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
        ) : (
          <p className="text-sm text-vertente-medium">Carregando...</p>
        )}
      </Layout>
    );
  }

  const previewUrl = file ? fileToPreviewUrl(file) : terreno.url_terreno;

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-vertente-dark">
        Editar terreno · {terreno.proprietario}
      </h1>
      <p className="mt-1 text-sm text-vertente-medium">Matrícula {terreno.matricula}</p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl2 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-vertente-dark">
            Dados técnicos
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Área">
              <input value={area} onChange={(e) => setArea(e.target.value)} className="input" />
            </Field>
            <Field label="Perímetro">
              <input
                value={perimetro}
                onChange={(e) => setPerimetro(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Altura máxima">
              <input
                value={alturaMax}
                onChange={(e) => setAlturaMax(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Altura mínima">
              <input
                value={alturaMin}
                onChange={(e) => setAlturaMin(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-vertente-ink">
              Substituir modelo 3D (opcional)
            </h3>
            <GlbDropzone file={file} onSelect={setFile} progress={progress} />
          </div>

          {erro && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
          )}
          {sucesso && (
            <p className="mt-4 rounded-lg bg-vertente-light/30 px-4 py-3 text-sm text-vertente-dark">
              {sucesso}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 w-full rounded-lg bg-vertente py-3 text-sm font-medium text-white transition-colors hover:bg-vertente-dark disabled:opacity-60"
          >
            {enviando ? `Salvando... ${progress ?? 0}%` : "Salvar alterações"}
          </button>
        </section>

        <section className="rounded-xl2 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-vertente-dark">
            Pré-visualização
          </h2>
          <GlbPreview url={previewUrl} />
        </section>
      </form>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-vertente-ink">{label}</span>
      {children}
    </label>
  );
}
