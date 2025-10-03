import React from "react";

/* ---------- 外观：右侧背景图（可选） ---------- */
const SIDE_BG_URL = "/static/global/login-side.jpg"; // 放置于仓库 static/global/ 下；缺失时自动降级为渐变

/* ---------- 工具：读取非 HttpOnly Cookie（如 XSRF-TOKEN 等） ---------- */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + encodeURIComponent(name) + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}

/* ---------- 预取令牌：尽可能多地尝试常见 CSRF/Token 端点 ---------- */
async function discoverToken(): Promise<string | null> {
  const probeUrls = [
    "/api/csrf",
    "/csrf/token",
    "/api/login/token",
    "/api/auth/csrf",
    "/auth/csrf",
    "/api/token",
  ];
  for (const u of probeUrls) {
    try {
      const r = await fetch(u, { credentials: "include", headers: { Accept: "application/json,text/plain;q=0.8,*/*;q=0.5" } });
      if (!r.ok) continue;
      const text = await r.text();
      // 允许纯文本或 JSON
      try {
        const j = JSON.parse(text);
        for (const k of ["token", "csrf_token", "_token", "xsrf", "xsrf_token"]) {
          if (j && typeof j[k] === "string" && j[k]) return j[k];
        }
      } catch {
        if (text && text.length < 256) return text.trim();
      }
    } catch {
      /* ignore */
    }
  }
  // 再尝试从可读 Cookie 取（双提交 Cookie 模式）
  const cookieNames = ["XSRF-TOKEN", "xsrf-token", "csrftoken", "csrf_token", "csrf"];
  for (const c of cookieNames) {
    const v = readCookie(c);
    if (v) return v;
  }
  return null;
}

/* ---------- 实际登录：多方法/多路径 + 自动附带 Token ---------- */
async function loginSmart(username: string, password: string): Promise<Response> {
  // 先尽力获取 Token；失败也不阻断
  const token = await discoverToken();

  // 拼查询串（账号、密码）
  const baseQs = new URLSearchParams({ username, password });

  // 如果拿到 token，把常见字段名都带上（额外参数 FastAPI 会忽略，不会报错）
  const tokenQs = new URLSearchParams();
  if (token) {
    for (const k of ["token", "csrf_token", "_token", "xsrf", "xsrf_token"]) tokenQs.set(k, token);
  }

  const urls = ["/api/login", "/api/auth/login"].map((p) => {
    const q = new URLSearchParams(baseQs);
    for (const [k, v] of tokenQs) q.set(k, v);
    return `${p}?${q.toString()}`;
  });

  // 尝试顺序：POST → GET（对 405 自动回退）；两条路径依次试
  const attempts: { url: string; method: "POST" | "GET" }[] = [];
  for (const u of urls) {
    attempts.push({ url: u, method: "POST" });
    attempts.push({ url: u, method: "GET" });
  }

  let last: Response | null = null;
  for (const a of attempts) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json, text/plain;q=0.8, */*;q=0.5",
        "X-Requested-With": "XMLHttpRequest",
        "Cache-Control": "no-store",
      };
      if (token) headers["X-CSRF-Token"] = token;

      const res = await fetch(a.url, { method: a.method, credentials: "include", headers });
      if (res.ok) return res;

      // 捕捉“无效 Token”等典型情况，继续尝试下一种
      last = res;
      const status = res.status;
      if ([400, 401, 403, 404, 405, 415, 422].includes(status)) continue;
    } catch {
      /* 网络错误，继续下一个尝试 */
    }
  }
  // 返回最后一次响应，供调用者提取错误文本
  if (last) return last;
  throw new Error("登录失败（网络不可达）");
}

export default function AuthLoginPage() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); // 阻止浏览器默认提交
    setLoading(true);
    setError(null);
    try {
      if (!username || !password) throw new Error("请输入用户名与密码");
      const res = await loginSmart(username, password);
      if (!res.ok) {
        let msg = "";
        try { msg = await res.text(); } catch {}
        throw new Error(msg || `登录失败（${res.status}）`);
      }
      // 成功：回首页或由后端重定向
      window.location.assign("/");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-[85%_15%]">
      {/* 左侧 85%：表单区 */}
      <main className="h-full grid place-items-center bg-white">
        <form onSubmit={submit} className="w-[min(92vw,520px)] border rounded-2xl p-8 space-y-5 bg-white shadow-sm">
          <div className="text-2xl font-semibold">登录</div>

          <input
            className="border rounded px-4 py-3 w-full bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black/30"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
          <input
            type="password"
            className="border rounded px-4 py-3 w-full bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black/30"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="text-sm text-red-600 break-all">
              {error.length > 400 ? error.slice(0, 400) + "…" : error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black text-white px-4 py-3 active:scale-[0.99] transition-transform"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
      </main>

      {/* 右侧 15%：背景图（缺图时降级为渐变） */}
      <aside
        aria-hidden
        className="h-full"
        style={{
          backgroundImage: `url('${SIDE_BG_URL}'), linear-gradient(180deg, #e9efff 0%, #f7f7ff 100%)`,
          backgroundSize: "cover, cover",
          backgroundPosition: "center, center",
        }}
      />
    </div>
  );
}
