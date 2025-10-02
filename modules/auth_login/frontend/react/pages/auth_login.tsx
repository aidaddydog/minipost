import React from "react";

async function loginWithQuery(username: string, password: string): Promise<Response> {
  // 注意把 # 等字符进行编码
  const qs = new URLSearchParams({ username, password }).toString();
  // 先尝试 /api/login，若 404 再试 /api/auth/login
  const urls = [`/api/login?${qs}`, `/api/auth/login?${qs}`];

  for (const u of urls) {
    try {
      const res = await fetch(u, {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain;q=0.8, */*;q=0.5",
          "X-Requested-With": "XMLHttpRequest",
          "Cache-Control": "no-store",
        },
      });
      if (res.ok) return res;
    } catch {
      // ignore and try next
    }
  }
  // 最后一次再返回（用于错误细节）
  return fetch(urls[0], {
    method: "POST",
    credentials: "include",
  });
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
      const res = await loginWithQuery(username, password);
      if (!res.ok) {
        let text = "";
        try { text = await res.text(); } catch {}
        throw new Error(text || `登录失败（${res.status}）`);
      }
      // 登录成功：跳转首页或后端重定向
      window.location.assign("/");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] grid place-items-center">
      <form onSubmit={submit} className="w-[min(92vw,400px)] border rounded-xl p-6 space-y-4 bg-white">
        <div className="text-lg font-semibold">登录</div>

        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          className="border rounded px-3 py-2 w-full"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button disabled={loading} className="w-full rounded bg-black text-white px-3 py-2">
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
