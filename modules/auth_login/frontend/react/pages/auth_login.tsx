import React from "react";

/**
 * 某些旧后端把带有 AJAX 头或 fetch 的请求判定为需要 CSRF/Token，
 * 所以这里优先用 “浏览器硬跳转 GET” 完成登录，以复刻旧版行为。
 * 成功后服务端会 302 + Set-Cookie，前端再回到首页。
 */

function hardNavigateLogin(qs: string) {
  const candidates = [`/api/login?${qs}`, `/api/auth/login?${qs}`];
  // 直接使用浏览器地址栏跳转（不附加任何自定义头）
  window.location.href = candidates[0];
  // 注意：一旦跳转，后面代码基本不会执行
}

async function softProbeLogin(qs: string): Promise<Response | null> {
  // 仅用于兜底探测（同源时可携带 Cookie）；不加任何额外头
  const candidates = [`/api/login?${qs}`, `/api/auth/login?${qs}`];
  for (const u of candidates) {
    try {
      const r = await fetch(u, {
        method: "GET",
        credentials: "include",
        redirect: "follow",
      });
      if (r.ok || r.redirected) return r;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export default function AuthLoginPage() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("请输入用户名与密码");
      return;
    }
    setError(null);
    setSubmitting(true);

    // 1) 构造查询串（# 等特殊字符会被编码）
    const qs = new URLSearchParams({ username, password }).toString();

    // 2) 优先走“硬跳转 GET 登录”，与旧系统一致（通常会 302 并设置会话）
    try {
      hardNavigateLogin(qs);
      // 通常这里不会再执行；增加兜底：若跳转被阻止（极少见），再软探测一次
      setTimeout(async () => {
        const r = await softProbeLogin(qs);
        if (r && (r.ok || r.redirected)) {
          // 成功：回首页（多数情况下后端会自己重定向，这里是双保险）
          window.location.assign("/");
        } else {
          setSubmitting(false);
          setError("登录失败（接口不可达或被阻止）");
        }
      }, 100);
    } catch (err: any) {
      setSubmitting(false);
      setError(err?.message || "登录失败");
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-[75%_25%]">
      {/* 左 75%：表单区域（居中、无卡片） */}
      <main className="flex items-center justify-center">
        <form onSubmit={onSubmit} className="w-[min(92vw,540px)] space-y-6">
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
            // 仅在“确实进入软探测且未跳转”的情况下才会重新置为 false；
            // 硬跳转会离开页面，按钮禁用与否无所谓
            disabled={submitting}
            className="w-full rounded-lg bg-black text-white px-4 py-3 active:scale-[0.99] transition-transform"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>
      </main>

      {/* 右 25%：黑色占位背景 */}
      <aside aria-hidden className="h-full" style={{ background: "#000" }} />
    </div>
  );
}
