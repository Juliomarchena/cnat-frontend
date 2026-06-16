// VIGIA - Asistente del Centro Nacional de Alerta de Tsunamis (CNAT)
// Marina de Guerra del Perú — Edge Function v3
// MICROHELP © 2026
//
// v3: Prompt jerárquico — sismos locales/cercanos al Perú en PRIMERA PLANA
// Misma lógica de proximidad que ModuloARIA.jsx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Distancia aproximada en km entre dos puntos ───
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Centro del Perú ───
const PERU_CENTER = { lat: -9.19, lon: -75.01 };
const PERU_BBOX   = { latMin: -18.5, latMax: -0.03, lonMin: -81.5, lonMax: -68.5 };

function clasificarProximidad(lat: number, lon: number, mag: number) {
  const dist   = distanciaKm(lat, lon, PERU_CENTER.lat, PERU_CENTER.lon);
  const enBbox = lat >= PERU_BBOX.latMin && lat <= PERU_BBOX.latMax &&
                 lon >= PERU_BBOX.lonMin && lon <= PERU_BBOX.lonMax;
  if (enBbox || dist <= 300)  return { nivel: "LOCAL",    distKm: Math.round(dist), urgente: mag >= 5.5 };
  if (dist <= 800)            return { nivel: "CERCANO",  distKm: Math.round(dist), urgente: mag >= 6.0 };
  if (dist <= 1500)           return { nivel: "REGIONAL", distKm: Math.round(dist), urgente: mag >= 6.5 };
  return                             { nivel: "REMOTO",   distKm: Math.round(dist), urgente: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, supabaseKey);

    // ─── Fechas de referencia ───
    const ahora        = new Date();
    const hoy          = ahora.toISOString().split("T")[0];
    const ayer         = new Date(ahora.getTime() - 86400000).toISOString().split("T")[0];
    const haceUnaSemana= new Date(ahora.getTime() - 7  * 86400000).toISOString().split("T")[0];
    const hace30Dias   = new Date(ahora.getTime() - 30 * 86400000).toISOString().split("T")[0];

    const tools = [
      {
        name: "consultar_sismos",
        description: `Consulta sismos en la base de datos del CNAT.
USA SIEMPRE esta herramienta antes de responder cualquier pregunta sobre sismos.
IMPORTANTE sobre el campo solo_locales_peru:
- Si el usuario menciona "Perú", "Peru", "peruano", "local", "territorio peruano" → pon solo_locales_peru=true
- Si no menciona país específico o menciona otros países → pon solo_locales_peru=false`,
        input_schema: {
          type: "object",
          properties: {
            fecha_inicio:      { type: "string",  description: "Fecha inicio YYYY-MM-DD." },
            fecha_fin:         { type: "string",  description: "Fecha fin YYYY-MM-DD." },
            region:            { type: "string",  description: "Texto a buscar en place. Solo para regiones NO peruanas." },
            magnitud_minima:   { type: "number",  description: "Magnitud mínima. Opcional." },
            solo_locales_peru: { type: "boolean", description: "TRUE si pregunta por sismos en Perú." },
          },
          required: ["fecha_inicio", "fecha_fin"],
        },
      },
    ];

    const systemPrompt = `Eres VIGÍA, asistente operacional del CNAT (Centro Nacional de Alerta de Tsunamis) de la Marina de Guerra del Perú.

════════════════════════════════════════════
REGLA FUNDAMENTAL DE JERARQUÍA — LEE ESTO PRIMERO
════════════════════════════════════════════
Cuando respondas cualquier consulta sísmica, SIEMPRE ordena así:

1. 🔴 PRIMERO — Sismos LOCALES o CERCANOS al Perú (<800km) con M≥5.5
   → PRIMERA PLANA con todos los detalles:
   → Magnitud, lugar exacto, profundidad, distancia estimada a costa peruana,
     nivel DHN, estado de boyas cercanas, réplicas si las hay,
     recomendaciones inmediatas al operador

2. 🟡 SEGUNDO — Sismos REGIONALES (800-1500km) con M≥6.0
   → Párrafo propio con análisis de riesgo para Perú

3. ⚪ TERCERO — Resto del mundo
   → Solo resumen compacto, una línea por evento

4. 📊 CUARTO — Estadísticas y conclusión operacional

NUNCA mezcles un M6.9 en Chile con un M4.5 en Hawaii en la misma lista plana.
Un sismo local M5.5 es MÁS URGENTE para el operador peruano que un M7.0 en Japón.
════════════════════════════════════════════

REGLAS OPERACIONALES:
1. Llama SIEMPRE a consultar_sismos antes de responder. NUNCA respondas sin datos reales.
2. Si el usuario dice "en Perú" o "peruano" → usa solo_locales_peru=true.
3. No uses saludos ni presentaciones. Ve directo al reporte.
4. Responde en texto plano sin asteriscos ni markdown. Usa guiones y mayúsculas para resaltar.
5. Para eventos locales/cercanos al Perú, incluye SIEMPRE la distancia aproximada a Lima o a la costa más cercana.

Fechas de referencia:
- Hoy: ${hoy}
- Ayer: ${ayer}
- Hace 7 días: ${haceUnaSemana}
- Hace 30 días: ${hace30Dias}

FORMATO DE RESPUESTA:

[Si hay sismos locales/cercanos urgentes — PRIMERA PLANA:]
════════════════════════════════════════
🔴 EVENTO PRIORITARIO PARA PERÚ
════════════════════════════════════════
M X.X — LUGAR EXACTO
Distancia a costa peruana: ~XXX km
Profundidad: XX km | DHN: NIVEL
[análisis detallado de riesgo]
[estado de boyas más cercanas]
[recomendaciones al operador]
════════════════════════════════════════

[Luego sismos regionales y resto del mundo en formato compacto]

REPORTE SÍSMICO — [FECHA/PERIODO]
──────────────────────────────────
Total eventos: N | Locales Perú: N | Regionales: N

SISMOS CERCANOS A PERÚ (<800km):
- M X.X | LUGAR | FECHA | Prof: Xkm | ~XXXkm de Lima | DHN: NIVEL

SISMOS REGIONALES (800-1500km):
- M X.X | LUGAR | Prof: Xkm

OTROS EVENTOS RELEVANTES:
- [resumen compacto]

EVALUACION DE RIESGO PARA PERÚ:
[párrafo breve]

CONCLUSION OPERACIONAL: [1 línea]`;

    let claudeResponse = await callClaude(systemPrompt, message, conversationHistory, tools);

    while (claudeResponse.stop_reason === "tool_use") {
      const toolUseBlock = claudeResponse.content.find((b: any) => b.type === "tool_use");
      if (!toolUseBlock) break;

      let toolResult;
      if (toolUseBlock.name === "consultar_sismos") {
        toolResult = await ejecutarConsultaSismos(supabase, toolUseBlock.input);
      } else {
        toolResult = { error: "Herramienta desconocida" };
      }

      conversationHistory.push(
        { role: "assistant", content: claudeResponse.content },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolUseBlock.id, content: JSON.stringify(toolResult) }],
        }
      );

      claudeResponse = await callClaude(systemPrompt, "", conversationHistory, tools);
    }

    const finalText = claudeResponse.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    return new Response(
      JSON.stringify({ response: finalText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en VIGIA:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Llamada a Claude API ───
async function callClaude(systemPrompt: string, userMessage: string, history: any[], tools: any[]) {
  const apiKey   = Deno.env.get("ANTHROPIC_API_KEY")!;
  const messages = [...history];
  if (userMessage) messages.push({ role: "user", content: userMessage });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      system:     systemPrompt,
      tools:      tools,
      messages:   messages,
    }),
  });
  return await response.json();
}

