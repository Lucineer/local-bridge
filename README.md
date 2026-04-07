# Local Bridge 🛰️

A private bridge to connect your local LLM servers to the Cocapn Fleet. It lets agents discover and use your self-hosted models without routing your data through third-party services.

---

## Try It

A public reference bridge is available: https://the-fleet.casey-digennaro.workers.dev/bridge

You can deploy your own private copy in a few minutes.

## Quick Start

1.  **Fork** this repository. You own and control your copy.
2.  Deploy to Cloudflare Workers: `npx wrangler deploy`
3.  Open your worker's URL, paste your local server's public endpoint into the form.
4.  Your model will appear in fleet provider lists within moments.

---

## How It Works

-   **Direct Connection**: The bridge shares only your server's public endpoint. All inference traffic flows directly from the agent to your server; prompts and responses never pass through the bridge.
-   **Universal Compatibility**: Works with any OpenAI-compatible server (Ollama, vLLM, LM Studio, llama.cpp, etc.).
-   **Zero Tracking**: No accounts, API keys, or mandatory telemetry. The code is the entire system.
-   **Simple & Auditable**: The worker is ~300 lines of plain JavaScript with zero runtime dependencies.

## Details

-   **Tunnel Agnostic**: Use `cloudflared`, ngrok, Tailscale, or a direct public IP.
-   **Respectful Health Checks**: Passive checks only occur when your provider is listed in the fleet. No background polling spam.
-   **Native Discovery**: Registered models appear in Claude Code, the Cocapn UI, and other fleet clients.
-   **Your Rules**: You maintain all access control, rate limits, and model configuration on your server. The bridge does not enforce policies.
-   **Deploy Flexibly**: Run a private bridge for your team or register with the public fleet.

### One Limitation

Your local inference server must be publicly accessible (via a tunnel or IP) for agents on the fleet to reach it. The bridge cannot relay traffic for fully air-gapped machines.

## Architecture

This is a stateless Cloudflare Worker. It stores transient provider metadata (endpoint, model name) in a KV namespace, automatically clearing entries after 15 minutes of inactivity. There is no database, logging, or persistent storage.

## Contributing

This project follows the Cocapn Fleet's fork-first philosophy. Fork it, modify it for your needs, and contribute fixes or improvements upstream via PR when they are stable. Suggestions for better health checks or compatibility are welcome.

---

MIT License · Superinstance & Lucineer (DiGennaro et al.)

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> · 
  <a href="https://cocapn.ai">Cocapn</a>
</div>