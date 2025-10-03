import React from "react";

/**
 * 纯净登录页：
 * - 左 75% 居中表单（无卡片），右 25% 纯黑背景
 * - 使用 POST x-www-form-urlencoded 调 /api/login
 * - 成功后跳转首页；失败展示后端错误
 */

async function doLogin(username: string, password: string): Promise<Response> {
  const body = new URLSearchParams({ username, password });
  return fetch("/api/login", {
    method: "POST",
    credentials: "include", // 写入 HttpOnly Cookie
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json, text/plain;q=0.8, */*;q=0.5",
    },
    body,
  });
}

export default function AuthLoginPage() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("请输入用户名与密码");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await doLogin(username, password);
      if (!res.ok) {
        let msg = "";
        try { msg = await res.text(); } catch {}
        throw new Error(msg || `登录失败（${res.status}）`);
      }
      // 登录成功：进入首页
      window.location.assign("/");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-[75%_25%]">
      {/* 左 75%：表单（居中、无卡片） */}
      <main className="flex items-center justify-center">
        <form onSubmit={onSubmit} className="w-[min(92vw,560px)] space-y-6">
          <div className="text-3xl font-bold">登录</div>

          <input
            className="border rounded-lg px-4 py-3 w-full bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black/30"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
          <input
            type="password"
            className="border rounded-lg px-4 py-3 w-full bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black/30"
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

      {/* 右 25%：纯黑背景占位 */}
      <aside aria-hidden className="h-full" style={{ background: "#000" }} />
    </div>
  );
}
