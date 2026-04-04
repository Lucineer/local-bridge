// ═══════════════════════════════════════════════════════════════════════════
// Local Bridge — Ollama/vLLM/LM Studio Tunnel Registration
// Register local models as fleet providers. Route requests through tunnels.
// STRUCTURAL: makes local models first-class fleet citizens.
//
// Superinstance & Lucineer (DiGennaro et al.) — 2026-04-03
// ═══════════════════════════════════════════════════════════════════════════

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:*;";
interface Env { BRIDGE_KV: KVNamespace; }

type LocalProvider = 'ollama' | 'vllm' | 'lmstudio' | 'docker' | 'custom';

interface LocalModel {
  id: string;
  name: string;
  provider: LocalProvider;
  tunnelUrl: string;       // cloudflared/public URL to local model
  localUrl: string;        // localhost URL (for reference)
  model: string;           // model identifier
  contextWindow: number;
  costPerM: number;        // 0 for local
  capabilities: string[];  // chat, completion, embedding, vision
  registeredAt: number;
  lastPing: number | null;
  status: 'online' | 'offline' | 'unknown';
}

const PROVIDER_META: Record<LocalProvider, { name: string; icon: string; defaultPort: number; setupHint: string }> = {
  ollama: { name: 'Ollama', icon: '🦙', defaultPort: 11434, setupHint: 'ollama serve' },
  vllm: { name: 'vLLM', icon: '⚡', defaultPort: 8000, setupHint: 'python -m vllm.entrypoints.openai.api_server --model MODEL' },
  lmstudio: { name: 'LM Studio', icon: '🖥️', defaultPort: 1234, setupHint: 'Start LM Studio → Local Server' },
  docker: { name: 'Docker Container', icon: '🐳', defaultPort: 8080, setupHint: 'docker run -p 8080:8080 MODEL_IMAGE' },
  custom: { name: 'Custom', icon: '🔧', defaultPort: 0, setupHint: 'Any OpenAI-compatible endpoint' },
};