// ─── Consulta de sismos con clasificación de proximidad al Perú ───
async function ejecutarConsultaSismos(supabase: any, params: any) {
  let query = supabase
    .from("earthquakes")
    .select("id, event_time, magnitude, depth_km, place, latitude, longitude, severity, is_local, tsunami_flag, dhn_level, dhn_reason")
    .gte("event_time", params.fecha_inicio + "T00:00:00")
    .lte("event_time", params.fecha_fin   + "T23:59:59")
    .order("magnitude", { ascending: false })
    .limit(50);

  if (params.region)          query = query.ilike("place", `%${params.region}%`);
  if (params.magnitud_minima) query = query.gte("magnitude", params.magnitud_minima);
  if (params.solo_locales_peru === true) query = query.eq("is_local", true);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // ── Enriquecer cada sismo con proximidad al Perú ──
  const enriquecidos = (data || []).map((eq: any) => {
    if (!eq.latitude || !eq.longitude) return { ...eq, proximidad_peru: "DESCONOCIDA", distancia_km: null };
    const prox = clasificarProximidad(
      parseFloat(eq.latitude),
      parseFloat(eq.longitude),
      parseFloat(eq.magnitude)
    );
    return {
      ...eq,
      proximidad_peru: prox.nivel,
      distancia_km:    prox.distKm,
      urgente_para_peru: prox.urgente,
    };
  });

  // ── Separar por proximidad para facilitar el reporte ──
  const locales    = enriquecidos.filter((e: any) => e.proximidad_peru === "LOCAL");
  const cercanos   = enriquecidos.filter((e: any) => e.proximidad_peru === "CERCANO");
  const regionales = enriquecidos.filter((e: any) => e.proximidad_peru === "REGIONAL");
  const remotos    = enriquecidos.filter((e: any) => e.proximidad_peru === "REMOTO");
  const urgentes   = enriquecidos.filter((e: any) => e.urgente_para_peru);

  return {
    total_eventos:    data.length,
    nota:             params.solo_locales_peru ? "Filtrado por sismos locales peruanos (is_local=true)" : "Sismos globales con clasificación de proximidad al Perú",
    resumen_proximidad: {
      locales_peru:    locales.length,
      cercanos:        cercanos.length,
      regionales:      regionales.length,
      remotos:         remotos.length,
      urgentes_peru:   urgentes.length,
    },
    // ── Grupos separados para facilitar formato de primera plana ──
    urgentes_primera_plana: urgentes.slice(0, 5),
    sismos_locales:         locales.slice(0, 10),
    sismos_cercanos:        cercanos.slice(0, 10),
    sismos_regionales:      regionales.slice(0, 8),
    otros_relevantes:       remotos.filter((e: any) => e.magnitude >= 5.5).slice(0, 5),
    todos_los_eventos:      enriquecidos,
  };
}
