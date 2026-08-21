import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { GlbDropzone } from "../components/GlbDropzone";
import { GlbPreview, fileToPreviewUrl } from "../components/GlbPreview";
import { api, ApiError } from "../lib/api";

export function NovoTerreno() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [area, setArea] = useState("");
  const [perimetro, setPerimetro] = useState("");
  const [alturaMax, setAlturaMax] = useState("");
  const [alturaMin, setAlturaMin] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function handleSelectFile(selected: File | null) {
    setFile(selected);
    setPreviewUrl(fileToPreviewUrl(selected));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!file) {
      setErro("Selecione um arquivo GLB.");
      return;
    }

    const formData = new FormData();
    formData.append("nome", nome);
    formData.append("cpf", cpf);
    formData.append("matricula", matricula);
    formData.append("area", area);
    formData.append("perimetro", perimetro);
    formData.append("altura_max", alturaMax);
    formData.append("altura_min", alturaMin);
    formData.append("glb", file);

    setEnviando(true);
    setProgress(0);

    try {
      await api.uploadForm("/admin/terrenos", "POST", formData, setProgress);
      setSucesso("Terreno cadastrado com sucesso.");
      setTimeout(() => navigate("/terrenos"), 900);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao enviar o modelo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-vertente-dark">Novo Terreno</h1>
      <p className="mt-1 text-sm text-vertente-medium">
        Cadastre o cliente, os dados técnicos do terreno e o modelo 3D (GLB).
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-semibold text-vertente-dark">
              Dados do usuário
            </h2>
            <div className="space-y-4">
              <Field label="Nome">
                <input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="CPF">
                <input
                  required
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="Somente números"
                  className="input"
                />
              </Field>
              <Field label="Matrícula">
                <input
                  required
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-semibold text-vertente-dark">
              Dados do terreno
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
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-semibold text-vertente-dark">
              Modelo 3D do terreno
            </h2>
            <GlbDropzone file={file} onSelect={handleSelectFile} progress={progress} />
          </section>

          <section className="rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-semibold text-vertente-dark">
              Pré-visualização
            </h2>
            <GlbPreview url={previewUrl} />
          </section>

          {erro && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
          )}
          {sucesso && (
            <p className="rounded-lg bg-vertente-light/30 px-4 py-3 text-sm text-vertente-dark">
              {sucesso}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-vertente py-3 text-sm font-medium text-white transition-colors hover:bg-vertente-dark disabled:opacity-60"
          >
            {enviando ? `Enviando... ${progress ?? 0}%` : "Cadastrar"}
          </button>
        </div>
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