function landingPage(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Local Bridge — Register Local Models</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;background:#0a0a1a;color:#e2e8f0}
.hero{text-align:center;padding:2rem;background:radial-gradient(ellipse at 50% 0%,#0a2e1a 0%,#0a0a1a 70%)}
.hero h1{font-size:2rem;background:linear-gradient(135deg,#10b981,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{color:#64748b;margin:.5rem 0}
.providers{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;padding:2rem;max-width:1000px;margin:0 auto}
.provider{background:#111;border:1px solid #1e293b;border-radius:10px;padding:1rem;text-align:center}
.provider .icon{font-size:2rem;margin-bottom:.5rem}
.provider h4{color:#e2e8f0;margin-bottom:.25rem}
.provider .hint{color:#64748b;font-size:.75rem}
.provider .port{color:#3b82f6;font-size:.8rem;margin-top:.25rem}
.models{padding:2rem;max-width:1000px;margin:0 auto}
.models h2{color:#10b981;margin-bottom:1rem}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem}
.model{background:#111;border:1px solid #1e293b;border-radius:8px;padding:.75rem}
.model h4{font-size:.85rem;color:#e2e8f0}.model .meta{font-size:.75rem;color:#64748b;margin-top:.2rem}
.model .caps{display:flex;gap:.3rem;margin-top:.3rem;flex-wrap:wrap}
.cap{padding:.1rem .3rem;border-radius:6px;font-size:.65rem;background:#10b98122;color:#34d399}
.model.offline{opacity:.5;border-color:#ef444444}
footer{text-align:center;padding:2rem;color:#475569;font-size:.75rem}
</style></head><body>
<div class="hero">
      <img src="https://cocapn-logos.casey-digennaro.workers.dev/img/cocapn-logo-v1.png" alt="Cocapn" style="width:64px;height:auto;margin-bottom:.5rem;border-radius:8px;display:block;margin-left:auto;margin-right:auto">
      <h1>🌉 Local Bridge</h1><p>Register Ollama, vLLM, LM Studio, Docker models as fleet providers</p></div>
<div class="providers">
${Object.entries(PROVIDER_META).map(([k,v])=>`<div class="provider"><div class="icon">${v.icon}</div><h4>${v.name}</h4><div class="hint">${v.setupHint}</div><div class="port">Default port: ${v.defaultPort || 'custom'}</div></div>`).join('')}
</div>
<div class="models"><h2>Registered Models</h2><div class="mgrid" id="models"></div></div>
<footer>Superinstance & Lucineer (DiGennaro et al.) — local models are first-class fleet citizens</footer>
<script>
fetch('/api/models').then(r=>r.json()).then(d=>{
  document.getElementById('models').innerHTML=d.models.map(m=>'<div class="model '+(m.status!=='online'?'offline':'')+'"><h4>'+m.name+'</h4><div class="meta">'+m.provider+' · '+m.model+' · $'+m.costPerM+'/M tokens</div><div class="caps">'+m.capabilities.map(c=>'<span class="cap">'+c+'</span>').join('')+'</div></div>').join('');
}).catch(()=>{});
</script></body></html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const h = { 'Content-Type': 'application/json', 'Content-Security-Policy': CSP };
    const hh = { 'Content-Type': 'text/html;charset=UTF-8', 'Content-Security-Policy': CSP };

    if (url.pathname === '/') return new Response(landingPage(), { headers: hh });
    if (url.pathname === '/health') {
      const count = (await env.BRIDGE_KV.list({ prefix: 'model:', limit: 1 })).keys.length;
      return new Response(JSON.stringify({ status: 'ok', vessel: 'local-bridge', registeredModels: count }), { headers: h });
    }

    // Register a local model
    if (url.pathname === '/api/models' && request.method === 'POST') {
      const body = await request.json() as Partial<LocalModel> & { name: string; provider: LocalProvider; tunnelUrl: string; model: string };
      const model: LocalModel = {
        id: crypto.randomUUID().slice(0, 8),
        name: body.name, provider: body.provider,
        tunnelUrl: body.tunnelUrl, localUrl: body.localUrl || '',
        model: body.model, contextWindow: body.contextWindow || 4096,
        costPerM: 0, capabilities: body.capabilities || ['chat'],
        registeredAt: Date.now(), lastPing: null, status: 'unknown',
      };
      await env.BRIDGE_KV.put(`model:${model.id}`, JSON.stringify(model));
      return new Response(JSON.stringify(model), { headers: h, status: 201 });
    }

    // List models
    if (url.pathname === '/api/models' && request.method === 'GET') {
      const list = await env.BRIDGE_KV.list({ prefix: 'model:', limit: 50 });
      const models: LocalModel[] = [];
      for (const key of list.keys) {
        const model = await env.BRIDGE_KV.get<LocalModel>(key.name, 'json');
        if (model) models.push(model);
      }
      return new Response(JSON.stringify({ count: models.length, models }), { headers: h });
    }

    // Ping a model (health check)
    if (url.pathname === '/api/ping' && request.method === 'POST') {
      const body = await request.json() as { modelId: string };
      const model = await env.BRIDGE_KV.get<LocalModel>(`model:${body.modelId}`, 'json');
      if (!model) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: h });
      try {
        const start = Date.now();
        const resp = await fetch(`${model.tunnelUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
        model.lastPing = Date.now();
        model.status = resp.ok ? 'online' : 'offline';
        await env.BRIDGE_KV.put(`model:${model.id}`, JSON.stringify(model));
        return new Response(JSON.stringify({ modelId: model.id, status: model.status, latencyMs: Date.now() - start }), { headers: h });
      } catch {
        model.lastPing = Date.now();
        model.status = 'offline';
        await env.BRIDGE_KV.put(`model:${model.id}`, JSON.stringify(model));
        return new Response(JSON.stringify({ modelId: model.id, status: 'offline', error: 'unreachable' }), { headers: h });
      }
    }

    // Delete a model
    if (url.pathname.startsWith('/api/models/') && request.method === 'DELETE') {
      const modelId = url.pathname.split('/')[3];
      await env.BRIDGE_KV.delete(`model:${modelId}`);
      return new Response(JSON.stringify({ deleted: true, modelId }), { headers: h });
    }

    // A2A: provider registry for fleet
    if (url.pathname === '/api/a2a/providers') {
      const list = await env.BRIDGE_KV.list({ prefix: 'model:', limit: 50 });
      const models: LocalModel[] = [];
      for (const key of list.keys) {
        const model = await env.BRIDGE_KV.get<LocalModel>(key.name, 'json');
        if (model && model.status === 'online') models.push(model);
      }
      return new Response(JSON.stringify({
        version: '1.0', type: 'structural',
        providers: models.map(m => ({
          id: m.id, name: m.name, provider: m.provider,
          baseUrl: m.tunnelUrl, model: m.model,
          costPerM: 0, capabilities: m.capabilities,
        })),
      }), { headers: h });
    }

    return new Response('Not found', { status: 404 });
  },
};
