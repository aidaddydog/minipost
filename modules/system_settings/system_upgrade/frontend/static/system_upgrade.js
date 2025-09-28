/* Build: sys-upgrade patched v6 (API_BASE auto + credentials:same-origin) | 2025-09-28 */
(function() {
  'use strict';

  const ROOT = document.getElementById('system-upgrade-app');
  if (!ROOT) {
    console.warn('[SysUpgrade] #system-upgrade-app not found');
    return;
  }

  /* ---------- utils ---------- */
  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function toast(msg) {
    try {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({type:'toast', message:String(msg)}, '*');
      }
    } catch(_) {}
    alert(String(msg));
  }

  /** Detect app base prefix robustly (supports FastAPI root_path / reverse proxies).
   * Priority: window.__APP_BASE__ -> <meta name="app-base"> -> <script src> before '/modules/' -> <base href> -> ''
   */
  function __detectAppBase() {
    try {
      if (window.__APP_BASE__) return window.__APP_BASE__;
      const meta = document.querySelector('meta[name="app-base"]');
      if (meta && meta.content) return meta.content;
      const cur = document.currentScript || (function() {
        const s = document.getElementsByTagName('script');
        return s[s.length-1];
      })();
      if (cur && cur.src) {
        const u = new URL(cur.src, location.href);
        const p = u.pathname || '';
        const idx = p.indexOf('/modules/');
        if (idx > 0) return p.slice(0, idx);
      }
      const baseEl = document.querySelector('base[href]');
      if (baseEl) {
        const u2 = new URL(baseEl.getAttribute('href'), location.href);
        const p2 = u2.pathname || '';
        return p2.endsWith('/') ? p2.slice(0, -1) : p2;
      }
    } catch(e) {}
    return '';
  }
  const APP_BASE = __detectAppBase();
  const API_BASE = APP_BASE + '/api/settings/system_settings/system_upgrade';

  async function jget(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function jpost(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data || {})
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function jdel(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function hideShellMask() {
    try {
      window.parent && window.parent.postMessage && window.parent.postMessage({type:'shell-mask', action:'hide', source:'system_upgrade'}, '*');
    } catch(_) {
      /* ignore */
    }
  }

  /* ---------- state ---------- */
  const state = {
    branches: [],
    current: '',
    branch: '',
    check: null,
    hist: { rows: [], total: 0, page: 1, page_size: 20 },
    checking: false,
    executing: false,
    loadingBranches: false,
    loadingHist: false,
  };

  /* ---------- rendering ---------- */
  function render() {
    ROOT.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label>分支</label>
        <select id="selBranch" class="input">
          ${(() => {
            const brs = state.branches.length ? state.branches : (state.current ? [state.current] : []);
            return (brs||[]).map(b=>`<option value="${h(b)}" ${b===state.branch?'selected':''}>${h(b)}</option>`).join('');
          })()}
        </select>
        <button id="btnCheck" class="btn">${state.checking?'正在检查...':'检查更新'}</button>
        <button id="btnExecute" class="btn btn-primary" ${(state.check && state.check.update_available && !state.executing)?'':'disabled'}>
          ${state.executing?'执行中...':'一键更新'}
        </button>
        <span id="checkSummary" style="margin-left:8px;color:var(--muted-foreground,#666);">
          ${renderSummary()}
        </span>
      </div>

      <div class="table-wrap" style="margin-top:12px;${!state.check || !state.check.changed_files || !state.check.changed_files.length ? 'display:none':''}">
        <table class="table">
          <thead><tr><th style="width:68px">#</th><th>变更文件</th></tr></thead>
          <tbody>
            ${(state.check?.changed_files||[]).map((f,i)=>`<tr><td>${i+1}</td><td><code style="white-space:pre-wrap">${h(f)}</code></td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:20px;display:flex;align-items:center;justify-content:space-between;">
        <h3 style="margin:0;font-size:16px;">历史记录</h3>
        <div class="pager">
          <button id="prevPage" class="btn" ${state.hist.page<=1?'disabled':''}>上一页</button>
          <span style="margin:0 8px;">第 ${state.hist.page} 页 / 共 ${Math.max(1, Math.ceil(state.hist.total/state.hist.page_size))} 页（${state.hist.total} 条）</span>
          <button id="nextPage" class="btn" ${state.hist.page>=Math.ceil(state.hist.total/state.hist.page_size)?'disabled':''}>下一页</button>
        </div>
      </div>

      <div class="table-wrap" style="margin-top:8px;">
        <table class="table">
          <thead>
            <tr>
              <th style="width:210px">时间</th>
              <th style="width:120px">版本</th>
              <th style="width:120px">分支</th>
              <th>文件数</th>
              <th style="width:260px">操作</th>
            </tr>
          </thead>
          <tbody>
            ${state.hist.rows.length ? state.hist.rows.map(r=>`
              <tr>
                <td>${fmt(r.created_at)}</td>
                <td><code>${h(r.version||'')}</code></td>
                <td><code>${h(r.branch||'')}</code></td>
                <td>${(r.files||[]).length}</td>
                <td>
                  <button class="btn btn-sm" data-act="log" data-id="${h(r.id)}">查看日志</button>
                  <button class="btn btn-sm" data-act="rollback" data-id="${h(r.id)}">回滚</button>
                  <button class="btn btn-sm" data-act="delete" data-id="${h(r.id)}">删除</button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--muted-foreground,#666);">暂无记录</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    bindEvents();
  }

  function renderSummary() {
    const c = state.check;
    if (!c) return '尚未检查';
    if (!c.update_available) return `已是最新（版本 ${h(c.version||'')}）`;
    const n = (c.changed_files||[]).length || c.count || 0;
    return `检测到更新（${n} 个文件），版本 ${h(c.version||'')}`;
  }

  function bindEvents() {
    const sel = ROOT.querySelector('#selBranch');
    if (sel) {
      sel.addEventListener('change', () => {
        state.branch = sel.value || state.current || 'main';
        savePref();
      });
    }

    const btnCheck = ROOT.querySelector('#btnCheck');
    if (btnCheck && !state.checking) {
      btnCheck.addEventListener('click', onCheck);
    }

    const btnExec = ROOT.querySelector('#btnExecute');
    if (btnExec && !state.executing && state.check && state.check.update_available) {
      btnExec.addEventListener('click', onExecute);
    }

    const prev = ROOT.querySelector('#prevPage');
    const next = ROOT.querySelector('#nextPage');
    prev && prev.addEventListener('click', async () => {
      if (state.hist.page>1) {
        state.hist.page -= 1;
        await loadHistory();
      }
    });
    next && next.addEventListener('click', async () => {
      const maxp = Math.max(1, Math.ceil(state.hist.total/state.hist.page_size));
      if (state.hist.page < maxp) {
        state.hist.page += 1;
        await loadHistory();
      }
    });

    ROOT.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        try {
          if (act === 'log') {
            const r = await jget(`${API_BASE}/history/${encodeURIComponent(id)}/log`);
            const log = (r && r.data && r.data.log) || '';
            showModal('更新日志', `<pre style="white-space:pre-wrap;max-height:50vh;overflow:auto;padding:12px;">${h(log)}</pre>`);
          } else if (act === 'delete') {
            if (!confirm('确定删除该记录？')) return;
            await jdel(`${API_BASE}/history/${encodeURIComponent(id)}`);
            await loadHistory();
          } else if (act === 'rollback') {
            if (!confirm('确定回滚到该版本吗？')) return;
            const r = await jpost(`${API_BASE}/history/${encodeURIComponent(id)}/rollback`, {});
            if (r && (r.ok || r.data)) {
              toast('回滚请求已提交');
            }
          }
        } catch(err) {
          console.error(err);
          toast('操作失败：' + (err && err.message ? err.message : err));
        }
      });
    });
  }

  function showModal(title, html) {
    // Minimal modal; no dependency on external shell
    let modal = document.getElementById('sysupg-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sysupg-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
      modal.innerHTML = `
        <div style="background:#fff;max-width:720px;width:90%;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.2);">
          <div style="padding:12px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;">
            <strong id="sysupg-modal-title" style="font-size:14px;"></strong>
            <button id="sysupg-modal-close" class="btn">关闭</button>
          </div>
          <div id="sysupg-modal-body" style="padding:12px 16px;max-height:60vh;overflow:auto;"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
      modal.querySelector('#sysupg-modal-close').addEventListener('click', () => modal.remove());
    }
    modal.querySelector('#sysupg-modal-title').textContent = title || '';
    modal.querySelector('#sysupg-modal-body').innerHTML = html || '';
    modal.style.display = 'flex';
  }

  /* ---------- data loaders ---------- */
  async function loadBranches() {
    state.loadingBranches = true; render();
    try {
      const r = await jget(`${API_BASE}/branches`);
      const d = (r && r.data) || r || {};
      state.branches = Array.isArray(d.branches) ? d.branches : [];
      state.current = d.current || (state.branches[0] || 'main');
      state.branch = state.branch || state.current || 'main';
    } catch(err) {
      console.error(err);
      toast('加载分支失败：' + (err && err.message ? err.message : err));
    } finally {
      state.loadingBranches = false; render();
    }
  }

  async function onCheck() {
    state.checking = true; render();
    try {
      const r = await jpost(`${API_BASE}/check`, { branch: state.branch || state.current || 'main' });
      const d = (r && r.data) || r || {};
      state.check = d;
    } catch(err) {
      console.error(err);
      toast('检查失败：' + (err && err.message ? err.message : err));
    } finally {
      state.checking = false; render();
    }
  }

  async function onExecute() {
    if (!state.check || !state.check.update_available) {
      toast('当前无可用更新');
      return;
    }
    if (!confirm('将执行更新（可能会覆盖文件），继续？')) return;
    state.executing = true; render();
    try {
      const r = await jpost(`${API_BASE}/execute`, { branch: state.branch || state.current || 'main', options: { only_changed: true, backup: true } });
      if (r && (r.ok || r.data)) {
        toast('更新已执行');
        state.check = null;
        await loadHistory();
      } else {
        toast('更新执行失败');
      }
    } catch(err) {
      console.error(err);
      toast('执行失败：' + (err && err.message ? err.message : err));
    } finally {
      state.executing = false; render();
    }
  }

  async function loadHistory() {
    state.loadingHist = true; render();
    try {
      const r = await jget(`${API_BASE}/history?page=${state.hist.page}&page_size=${state.hist.page_size}`);
      const d = (r && r.data) || r || {};
      state.hist.rows = Array.isArray(d.rows) ? d.rows : [];
      state.hist.total = d.total || 0;
      state.hist.page = d.page || state.hist.page;
      state.hist.page_size = d.page_size || state.hist.page_size;
    } catch(err) {
      console.error(err);
      toast('加载历史失败：' + (err && err.message ? err.message : err));
      state.hist.rows = []; state.hist.total = 0;
    } finally {
      state.loadingHist = false; render();
    }
  }

  function savePref() {
    try {
      localStorage.setItem('sys_upg_branch', state.branch || '');
    } catch(_) { /* ignore */ }
  }
  function loadPref() {
    try {
      const b = localStorage.getItem('sys_upg_branch');
      if (b) state.branch = b;
    } catch(_) {}
  }

  (async function init() {
    hideShellMask();
    render();
    loadPref();
    await loadBranches();
    await loadHistory();
    render();
  })();
})();
