import React from "react";

async function tryLogin(url: string, method: "POST" | "GET") {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Accept": "application/json, text/plain;q=0.8, */*;q=0.5",
      "X-Requested-With": "XMLHttpRequest",
      "Cache-Control": "no-store",
    },
  };
  // GET 不要 body；POST 也不需要 body，因为后端从 query 取参
  return fetch(url, init);
}

async function loginSmart(username: string, password: string): Promise<Response> {
  const qs = new URLSearchParams({ username, password }).toString();
  const urls = [`/api/login?${qs}`, `/api/auth/login?${qs}`];

  // 先 POST，再对 405 回退 GET；两条路径都试
  const attempts: { url: string; method: "POST" | "GET" }[] = [];
  for (const u of urls) {
    attempts.push({ url: u, method: "POST" });
    attempts.push({ url: u, method: "GET" });
  }

  let last: Response | null = null;
  for (const a of attempts) {
    try {
      const res = await tryLogin(a.url, a.method);
      if (res.ok) return res;
      last = res;
      // 404 / 405 / 415 / 422 都继续尝试下一种
      if ([404, 405, 415, 422].includes(res.status)) continue;
    } catch {
      // 网络错误，继续下一种
    }
  }
  if (last) return last;
  throw new Error("登录失败（网络错误或接口不可达）");
}

export default function AuthLoginPage() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!username || !password) throw new Error("请输入用户名与密码");
      const res = await loginSmart(username, password);
      if (!res.ok) {
        let text = "";
        try { text = await res.text(); } catch {}
        throw new Error(text || `登录失败（${res.status}）`);
      }
      // 成功：首页
      window.location.assign("/");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100vh] grid place-items-center bg-white">
      <form onSubmit={submit} className="w-[min(92vw,420px)] border rounded-xl p-6 space-y-4 bg-white shadow-sm">
        <div className="text-lg font-semibold">登录</div>

        <input
          className="border rounded px-3 py-2 w-full bg-slate-50"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          className="border rounded px-3 py-2 w-full bg-slate-50"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="text-sm text-red-600 break-all">{error}</div>}

        <button type="submit" disabled={loading} className="w-full rounded bg-black text-white px-3 py-2">
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
