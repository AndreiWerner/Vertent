import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { GlbDropzone } from "../components/GlbDropzone";
import { GlbPreview, fileToPreviewUrl } from "../components/GlbPreview";
import { PdfDropzone } from "../components/PdfDropzone";
import { ConfrontantesReview, type Ponto, type Confrontante } from "../components/ConfrontantesReview";
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

  // Preenchido só depois que o terreno base é criado -- planta,
  // memorial e confrontantes exigem um terreno já existente (mesmos
  // endpoints usados em EditarTerreno.tsx, que exigem :id na rota).
  const [terrenoId, setTerrenoId] = useState<number | null>(null);

  // ---- Planta do imóvel (confrontantes) -- mesmo fluxo de EditarTerreno.tsx ----
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

  // ---- Memorial descritivo -- mesmo fluxo de EditarTerreno.tsx ----
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
  const [memorialProgress, setMemorialProgress] = useState<number | null>(null);
  const [memorialEnviando, setMemorialEnviando] = useState(false);
  const [memorialErro, setMemorialErro] = useState<string | null>(null);
  const [memorialUrl, setMemorialUrl] = useState<string | null>(null);

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
      const resultado = await api.uploadForm("/admin/terrenos", "POST", formData, setProgress);
      setSucesso("Terreno cadastrado com sucesso. Adicione os documentos e confrontantes abaixo.");
      // Não navega mais automaticamente -- o admin ainda pode anexar
      // planta, memorial e confrontantes nesta mesma tela (ver seções
      // abaixo, liberadas assim que terrenoId existe).
      setTerrenoId(resultado.terrenoId);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao enviar o modelo.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleSelecionarPlanta(selected: File | null) {
    setPlantaFile(selected);
    if (!selected || !terrenoId) return;

    setPlantaErro(null);
    setConfrontantesSucesso(null);
    setPlantaEnviando(true);
    setPlantaProgress(0);

    const formData = new FormData();
    formData.append("pdf", selected);

    try {
      const resultado = await api.uploadForm(
        `/admin/terrenos/${terrenoId}/planta`,
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
    if (!terrenoId) return;

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
      await api.post(`/admin/terrenos/${terrenoId}/confrontantes`, {
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
    if (!terrenoId) return;

    setPlantaErro(null);
    setConfrontantesSucesso(null);
    setAviso(null);
    setPlantaFile(null);

    try {
      const data = await api.get(`/admin/terrenos/${terrenoId}/confrontantes`);
      setPontos(data.pontos ?? []);
      setConfrontantes(data.confrontantes ?? []);
    } catch {
      // Nada salvo ainda para este terreno recém-criado -- volta pro
      // estado vazio.
      setPontos([]);
      setConfrontantes([]);
    }
  }

  async function handleSelecionarMemorial(selected: File | null) {
    setMemorialFile(selected);
    if (!selected || !terrenoId) return;

    setMemorialErro(null);
    setMemorialEnviando(true);
    setMemorialProgress(0);

    const formData = new FormData();
    formData.append("pdf", selected);

    try {
      const resultado = await api.uploadForm(
        `/admin/terrenos/${terrenoId}/memorial`,
        "POST",
        formData,
        setMemorialProgress
      );
      setMemorialUrl(resultado.memorial_pdf_url);
    } catch (err) {
      setMemorialErro(err instanceof ApiError ? err.message : "Erro ao enviar o memorial");
    } finally {
      setMemorialEnviando(false);
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
                  disabled={!!terrenoId}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="CPF">
                <input
                  required
                  disabled={!!terrenoId}
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="Somente números"
                  className="input"
                />
              </Field>
              <Field label="Matrícula">
                <input
                  required
                  disabled={!!terrenoId}
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
                <input
                  disabled={!!terrenoId}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Perímetro">
                <input
                  disabled={!!terrenoId}
                  value={perimetro}
                  onChange={(e) => setPerimetro(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Altura máxima">
                <input
                  disabled={!!terrenoId}
                  value={alturaMax}
                  onChange={(e) => setAlturaMax(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Altura mínima">
                <input
                  disabled={!!terrenoId}
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

          {!terrenoId && (
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-vertente py-3 text-sm font-medium text-white transition-colors hover:bg-vertente-dark disabled:opacity-60"
            >
              {enviando ? `Enviando... ${progress ?? 0}%` : "Cadastrar"}
            </button>
          )}
        </div>
      </form>

      {/* Planta, confrontantes e memorial só ficam disponíveis depois
          que o terreno base foi criado (precisam de um terrenoId --
          mesmos endpoints/componentes de EditarTerreno.tsx). */}
      {terrenoId && (
        <>
          <section className="mt-6 rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-1 text-base font-semibold text-vertente-dark">Planta do imóvel</h2>
            <p className="mb-4 text-sm text-vertente-medium">
              Envie o PDF da planta para identificar automaticamente os pontos e confrontantes.
              Nada é salvo até você conferir e clicar em "Confirmar e salvar" abaixo.
            </p>

            {plantaUrl ? (
              <a
                href={plantaUrl}
                target="_blank"
                rel="noreferrer"
                className="mb-4 inline-block text-sm text-vertente underline underline-offset-2"
              >
                Ver planta enviada
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

            {(pontos.length > 0 || confrontantes.length > 0 || plantaUrl) && !plantaEnviando && (
              <div className="mt-6 border-t border-vertente-bg pt-6">
                <h3 className="mb-4 text-sm font-semibold text-vertente-ink">
                  Conferência dos confrontantes
                </h3>
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
                Ver memorial enviado
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
              <p className="mt-3 text-sm text-vertente-medium">Enviando memorial...</p>
            )}

            {memorialErro && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{memorialErro}</p>
            )}
          </section>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/terrenos")}
              className="rounded-lg bg-vertente px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
            >
              Concluir cadastro
            </button>
          </div>
        </>
      )}
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
