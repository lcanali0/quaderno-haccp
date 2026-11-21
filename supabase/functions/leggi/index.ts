// Lettura automatica di etichette e fatture con Claude.
// Da incollare in Supabase > Edge Functions con il nome "leggi".
// Serve il segreto ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets).
// Solo chi è nell'elenco "haccp_ammessi" può usarla.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODELLI: Record<string, string> = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5" };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const risposta = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: ok } = await sb.rpc("haccp_ammesso");
  if (!ok) return risposta({ error: "Accesso non abilitato" }, 403);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const body = await req.json().catch(() => ({}));
  if (body.ping) return risposta({ images: !!key });
  if (!key) return risposta({ error: "Lettura automatica non attiva" }, 503);

  const content: unknown[] = (body.images || []).slice(0, 6).map((i: { type: string; data: string }) => ({
    type: "image", source: { type: "base64", media_type: i.type || "image/jpeg", data: i.data },
  }));
  content.push({ type: "text", text: String(body.prompt || "").slice(0, 80000) });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELLI[body.tier] || MODELLI.default,
      max_tokens: 8000,
      system: "Rispondi solo con un oggetto JSON valido, senza testo prima o dopo.",
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) return risposta({ error: "Lettura non riuscita (" + r.status + ")" }, 502);
  const j = await r.json();
  const testo = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const m = testo.match(/\{[\s\S]*\}/);
  try { return risposta({ json: JSON.parse(m ? m[0] : testo) }); }
  catch { return risposta({ error: "Risposta non leggibile" }, 502); }
});
