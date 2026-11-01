const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });

function cors(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  if (origin && origin !== allowed) return null;
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type",
    "vary": "Origin",
  };
}

function response(request, env, body, status = 200) {
  const headers = cors(request, env);
  return headers ? json(body, status, headers) : json({ error: "Origin denied" }, 403);
}

function requireEnvironment(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Gateway setup incomplete: ${missing.join(", ")}`);
}

async function supabase(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function requireStaff(request, env) {
  requireEnvironment(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Staff sign-in required");
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: authorization },
  });
  if (!userResponse.ok) throw new Error("Staff sign-in required");
  const user = await userResponse.json();
  const staff = await supabase(env, `/rest/v1/crm_staff?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!staff.ok || !(await staff.json()).length) throw new Error("Staff access required");
  return user;
}

async function graph(env, path, init = {}) {
  requireEnvironment(env, ["WHATSAPP_ACCESS_TOKEN"]);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Meta request timed out"), 15000);
  try {
    return await fetch(`https://graph.facebook.com/v25.0/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Meta request timed out. Please retry.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function syncTemplates(env) {
  requireEnvironment(env, ["WHATSAPP_WABA_ID"]);
  const templates = [];
  let after = "";
  for (let page = 0; page < 20; page += 1) {
    const query = `message_templates?fields=id,name,language,category,status,components&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const meta = await graph(env, `${env.WHATSAPP_WABA_ID}/${query}`);
    const data = await meta.json();
    if (!meta.ok) throw new Error(`Meta template sync failed (code ${data.error?.code || "unknown"})`);
    templates.push(...(data.data || []));
    if (!data.paging?.next) break;
    after = data.paging.cursors?.after;
    if (!after || page === 19) throw new Error("Too many templates; list not refreshed completely");
  }
  if (templates.length) {
    const saved = await supabase(env, "/rest/v1/wa_templates?on_conflict=name,language", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(templates.map((template) => ({
        meta_id: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        components: template.components || [],
        supported: template.name !== "hello_world",
        updated_at: new Date().toISOString(),
      }))),
    });
    if (!saved.ok) throw new Error("Unable to save template statuses");
  }
  return { count: templates.length };
}

async function submitTemplate(env, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) throw new Error("Invalid template");
  requireEnvironment(env, ["WHATSAPP_WABA_ID"]);
  const locked = await supabase(env, `/rest/v1/wa_templates?id=eq.${id}&status=eq.DRAFT`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "SUBMITTING", updated_at: new Date().toISOString() }),
  });
  if (!locked.ok) throw new Error("Cannot reserve draft");
  const template = (await locked.json())[0];
  if (!template) throw new Error("Draft already submitted. Refresh statuses before retrying.");
  try {
    const meta = await graph(env, `${env.WHATSAPP_WABA_ID}/message_templates`, {
      method: "POST",
      body: JSON.stringify({
        name: template.name,
        language: template.language,
        category: template.category,
        components: template.components,
      }),
    });
    const result = await meta.json();
    const state = meta.ok ? result.status || "PENDING" : "DRAFT";
    await supabase(env, `/rest/v1/wa_templates?id=eq.${template.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: state, meta_id: result.id || null, updated_at: new Date().toISOString() }),
    });
    if (!meta.ok) throw new Error(`Meta rejected template submission (code ${result.error?.code || "unknown"}). ${result.error?.error_user_msg || "Check content and account permissions."}`);
    return { status: state };
  } catch (error) {
    await supabase(env, `/rest/v1/wa_templates?id=eq.${template.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "DRAFT", updated_at: new Date().toISOString() }),
    });
    throw error;
  }
}

async function whatsappTemplates(request, env) {
  await requireStaff(request, env);
  const input = await request.json();
  if (input.action === "sync") return syncTemplates(env);
  if (input.action === "submit") return submitTemplate(env, input.id);
  throw new Error("This gateway currently supports template sync and submission only.");
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (!headers) return json({ error: "Origin denied" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname === "/health") return response(request, env, { ok: true, service: "nia-hyderabad-gateway" });
    if (request.method !== "POST") return response(request, env, { error: "POST required" }, 405);
    try {
      if (url.pathname === "/whatsapp/templates") return response(request, env, await whatsappTemplates(request, env));
      return response(request, env, { error: "Not found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gateway request failed";
      const status = /required|access|incomplete/i.test(message) ? 401 : 400;
      return response(request, env, { error: message }, status);
    }
  },
};
