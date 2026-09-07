import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { GlbDropzone } from "../components/GlbDropzone";
import { GlbPreview, fileToPreviewUrl } from "../components/GlbPreview";
import { PdfDropzone } from "../components/PdfDropzone";
import { ConfrontantesReview, type Ponto, type Confrontante } from "../components/ConfrontantesReview";
import { api, ApiError } from "../lib/api";

type Terreno ={
  id: number;
  matricula: string;
  proprietario: string;
  area: string | null;
  perimetro: string | null;
  altura_max: number | null;
  altura_min: number | null;
  url_terreno: string;
  pdf_confrontantes_url: string | null;
  memorial_pdf_url: string | null;
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

  // ---- Planta do imóvel (documento) ----
  const [plantaFile, setPlantaFile] = useState<File | null>(null);
  const [plantaProgress, setPlantaProgress] = useState<number | null>(null);
  const [plantaEnviando, setPlantaEnviando] = useState(false);
  const [plantaErro, setPlantaErro] = useState<string | null>(null);
  const [plantaUrl, setPlantaUrl] = useState<string | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [confrontantes, setConfrontantes] = useState<Confrontante[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvandoConfrontantes, setSalvandoConfrontantes] = useState(false);
  const [confrontantesSucesso, setConfrontantesSucesso] = useState<string | null>(null);

  // ---- Memorial descritivo ----
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
  const [memorialProgress, setMemorialProgress] = useState<number | null>(null);
  const [memorialEnviando, setMemorialEnviando] = useState(false);
  const [memorialErro, setMemorialErro] = useState<string | null>(null);
  const [memorialUrl, setMemorialUrl] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/admin/terrenos/${id}`)
      .then((data: Terreno) => {
        setTerreno(data);
        setArea(data.area ?? "");
        setPerimetro(data.perimetro ?? "");
        setAlturaMax(data.altura_max?.toString() ?? "");
        setAlturaMin(data.altura_min?.toString() ?? "");
        setPlantaUrl(data.pdf_confrontantes_url ?? null);
        setMemorialUrl(data.memorial_pdf_url ?? null);
      })
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar terreno")
      );

    // Carrega confrontantes já confirmados anteriormente (se houver),
    // para o admin poder revisar/editar sem precisar reenviar o PDF.
    api
      .get(`/admin/terrenos/${id}/confrontantes`)
      .then((data: { pontos: Ponto[]; confrontantes: Confrontante[] }) => {
        if (data.pontos?.length || data.confrontantes?.length) {
          setPontos(data.pontos);
          setConfrontantes(data.confrontantes);
        }
      })
      .catch(() => {
        // Terreno antigo sem confrontantes cadastrados -- normal, sem
        // erro nenhum pro usuário.
      });
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

  async function handleSelecionarPlanta(selected: File | null) {
    setPlantaFile(selected);
    if (!selected) return;

    setPlantaErro(null);
    setConfrontantesSucesso(null);
    setPlantaEnviando(true);
    setPlantaProgress(0);

    const formData = new FormData();
    formData.append("pdf", selected);

    try {
      const resultado = await api.uploadForm(
        `/admin/terrenos/${id}/planta`,
        "POST",
        formData,
        setPlantaProgress
      );
      setPlantaUrl(resultado.planta_pdf_url);
      setPontos(resultado.pontos ?? []);
      setConfrontantes(resultado.confrontantes ?? []);
      setAviso(resultado.aviso ?? null);
    } catch (err) {
      setPlantaErro(err instanceof ApiError ? err.message : "Erro ao enviar a planta");
    } finally {
      setPlantaEnviando(false);
    }
  }

  async function handleConfirmarConfrontantes() {
    setPlantaErro(null);
    setConfrontantesSucesso(null);
    setSalvandoConfrontantes(true);

    // Um ponto recém-adicionado na tela (ver ConfrontantesReview.tsx)
    // começa com x/y em branco ("") até o admin preencher -- o backend
    // espera número ou null nessas colunas, nunca string vazia.
    const pontosNormalizados = pontos.map((p) => ({
      numero: p.numero,
      x: p.x === "" ? null : p.x,
      y: p.y === "" ? null : p.y,
    }));
    const confrontantesNormalizados = confrontantes.map((c) => ({
      ...c,
      matricula: c.matricula === "" ? null : c.matricula,
    }));

    try {
      await api.post(`/admin/terrenos/${id}/confrontantes`, {
        pontos: pontosNormalizados,
        confrontantes: confrontantesNormalizados,
      });
      setConfrontantesSucesso("Confrontantes salvos com sucesso.");
    } catch (err) {
      setPlantaErro(err instanceof ApiError ? err.message : "Erro ao salvar confrontantes");
    } finally {
      setSalvandoConfrontantes(false);
    }
  }

  async function handleCancelarConfrontantes() {
    setPlantaErro(null);
    setConfrontantesSucesso(null);
    setAviso(null);
    setPlantaFile(null);

    try {
      const data = await api.get(`/admin/terrenos/${id}/confrontantes`);
      setPontos(data.pontos ?? []);
      setConfrontantes(data.confrontantes ?? []);
    } catch {
      // Terreno sem nada salvo ainda -- volta pro estado vazio.
      setPontos([]);
      setConfrontantes([]);
    }
  }

  async function handleSelecionarMemorial(selected: File | null) {
    setMemorialFile(selected);
    if (!selected) return;

    setMemorialErro(null);
    setMemorialEnviando(true);
    setMemorialProgress(0);

    const formData = new FormData();
    formData.append("pdf", selected);

    try {
      const resultado = await api.uploadForm(
        `/admin/terrenos/${id}/memorial`,
        "POST",
        formData,
        setMemorialProgress
      );
      setMemorialUrl(resultado.memorial_pdf_url);
      // O memorial é a fonte principal da automação: a resposta já traz
      // pontos e confrontantes extraídos para conferência antes de salvar.
      setPontos(resultado.pontos ?? []);
      setConfrontantes(resultado.confrontantes ?? []);
      setAviso(resultado.aviso ?? null);
      setConfrontantesSucesso(null);
    } catch (err) {
      setMemorialErro(err instanceof ApiError ? err.message : "Erro ao enviar o memorial");
    } finally {
      setMemorialEnviando(false);
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

      {/* Planta: documento complementar. A extração automática de
          pontos/confrontantes acontece pelo memorial descritivo. */}
      <section className="mt-6 rounded-xl2 bg-white p-6 shadow-card">
        <h2 className="mb-1 text-base font-semibold text-vertente-dark">Planta do imóvel</h2>
        <p className="mb-4 text-sm text-vertente-medium">
          Envie o PDF da planta do imóvel. A planta é armazenada separadamente; a fonte principal da extração é o memorial descritivo.
          Nada é salvo até você conferir e clicar em "Confirmar e salvar" abaixo.
        </p>

        {plantaUrl ? (
          <a
            href={plantaUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-4 inline-block text-sm text-vertente underline underline-offset-2"
          >
            Ver planta atual
          </a>
        ) : (
          <p className="mb-4 text-sm text-vertente-medium">Não cadastrado.</p>
        )}

        <PdfDropzone
          file={plantaFile}
          onSelect={handleSelecionarPlanta}
          progress={plantaProgress}
          label="Arraste o PDF da planta aqui"
        />

        {plantaEnviando && (
          <p className="mt-3 text-sm text-vertente-medium">Processando planta...</p>
        )}

        {plantaErro && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{plantaErro}</p>
        )}
        </section>

      {/* Memorial descritivo: fonte principal da extração automática. */}
      <section className="mt-6 rounded-xl2 bg-white p-6 shadow-card">
        <h2 className="mb-1 text-base font-semibold text-vertente-dark">Memorial Descritivo</h2>
        <p className="mb-4 text-sm text-vertente-medium">
          PDF do memorial descritivo do terreno, disponibilizado para o cliente no aplicativo.
        </p>

        {memorialUrl ? (
          <a
            href={memorialUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-4 inline-block text-sm text-vertente underline underline-offset-2"
          >
            Ver memorial atual
          </a>
        ) : (
          <p className="mb-4 text-sm text-vertente-medium">Não cadastrado.</p>
        )}

        <PdfDropzone
          file={memorialFile}
          onSelect={handleSelecionarMemorial}
          progress={memorialProgress}
          label="Arraste o PDF do memorial aqui"
        />

        {memorialEnviando && (
          <p className="mt-3 text-sm text-vertente-medium">Enviando e processando memorial...</p>
        )}

        {memorialErro && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{memorialErro}</p>
        )}
                {(pontos.length > 0 || confrontantes.length > 0) && !memorialEnviando && (
            <div className="mt-6 border-t border-vertente-bg pt-6">
              <h3 className="mb-1 text-sm font-semibold text-vertente-ink">
                Conferência da extração do memorial
              </h3>
              <p className="mb-4 text-xs text-vertente-medium">
                Os dados abaixo foram extraídos automaticamente do memorial. Revise e corrija apenas se necessário. Nada é gravado até confirmar.
              </p>
              <ConfrontantesReview
                pontos={pontos}
                confrontantes={confrontantes}
                aviso={aviso}
                onChange={(novosPontos, novosConfrontantes) => {
                  setPontos(novosPontos);
                  setConfrontantes(novosConfrontantes);
                }}
              />

              {confrontantesSucesso && (
                <p className="mt-4 rounded-lg bg-vertente-light/30 px-4 py-3 text-sm text-vertente-dark">
                  {confrontantesSucesso}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmarConfrontantes}
                  disabled={salvandoConfrontantes}
                  className="rounded-lg bg-vertente px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark disabled:opacity-60"
                >
                  {salvandoConfrontantes ? "Salvando..." : "Confirmar e salvar"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelarConfrontantes}
                  disabled={salvandoConfrontantes}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-vertente-medium transition-colors hover:bg-vertente-bg disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
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
