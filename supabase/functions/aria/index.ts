// ARIA - Asistente IA del CNAT (Centro Nacional de Alerta de Tsunamis)
// Marina de Guerra del Perú — Edge Function (proxy seguro)
// MICROHELP © 2026
//
// Esta función recibe el system prompt y los mensajes desde el frontend,
// les agrega la API key de Anthropic (guardada como secret del servidor)
// y reenvía la petición a Claude. La llave NUNCA viaja al navegador.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Responder al preflight de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // El frontend nos manda el system prompt ya armado y los mensajes
    const { system, messages, max_tokens } = await req.json();

    // La llave vive SOLO en el servidor (secret de Supabase)
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: max_tokens || 2000,
        system: system,
        messages: messages,
      }),
    });

    const data = await response.json();

    // Devolvemos al frontend solo el texto de la respuesta
    const text = data.content?.[0]?.text || JSON.stringify(data);

    return new Response(
      JSON.stringify({ response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en ARIA:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});