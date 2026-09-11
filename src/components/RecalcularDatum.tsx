import { useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Ponto } from "./ConfrontantesReview";

type SistemaCoordenadas = {
  tipo: "UTM" | "LAT_LONG" | null;
  confiavel: boolean;
} | null | undefined;

type Props = {
  terrenoId: number | string;
  sistemaCoordenadas: SistemaCoordenadas;
  pontos: Ponto[];
  onRecalculado: (pontos: Ponto[]) => void;
};

// Só os datums que o Backend realmente converte com precisão (ver
// coordenadas.js -- SAD69/Córrego Alegre exigiriam parâmetros de
// transformação que não implementamos, então nem aparecem aqui).
const DATUMS = [
  { valor: "SIRGAS2000", rotulo: "SIRGAS 2000" },
  { valor: "WGS84", rotulo: "WGS84" },
];

export function RecalcularDatum({ terrenoId, sistemaCoordenadas, pontos, onRecalculado }: Props) {
  const [datum, setDatum] = useState("SIRGAS2000");
  const [recalculando, setRecalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const pontosSemCoordenada = pontos.filter(
    (p) => (p.x === null || p.x === "") && typeof p.lat === "number" && typeof p.lon === "number"
  );

  // Só faz sentido mostrar isso quando o memorial é Lat/Long, o
  // backend não confiou no datum sozinho, E ainda sobrou pelo menos um
  // ponto sem X/Y (se o Admin já preencheu tudo manualmente, não há
  // mais nada a recalcular).
  if (sistemaCoordenadas?.tipo !== "LAT_LONG" || sistemaCoordenadas.confiavel) {
    return null;
  }
  if (pontosSemCoordenada.length === 0) {
    return null;
  }

  async function handleRecalcular() {
    setErro(null);
    setSucesso(null);
    setRecalculando(true);

    try {
      const corpo = {
        datum,
        pontos: pontosSemCoordenada.map((p) => ({ numero: p.numero, lat: p.lat, lon: p.lon })),
      };
      const resultado = await api.post(
        `/admin/terrenos/${terrenoId}/recalcular-coordenadas`,
        corpo
      );

      const porNumero = new Map(
        (resultado.pontos as Array<{ numero: number | string; x: number | null; y: number | null }>).map(
          (p) => [String(p.numero), p]
        )
      );

      const atualizados = pontos.map((p) => {
        const recalc = porNumero.get(String(p.numero));
        if (recalc && recalc.x !== null && recalc.y !== null) {
          return { ...p, x: recalc.x, y: recalc.y };
        }
        return p;
      });

      onRecalculado(atualizados);
      setSucesso("Coordenadas recalculadas abaixo. Confira os valores antes de salvar.");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao recalcular coordenadas");
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm text-amber-900">
        Este memorial não informa o sistema de referência (datum). Se você souber qual foi
        usado, escolha abaixo para calcular as coordenadas X/Y automaticamente, sem precisar
        digitar ponto a ponto.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          disabled={recalculando}
          className="rounded-lg border border-vertente-bg px-3 py-2 text-sm text-vertente-ink"
        >
          {DATUMS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.rotulo}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRecalcular}
          disabled={recalculando}
          className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vertente-dark disabled:opacity-60"
        >
          {recalculando ? "Recalculando..." : "Recalcular coordenadas"}
        </button>
      </div>
      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
      {sucesso && <p className="mt-3 text-sm text-vertente-dark">{sucesso}</p>}
    </div>
  );
}
