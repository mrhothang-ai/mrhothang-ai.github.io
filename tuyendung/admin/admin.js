/* Quan tri tuyen dung IL SUNG TECH – ghi du lieu that vao PocketBase (khong chua mat khau/khoa nao trong code). */
"use strict";
(function () {
  const API = location.hostname.endsWith("github.io") ? "https://pocketbase.il-sungtech.com" : location.pathname.split("/tuyendung")[0];
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rid = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
  const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
  const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, del(k) { try { localStorage.removeItem(k); } catch (_) {} } };
  const fmtDate = (s) => { if (!s) return ""; const d = new Date(String(s).replace(" ", "T")); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const dOnly = (s) => (s ? String(s).slice(0, 10) : "");
  const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const keyify = (s) => slugify(s).replace(/-/g, "_").replace(/^[^a-z]+/, "").slice(0, 30);

  const TYPES = { text: "Văn bản", phone: "Số điện thoại", number: "Số", date: "Ngày tháng", single: "Chọn một đáp án", multi: "Chọn nhiều đáp án", dropdown: "Danh sách thả xuống", file: "Tải ảnh / tệp" };
  const CHOICE = ["single", "multi", "dropdown"];
  const FIELDS = { "": "— Không gắn (chỉ lưu câu trả lời) —", ho_ten: "Họ tên", sdt: "Số điện thoại", nam_sinh: "Năm sinh", dia_chi: "Địa chỉ (ghép các câu)", vi_tri: "Vị trí (bảng ứng viên)", can_ktx: "Cần ký túc xá", can_xe: "Cần xe đưa đón", nguon: "Nguồn biết tin" };
  const MAP_CODES = { vi_tri: [["san_xuat", "Sản xuất"], ["kho", "Kho"], ["chat_luong", "Chất lượng"], ["bat_ky", "Khác / bất kỳ"]], can_ktx: [["true", "Có"], ["false", "Không"]], can_xe: [["true", "Có"], ["false", "Không"]],
    nguon: [["tiktok", "TikTok"], ["zalo", "Zalo"], ["facebook", "Facebook"], ["poster", "Poster"], ["nguoi_quen", "Người quen"], ["khac", "Khác"]] };
  const TT = { moi: "Mới", da_lien_he: "Đã liên hệ", hen_phong_van: "Hẹn phỏng vấn", da_nhan_viec: "Đã nhận việc", khong_phu_hop: "Không phù hợp" };
  const NGUON = { tiktok: "TikTok", zalo: "Zalo", facebook: "Facebook", poster: "Poster", nguoi_quen: "Người quen", khac: "Khác", "": "—" };
  const VT = { san_xuat: "Sản xuất", kho: "Kho", chat_luong: "Chất lượng", bat_ky: "Khác/bất kỳ" };
  const IMG_TYPES = { banner: "Banner chào mừng", nen: "Ảnh nền câu hỏi", logo: "Logo", vi_tri: "Ảnh vị trí / lựa chọn", hoan_thanh: "Ảnh hoàn thành", khac: "Khác" };
  const TABS = [["dash", "📊", "Dashboard"], ["uv", "👥", "Ứng viên"], ["cd", "🗂", "Chiến dịch"], ["nd", "✏️", "Nội dung"], ["anh", "🖼", "Hình ảnh"], ["ch", "❓", "Câu hỏi"], ["lc", "☑️", "Lựa chọn trả lời"], ["xt", "👁", "Xem trước"], ["xb", "🚀", "Xuất bản"], ["tk", "🔑", "Tài khoản"]];
  const NV_TABS = ["dash", "uv"]; // nhan vien tuyen dung chi xem so lieu + xu ly ung vien

  const S = { auth: null, cds: [], cd: null, qs: [], delQ: [], dirtyCd: false, imgs: [], tab: "dash", selQ: null, lcQ: null };

  // ================= API =================
  async function api(path, opts) {
    opts = opts || {};
    const h = Object.assign({}, opts.headers || {});
    if (S.auth) h.Authorization = S.auth.token;
    let body = opts.body;
    if (body && !(body instanceof FormData) && typeof body !== "string") { body = JSON.stringify(body); h["content-type"] = "application/json"; }
    const r = await fetch(API + path, { method: opts.method || "GET", headers: h, body });
    if (r.status === 401 && S.auth) { logout(); throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."); }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const d = j.data && typeof j.data === "object" ? Object.entries(j.data).map(([k, v]) => k + ": " + (v.message || v)).join("; ") : "";
      const e = new Error((j.loi && j.loi.join("\n")) || j.message || "Lỗi " + r.status); e.detail = d; e.loi = j.loi; e.status = r.status; throw e;
    }
    return j;
  }
  const rec = (col, id) => "/api/collections/" + col + "/records" + (id ? "/" + id : "");
  async function listAll(col, filter, sort) {
    const out = []; let page = 1;
    for (;;) {
      const j = await api(rec(col) + "?perPage=200&page=" + page + (filter ? "&filter=" + encodeURIComponent(filter) : "") + (sort ? "&sort=" + sort : ""));
      out.push(...j.items); if (page >= j.totalPages) break; page++;
    }
    return out;
  }
  function toast(t, kind) { const d = document.createElement("div"); d.className = "toast " + (kind || ""); d.textContent = t; $("#toasts").appendChild(d); setTimeout(() => d.remove(), kind === "err" ? 7000 : 3500); }
  const fail = (e) => toast((e.message || "Có lỗi") + (e.detail ? " – " + e.detail : ""), "err");

  // ================= dang nhap =================
  async function login(email, pass) {
    for (const col of ["tuyendung_quantri", "_superusers"]) {
      const r = await fetch(API + "/api/collections/" + col + "/auth-with-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: email, password: pass }) });
      if (r.ok) { const j = await r.json(); return { token: j.token, col, name: (j.record && (j.record.ho_ten || j.record.email)) || email }; }
    }
    throw new Error("Sai email hoặc mật khẩu.");
  }
  function logout() { S.auth = null; LS.del("td_admin_auth"); $("#shell").hidden = true; $("#login").hidden = false; }
  $("#lform").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#lerr").textContent = ""; $("#lbtn").disabled = true;
    try { S.auth = await login($("#lemail").value.trim(), $("#lpass").value); LS.set("td_admin_auth", S.auth); $("#lpass").value = ""; await start(); }
    catch (err) { $("#lerr").textContent = err.message; } finally { $("#lbtn").disabled = false; }
  });
  $("#logout").addEventListener("click", () => { if (dirty() && !confirm("Có thay đổi chưa lưu. Vẫn đăng xuất?")) return; logout(); });

  async function boot() {
    const a = LS.get("td_admin_auth");
    if (!a) { $("#login").hidden = false; return; }
    S.auth = a;
    try { const j = await api("/api/collections/" + a.col + "/auth-refresh", { method: "POST" }); S.auth.token = j.token; LS.set("td_admin_auth", S.auth); await start(); }
    catch (_) { logout(); }
  }
  async function start() {
    const me = await api("/api/tuyendung/admin/toi");
    S.role = me.vai_tro === undefined ? "quan_tri" : me.vai_tro || "nhan_vien"; S.meId = me.id; S.superuser = !!me.superuser; // server cu chua co vai tro -> toan quyen nhu truoc
    const full = S.role === "quan_tri";
    document.body.classList.toggle("nv", !full);
    $("#login").hidden = true; $("#shell").hidden = false; $("#meName").textContent = S.auth.name + (full ? "" : " · Nhân viên");
    $("#tabs").innerHTML = TABS.filter(([k]) => full || NV_TABS.indexOf(k) >= 0).map(([k, i, t]) => `<button type="button" data-t="${k}">${i} ${t}</button>`).join("");
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => tab(b.dataset.t)));
    await loadCds();
    const last = LS.get("td_admin_cd");
    await pickCd(S.cds.find((c) => c.id === last) ? last : (S.cds.find((c) => c.mac_dinh) || S.cds[0] || {}).id);
    const lt = LS.get("td_admin_tab");
    tab(full || NV_TABS.indexOf(lt) >= 0 ? lt || "dash" : "dash");
  }

  // ================= chien dich hien tai =================
  async function loadCds() { S.cds = await listAll("tuyendung_chiendich", "", "-mac_dinh,-created"); renderCdSel(); }
  function renderCdSel() {
    $("#cdSel").innerHTML = S.cds.length ? S.cds.map((c) => `<option value="${c.id}" ${S.cd && S.cd.id === c.id ? "selected" : ""}>${esc(c.ten)}${c.mac_dinh ? " ★" : ""}${c.hoat_dong ? "" : " (tắt)"}</option>`).join("") : `<option value="">(chưa có chiến dịch)</option>`;
  }
  $("#cdSel").addEventListener("change", async (e) => {
    if (dirty() && !confirm("Có thay đổi chưa lưu ở chiến dịch này. Bỏ thay đổi và chuyển?")) { renderCdSel(); return; }
    await pickCd(e.target.value); tab(S.tab);
  });
  async function pickCd(id) {
    S.cd = null; S.qs = []; S.delQ = []; S.dirtyCd = false; S.selQ = null; S.lcQ = null;
    if (!id) { renderCdSel(); pubState(); return; }
    S.cd = await api(rec("tuyendung_chiendich", id));
    S.cd.noi_dung = S.cd.noi_dung || {}; S.cd.giao_dien = S.cd.giao_dien || {};
    S.qs = (await listAll("tuyendung_cauhoi", `chien_dich="${id}"`, "thu_tu,created")).map(normQ);
    LS.set("td_admin_cd", id); renderCdSel(); pubState();
  }
  function normQ(q) { q.lua_chon = q.lua_chon || []; q.dieu_kien = q.dieu_kien || []; q.kiem_tra = q.kiem_tra || {}; q._dirty = false; return q; }
  const dirty = () => !!S.cd && (S.dirtyCd || S.delQ.length > 0 || S.qs.some((q) => q._dirty || q._new));
  const markCd = () => { S.dirtyCd = true; pubState(); };
  const markQ = (q) => { q._dirty = true; pubState(); };
  window.addEventListener("beforeunload", (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

  async function pubState() {
    const p = $("#pubState");
    if (!S.cd || S.role !== "quan_tri") { p.textContent = ""; return; }
    if (dirty()) { p.className = "pill warn"; p.textContent = "● Có thay đổi chưa lưu"; return; }
    if (!S.cd.so_phien_ban) { p.className = "pill off"; p.textContent = "Bản nháp – chưa xuất bản"; return; }
    const changed = await draftChanged();
    p.className = "pill " + (changed ? "warn" : S.cd.hoat_dong ? "ok" : "off");
    p.textContent = changed ? "Đã lưu nháp – chưa xuất bản (v" + S.cd.so_phien_ban + " đang chạy)" : "Đã xuất bản v" + S.cd.so_phien_ban + (S.cd.hoat_dong ? " · đang mở" : " · đang tắt");
  }
  const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, kk) => ((a[kk] = v[kk]), a), {}) : v));
  const norm = (s) => ({ n: s.noi_dung || {}, g: s.giao_dien || {}, q: (s.cau_hoi || []).map((q) => Object.assign({}, q, { lua_chon: (q.lua_chon || []).map((o) => Object.assign({ icon: "", mo_ta: "", ma_goc: "" }, o, { anh: o.anh ? o.anh.id : null })) })) });
  async function draftChanged() {
    try {
      const [d, pv] = await Promise.all([api("/api/tuyendung/admin/xem-truoc/" + S.cd.id), api(rec("tuyendung_phienban", S.cd.phien_ban_id))]);
      S._diff = diffSnap(pv.noi_dung || {}, d);
      return stable(norm(d)) !== stable(norm(pv.noi_dung || {}));
    } catch (_) { return false; }
  }
  function diffSnap(a, b) {
    const out = [], A = {}, B = {};
    (a.cau_hoi || []).forEach((q, i) => (A[q.ma] = [q, i])); (b.cau_hoi || []).forEach((q, i) => (B[q.ma] = [q, i]));
    if (stable(a.noi_dung) !== stable(b.noi_dung)) out.push("Nội dung trang chào / hoàn thành thay đổi");
    if (stable(norm(a).g) !== stable(norm(b).g)) out.push("Giao diện (màu, logo, ảnh) thay đổi");
    for (const k in B) if (!A[k]) out.push("Thêm câu: " + B[k][0].tieu_de);
    for (const k in A) if (!B[k]) out.push("Bỏ câu: " + A[k][0].tieu_de);
    for (const k in B) if (A[k] && stable(norm({ cau_hoi: [A[k][0]] }).q) !== stable(norm({ cau_hoi: [B[k][0]] }).q)) out.push("Sửa câu: " + B[k][0].tieu_de);
    const oa = (a.cau_hoi || []).map((q) => q.ma).filter((m) => B[m]).join(), ob = (b.cau_hoi || []).map((q) => q.ma).filter((m) => A[m]).join();
    if (oa !== ob) out.push("Đổi thứ tự câu hỏi");
    return out;
  }

  // ================= luu nhap =================
  async function saveDraft(quiet) {
    if (!S.cd) return;
    const b = $("#bSave"); b.disabled = true;
    try {
      if (S.dirtyCd) {
        const c = await api(rec("tuyendung_chiendich", S.cd.id), { method: "PATCH", body: { ten: S.cd.ten, noi_dung: S.cd.noi_dung, giao_dien: S.cd.giao_dien } });
        Object.assign(S.cd, { updated: c.updated }); S.dirtyCd = false;
      }
      for (const id of S.delQ.slice()) { await api(rec("tuyendung_cauhoi", id), { method: "DELETE" }).catch((e) => { if (e.status !== 404) throw e; }); S.delQ.splice(S.delQ.indexOf(id), 1); }
      for (let i = 0; i < S.qs.length; i++) {
        const q = S.qs[i], want = (i + 1) * 10;
        if (q.thu_tu !== want) { q.thu_tu = want; q._dirty = true; }
        if (!q._new && !q._dirty) continue;
        const body = { chien_dich: S.cd.id, ma: q.ma, thu_tu: q.thu_tu, loai: q.loai, tieu_de: q.tieu_de, mo_ta: q.mo_ta || "", goi_y: q.goi_y || "", bat_buoc: !!q.bat_buoc, an: !!q.an, truong: q.truong || "", lua_chon: CHOICE.indexOf(q.loai) >= 0 ? q.lua_chon : [], dieu_kien: q.dieu_kien, kiem_tra: q.kiem_tra };
        try {
          const r = q._new ? await api(rec("tuyendung_cauhoi"), { method: "POST", body }) : await api(rec("tuyendung_cauhoi", q.id), { method: "PATCH", body });
          const sel = S.selQ === q.id; Object.assign(q, normQ(r)); delete q._new; if (sel) S.selQ = q.id;
        } catch (e) { e.message = "Câu \"" + q.tieu_de + "\": " + e.message; throw e; }
      }
      if (!quiet) toast("Đã lưu nháp. Ứng viên vẫn thấy bản đã xuất bản cho tới khi bấm Xuất bản.", "ok");
      return true;
    } catch (e) { fail(e); return false; }
    finally { b.disabled = false; pubState(); }
  }
  $("#bSave").addEventListener("click", () => saveDraft().then(() => tab(S.tab)));
  $("#bPrev").addEventListener("click", async () => { if (dirty() && !(await saveDraft(true))) return; tab("xt"); });
  $("#bPub").addEventListener("click", () => tab("xb"));

  // ================= tab =================
  function tab(t) {
    if (S.role !== "quan_tri" && NV_TABS.indexOf(t) < 0) t = "dash";
    S.tab = t; LS.set("td_admin_tab", t);
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    const v = $("#view"); v.innerHTML = "";
    const needCd = ["nd", "ch", "lc", "xt", "xb"];
    if (needCd.indexOf(t) >= 0 && !S.cd) { v.innerHTML = `<div class="card empty">Chưa có chiến dịch. Vào <b>Chiến dịch</b> để tạo mới.</div>`; return; }
    ({ dash: vDash, uv: vUv, cd: vCd, nd: vNd, anh: vAnh, ch: vCh, lc: vLc, xt: vXt, xb: vXb, tk: vTk })[t](v);
  }

  // ================= DASHBOARD =================
  async function vDash(v) {
    const st = LS.get("td_admin_dash") || { days: 30, all: false };
    v.innerHTML = `<div class="h"><h2>Dashboard</h2>
      <select id="dDays" style="width:auto">${[7, 30, 90, 365].map((d) => `<option value="${d}" ${st.days === d ? "selected" : ""}>${d} ngày gần nhất</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" id="dAll" ${st.all ? "checked" : ""}> Tất cả chiến dịch</label></div><div id="dBody"><div class="card empty">Đang tải…</div></div>`;
    const go = async () => {
      const days = +$("#dDays").value, all = $("#dAll").checked; LS.set("td_admin_dash", { days, all });
      const tu = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      try { const d = await api(`/api/tuyendung/admin/thong-ke?tu=${tu}${!all && S.cd ? "&cd=" + S.cd.id : ""}`); dashBody(d, days); } catch (e) { fail(e); }
    };
    $("#dDays").addEventListener("change", go); $("#dAll").addEventListener("change", go); go();
  }
  function bars(rows, opts) {
    opts = opts || {};
    const max = Math.max(1, ...rows.map((r) => r.n));
    if (!rows.length) return `<div class="empty">Chưa có dữ liệu</div>`;
    return `<div class="bars">${rows.map((r) => `<div class="br" title="${esc(r.k)}: ${r.n}"><span class="lb">${esc(r.label || r.k || "—")}</span><span class="tr"><i style="width:${(r.n / max) * 100}%"></i></span><span class="v">${r.n}${r.sub ? ` <small>${esc(r.sub)}</small>` : ""}</span></div>`).join("")}</div>`;
  }
  function dashBody(d, days) {
    const s = d.su_kien, pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "–");
    const steps = d.buoc || [];
    const fun = steps.map((x, i) => { const prev = i ? steps[i - 1].so : s.bat_dau; return { k: x.tieu_de, label: (i + 1) + ". " + x.tieu_de + (x.dieu_kien ? " (có điều kiện)" : ""), n: x.so, sub: pct(x.so, s.bat_dau) + (i && !x.dieu_kien && prev > x.so ? " · rời " + (prev - x.so) : "") }; });
    fun.push({ k: "Kiểm tra", label: "✓ Màn hình kiểm tra", n: (s.buoc || {})._kiem_tra || 0, sub: pct((s.buoc || {})._kiem_tra || 0, s.bat_dau) });
    fun.push({ k: "Hoàn thành", label: "🎉 Hoàn thành", n: s.hoan_thanh, sub: pct(s.hoan_thanh, s.bat_dau) });
    // day series day du
    const map = {}; d.theo_ngay.forEach((r) => (map[r.k] = r.n));
    const ser = []; for (let i = days - 1; i >= 0 && ser.length < 90; i--) { const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); ser.push({ k, n: map[k] || 0 }); }
    const mx = Math.max(1, ...ser.map((x) => x.n));
    $("#dBody").innerHTML = `
      <div class="kpis">
        <div class="kpi"><small>Lượt mở trang</small><b>${s.xem}</b><span>người xem (ẩn danh)</span></div>
        <div class="kpi"><small>Bắt đầu đăng ký</small><b>${s.bat_dau}</b><span>${pct(s.bat_dau, s.xem)} số lượt mở</span></div>
        <div class="kpi"><small>Hoàn thành</small><b>${s.hoan_thanh}</b><span>${pct(s.hoan_thanh, s.bat_dau)} người bắt đầu</span></div>
        <div class="kpi"><small>Hồ sơ mới</small><b>${d.ho_so}</b><span>lưu vào hệ thống</span></div>
        <div class="kpi"><small>Gửi lỗi</small><b>${s.loi_gui}</b><span>mất mạng / lỗi máy chủ</span></div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Tỷ lệ đi tiếp từng bước <span class="mut small">(% so với người bắt đầu)</span></h3>${s.bat_dau ? bars(fun) : `<div class="empty">Chưa có lượt đăng ký trong khoảng này</div>`}</div>
        <div class="card"><h3>Hồ sơ theo ngày</h3><div class="cols" role="img" aria-label="Số hồ sơ theo ngày">${ser.map((x) => `<div style="height:${(x.n / mx) * 100}%" title="${x.k.split("-").reverse().join("/")}: ${x.n} hồ sơ"></div>`).join("")}</div>
          <div class="xax"><span>${ser[0].k.split("-").reverse().join("/")}</span><span>${ser[ser.length - 1].k.split("-").reverse().join("/")}</span></div>
          <h3 style="margin-top:18px">Theo vị trí ứng tuyển</h3>${bars(d.theo_vi_tri.length ? d.theo_vi_tri : d.theo_vi_tri_goc.map((r) => ({ k: r.k, label: VT[r.k] || r.k, n: r.n })))}</div>
        <div class="card"><h3>Theo nguồn biết tin</h3>${bars(d.theo_nguon.map((r) => ({ k: r.k, label: NGUON[r.k] || r.k, n: r.n })))}</div>
        <div class="card"><h3>Theo trạng thái xử lý</h3>${bars(d.theo_trang_thai.map((r) => ({ k: r.k, label: TT[r.k] || r.k, n: r.n })))}</div>
      </div>
      <p class="mut small">Số liệu lượt mở / bắt đầu / từng bước là ẩn danh (không lưu tên, số điện thoại hay IP). Khoảng: ${d.tu.split("-").reverse().join("/")} – ${d.den.split("-").reverse().join("/")}.</p>`;
  }

  // ================= UNG VIEN =================
  function vUv(v) {
    const f = LS.get("td_admin_uvf") || {};
    v.innerHTML = `<div class="h"><h2>Ứng viên</h2><button class="b" id="uExp" type="button">⬇ Xuất Excel (CSV)</button></div>
      <div class="card"><div class="grid g4">
        <label>Tìm (tên, SĐT, mã, địa chỉ)<input id="fQ" value="${esc(f.q || "")}"></label>
        <label>Trạng thái<select id="fTT"><option value="">Tất cả</option>${Object.entries(TT).map(([k, t]) => `<option value="${k}" ${f.tt === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Nguồn<select id="fNg"><option value="">Tất cả</option>${Object.entries(NGUON).filter(([k]) => k).map(([k, t]) => `<option value="${k}" ${f.ng === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Chiến dịch<select id="fCd"><option value="">Tất cả (kể cả hồ sơ cũ)</option>${S.cds.map((c) => `<option value="${c.id}" ${f.cd === c.id ? "selected" : ""}>${esc(c.ten)}</option>`).join("")}</select></label>
        <label>Từ ngày<input type="date" id="fTu" value="${esc(f.tu || "")}"></label>
        <label>Đến ngày<input type="date" id="fDen" value="${esc(f.den || "")}"></label>
      </div></div><div id="uBody"></div>`;
    let page = 1;
    const qs = () => { const o = { q: $("#fQ").value.trim(), tt: $("#fTT").value, ng: $("#fNg").value, cd: $("#fCd").value, tu: $("#fTu").value, den: $("#fDen").value }; LS.set("td_admin_uvf", o);
      return `q=${encodeURIComponent(o.q)}&trang_thai=${o.tt}&nguon=${o.ng}&cd=${o.cd}&tu=${o.tu}&den=${o.den}`; };
    const load = async () => {
      try { const d = await api(`/api/tuyendung/admin/ung-vien?${qs()}&per=50&page=${page}`); uvTable(d, (p) => { page = p; load(); }); } catch (e) { fail(e); }
    };
    let t; $$("#fQ").forEach((i) => i.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { page = 1; load(); }, 350); }));
    ["#fTT", "#fNg", "#fCd", "#fTu", "#fDen"].forEach((s) => $(s).addEventListener("change", () => { page = 1; load(); }));
    $("#uExp").addEventListener("click", async () => {
      try {
        const d = await api(`/api/tuyendung/admin/ung-vien?${qs()}&per=5000&page=1`);
        const keys = []; d.rows.forEach((r) => ((r.chi_tiet || {}).nhan || []).forEach((x) => { if (!keys.find((k) => k.ma === x.ma)) keys.push({ ma: x.ma, t: x.tieu_de }); }));
        const head = ["Ngày đăng ký", "Mã", "Họ tên", "SĐT", "Năm sinh", "Địa chỉ", "Vị trí", "KTX", "Xe", "Nguồn", "Trạng thái", "Ghi chú", "Chiến dịch", ...keys.map((k) => k.t)];
        const lines = d.rows.map((r) => { const n = {}; ((r.chi_tiet || {}).nhan || []).forEach((x) => (n[x.ma] = x.gia_tri));
          return [fmtDate(r.created), r.ma_dang_ky, r.ho_ten, "'" + r.sdt, r.nam_sinh, r.dia_chi, VT[r.vi_tri] || r.vi_tri, r.can_ktx ? "Có" : "Không", r.can_xe ? "Có" : "Không", NGUON[r.nguon] || r.nguon, TT[r.trang_thai] || r.trang_thai, r.ghi_chu, (r.chi_tiet || {}).ten_chien_dich || "", ...keys.map((k) => n[k.ma] || "")]; });
        const csv = "﻿" + [head, ...lines].map((row) => row.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(",")).join("\r\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "ung-vien-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
        toast("Đã xuất " + d.rows.length + " hồ sơ", "ok");
      } catch (e) { fail(e); }
    });
    load();
  }
  let fileTok = { t: "", at: 0 };
  async function fileToken() { if (Date.now() - fileTok.at < 100000) return fileTok.t; const j = await api("/api/files/token", { method: "POST" }); fileTok = { t: j.token, at: Date.now() }; return j.token; }
  function uvTable(d, goPage) {
    const b = $("#uBody");
    if (!d.rows.length) { b.innerHTML = `<div class="card empty">Không có hồ sơ phù hợp.</div>`; return; }
    const vt = (r) => { const n = ((r.chi_tiet || {}).nhan || []).find((x) => x.ma === "vi_tri"); return n ? n.gia_tri : VT[r.vi_tri] || r.vi_tri; };
    b.innerHTML = `<div class="tblw"><table class="tbl"><thead><tr><th>Ngày</th><th>Họ tên</th><th>SĐT</th><th>Vị trí</th><th>Nguồn</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr data-id="${r.id}"><td>${fmtDate(r.created)}<div class="mut small">${esc(r.ma_dang_ky)}</div></td><td><b>${esc(r.ho_ten)}</b>${r.nam_sinh ? `<div class="mut small">${r.nam_sinh}</div>` : ""}</td>
        <td><a href="tel:${esc(r.sdt)}">${esc(r.sdt)}</a></td><td>${esc(vt(r))}</td><td>${esc(NGUON[r.nguon] || r.nguon)}</td>
        <td><select data-tt>${Object.entries(TT).map(([k, t]) => `<option value="${k}" ${r.trang_thai === k ? "selected" : ""}>${t}</option>`).join("")}</select></td>
        <td><button class="b sm" data-det type="button">Chi tiết</button></td></tr>`).join("")}</tbody></table></div>
      <div class="row" style="margin-top:10px"><span class="mut">Tổng ${d.total} hồ sơ · trang ${d.page}/${Math.max(1, Math.ceil(d.total / d.per))}</span>
      <button class="b sm" id="pPrev" ${d.page <= 1 ? "disabled" : ""}>‹ Trước</button><button class="b sm" id="pNext" ${d.page * d.per >= d.total ? "disabled" : ""}>Sau ›</button></div>`;
    $("#pPrev").addEventListener("click", () => goPage(d.page - 1)); $("#pNext").addEventListener("click", () => goPage(d.page + 1));
    $$("tr[data-id]", b).forEach((tr) => {
      const r = d.rows.find((x) => x.id === tr.dataset.id);
      $("[data-tt]", tr).addEventListener("change", async (e) => { try { await api("/api/tuyendung/admin/ung-vien/" + r.id, { method: "PATCH", body: { trang_thai: e.target.value } }); r.trang_thai = e.target.value; toast("Đã cập nhật trạng thái", "ok"); } catch (er) { fail(er); } });
      $("[data-det]", tr).addEventListener("click", async () => {
        const nx = tr.nextElementSibling; if (nx && nx.classList.contains("det")) { nx.remove(); return; }
        const c = r.chi_tiet;
        let files = "";
        if (c && c.tep && c.tep.length) { try { const t = await fileToken(); files = c.tep.map((f) => `<a class="b sm" target="_blank" rel="noopener" href="${API}/api/files/tuyendung_traloi/${c.id}/${encodeURIComponent(f)}?token=${t}">📎 ${esc(f)}</a>`).join(" "); } catch (_) {} }
        const row = document.createElement("tr"); row.className = "det";
        row.innerHTML = `<td colspan="7"><div class="grid g2"><div class="kv">
          ${c ? c.nhan.map((x) => `<span>${esc(x.tieu_de)}</span><b>${esc(x.gia_tri)}</b>`).join("") : `<span>Địa chỉ</span><b>${esc(r.dia_chi || "—")}</b><span>Vị trí</span><b>${esc(VT[r.vi_tri] || "")}</b><span>KTX / Xe</span><b>${r.can_ktx ? "Có" : "Không"} / ${r.can_xe ? "Có" : "Không"}</b>`}
          <span>Chiến dịch</span><b>${esc(c ? c.ten_chien_dich + " (v" + c.so_phien_ban + ")" : "Form cũ")}</b></div>
          <div><label>Ghi chú tuyển dụng<textarea data-gc>${esc(r.ghi_chu)}</textarea></label><div class="row" style="margin-top:8px"><button class="b sm pri" data-sgc type="button">Lưu ghi chú</button>${files}</div></div></div></td>`;
        tr.after(row);
        $("[data-sgc]", row).addEventListener("click", async () => { try { const g = $("[data-gc]", row).value; await api("/api/tuyendung/admin/ung-vien/" + r.id, { method: "PATCH", body: { ghi_chu: g } }); r.ghi_chu = g; toast("Đã lưu ghi chú", "ok"); } catch (e) { fail(e); } });
      });
    });
  }

  // ================= CHIEN DICH =================
  function formUrl(c) { const base = location.origin + location.pathname.replace(/admin\/?(index\.html)?$/, ""); return base + (c.mac_dinh ? "" : "?c=" + encodeURIComponent(c.slug)); }
  function vCd(v) {
    v.innerHTML = `<div class="h"><h2>Chiến dịch tuyển dụng</h2><button class="b pri" id="cNew" type="button">＋ Tạo chiến dịch</button></div>
      <p class="mut">Ứng viên chỉ thấy chiến dịch đang <b>Hoạt động</b>, trong khoảng ngày, và <b>đã xuất bản</b>. Link/QR cũ (không có <code>?c=</code>) mở chiến dịch <b>★ Mặc định</b>.</p>
      ${S.cds.map((c) => `<div class="card" data-id="${c.id}"><div class="grid g4">
        <label>Tên chiến dịch<input data-f="ten" value="${esc(c.ten)}"></label>
        <label>Mã đường dẫn (slug)<input data-f="slug" value="${esc(c.slug)}" pattern="[a-z0-9-]+"></label>
        <label>Ngày bắt đầu<input type="date" data-f="ngay_bat_dau" value="${dOnly(c.ngay_bat_dau)}"></label>
        <label>Ngày kết thúc<input type="date" data-f="ngay_ket_thuc" value="${dOnly(c.ngay_ket_thuc)}"></label></div>
        <div class="row" style="margin-top:12px">
          <label class="chk"><input type="checkbox" data-f="hoat_dong" ${c.hoat_dong ? "checked" : ""}> Hoạt động</label>
          <label class="chk"><input type="radio" name="md" data-f="mac_dinh" ${c.mac_dinh ? "checked" : ""}> ★ Mặc định</label>
          <span class="pill ${c.so_phien_ban ? "ok" : "off"}">${c.so_phien_ban ? "Đã xuất bản v" + c.so_phien_ban + " · " + fmtDate(c.xuat_ban_luc) : "Chưa xuất bản"}</span>
          <span style="flex:1"></span>
          <button class="b sm" data-a="save" type="button">Lưu</button>
          <button class="b sm" data-a="edit" type="button">Sửa nội dung & câu hỏi</button>
          <button class="b sm" data-a="copy" type="button">⧉ Nhân bản</button>
          <button class="b sm" data-a="link" type="button">🔗 Copy link</button>
          <button class="b sm dan" data-a="del" type="button">Xoá</button>
        </div></div>`).join("") || `<div class="card empty">Chưa có chiến dịch.</div>`}`;
    $("#cNew").addEventListener("click", newCd);
    $$(".card[data-id]", v).forEach((card) => {
      const c = S.cds.find((x) => x.id === card.dataset.id);
      const get = () => { const o = {}; $$("[data-f]", card).forEach((i) => { const f = i.dataset.f; o[f] = i.type === "checkbox" || i.type === "radio" ? i.checked : i.type === "date" ? (i.value ? i.value + " 00:00:00.000Z" : "") : i.value.trim(); }); return o; };
      card.addEventListener("click", async (e) => {
        const a = e.target.dataset && e.target.dataset.a; if (!a) return;
        try {
          if (a === "save") { const o = get(); if (!/^[a-z0-9-]+$/.test(o.slug)) throw new Error("Slug chỉ gồm chữ thường không dấu, số, dấu gạch ngang"); await api(rec("tuyendung_chiendich", c.id), { method: "PATCH", body: o }); toast("Đã lưu chiến dịch (có hiệu lực ngay)", "ok"); await loadCds(); if (S.cd && S.cd.id === c.id) Object.assign(S.cd, o, { noi_dung: S.cd.noi_dung, giao_dien: S.cd.giao_dien }); pubState(); vCd(v); }
          if (a === "edit") { if (S.cd && S.cd.id !== c.id && dirty() && !confirm("Bỏ thay đổi chưa lưu?")) return; await pickCd(c.id); tab("nd"); }
          if (a === "copy") { const r = await api("/api/tuyendung/admin/nhan-ban/" + c.id, { method: "POST" }); toast("Đã nhân bản. Bản sao đang tắt – sửa rồi xuất bản khi sẵn sàng.", "ok"); await loadCds(); await pickCd(r.id); vCd(v); }
          if (a === "link") { const u = formUrl(c); await navigator.clipboard.writeText(u).catch(() => {}); toast("Link: " + u); }
          if (a === "del") { if (!confirm("Xoá chiến dịch \"" + c.ten + "\" và toàn bộ câu hỏi của nó? (Không xoá được nếu đã có hồ sơ)")) return; await api(rec("tuyendung_chiendich", c.id), { method: "DELETE" }); toast("Đã xoá", "ok"); await loadCds(); if (S.cd && S.cd.id === c.id) await pickCd((S.cds[0] || {}).id); vCd(v); }
        } catch (er) { fail(er); }
      });
    });
  }
  async function newCd() {
    const ten = prompt("Tên chiến dịch mới:", "Tuyển dụng " + new Date().toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" }));
    if (!ten) return;
    try {
      let slug = slugify(ten) || "chien-dich"; while (S.cds.some((c) => c.slug === slug)) slug += "-" + rid(3);
      const base = S.cd ? clone(S.cd.noi_dung) : {};
      const c = await api(rec("tuyendung_chiendich"), { method: "POST", body: { ten, slug, hoat_dong: false, mac_dinh: false, noi_dung: base, giao_dien: S.cd ? clone(S.cd.giao_dien) : { mau_chinh: "#0b2f6b", mau_nhan: "#1d6fe0" }, so_phien_ban: 0 } });
      // 2 cau bat buoc toi thieu
      await api(rec("tuyendung_cauhoi"), { method: "POST", body: { chien_dich: c.id, ma: "ho_ten", thu_tu: 10, loai: "text", tieu_de: "Họ và tên của bạn?", bat_buoc: true, truong: "ho_ten", lua_chon: [], dieu_kien: [], kiem_tra: { max_dai: 80 } } });
      await api(rec("tuyendung_cauhoi"), { method: "POST", body: { chien_dich: c.id, ma: "sdt", thu_tu: 20, loai: "phone", tieu_de: "Số điện thoại liên hệ?", bat_buoc: true, truong: "sdt", lua_chon: [], dieu_kien: [], kiem_tra: {} } });
      await loadCds(); await pickCd(c.id); toast("Đã tạo chiến dịch (đang tắt). Thêm câu hỏi rồi Xuất bản.", "ok"); tab("ch");
    } catch (e) { fail(e); }
  }

  // ================= NOI DUNG =================
  function listEditor(arr, fields, onChange) {
    // fields: [{k, ph, w}] ; arr: list of strings (fields null) or objects
    const box = document.createElement("div"); box.className = "le";
    const draw = () => {
      box.innerHTML = arr.map((it, i) => `<div class="li" data-i="${i}"><div style="grid-template-columns:${fields ? fields.map((f) => f.w || "1fr").join(" ") : "1fr"}">${fields ? fields.map((f) => `<input data-k="${f.k}" placeholder="${esc(f.ph)}" value="${esc(it[f.k] || "")}">`).join("") : `<input data-k="" value="${esc(it)}">`}</div>
        <div class="tools"><button type="button" data-m="-1" title="Lên">↑</button><button type="button" data-m="1" title="Xuống">↓</button><button type="button" data-x title="Xoá">✕</button></div></div>`).join("") + `<button type="button" class="b sm" data-add style="justify-self:start">＋ Thêm dòng</button>`;
      $$(".li", box).forEach((li) => { const i = +li.dataset.i;
        $$("input", li).forEach((inp) => inp.addEventListener("input", () => { if (fields) arr[i][inp.dataset.k] = inp.value; else arr[i] = inp.value; onChange(); }));
        $$("[data-m]", li).forEach((b) => b.addEventListener("click", () => { const j = i + +b.dataset.m; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; onChange(); draw(); }));
        $("[data-x]", li).addEventListener("click", () => { arr.splice(i, 1); onChange(); draw(); });
      });
      $("[data-add]", box).addEventListener("click", () => { arr.push(fields ? fields.reduce((o, f) => ((o[f.k] = ""), o), {}) : ""); onChange(); draw(); const ins = $$("input", box); ins[ins.length - (fields ? fields.length : 1)].focus(); });
    };
    draw(); return box;
  }
  function vNd(v) {
    const N = S.cd.noi_dung, G = S.cd.giao_dien;
    N.khau_hieu = N.khau_hieu || []; N.diem_nhan = N.diem_nhan || []; N.quyen_loi = N.quyen_loi || []; N.hoan_thanh = N.hoan_thanh || { tieu_de: "", dong: [] }; N.hoan_thanh.dong = N.hoan_thanh.dong || []; N.mxh = N.mxh || {};
    v.innerHTML = `<div class="h"><h2>Nội dung & giao diện</h2><span class="mut">Sửa xong bấm <b>Lưu nháp</b> → <b>Xem trước</b> → <b>Xuất bản</b>.</span></div>
      <div class="card"><h3>Màn hình chào mừng</h3><div class="grid g2">
        <label>Tên thương hiệu<input data-n="thuong_hieu"></label><label>Tiêu đề chào mừng<input data-n="tieu_de"></label>
        <label>Thông điệp tuyển dụng<input data-n="thong_diep"></label><label>Chữ trên nút bắt đầu<input data-n="nut_bat_dau"></label>
        <label>Dòng chú thích dưới nút<input data-n="chu_thich"></label><label>Giới thiệu ngắn (không bắt buộc)<textarea data-n="gioi_thieu"></textarea></label>
      </div>
      <div class="grid g2" style="margin-top:12px"><div><label>Khẩu hiệu (mỗi dòng một câu)</label><div id="eKh"></div></div><div><label>Điểm nổi bật (dấu ✓)</label><div id="eDn"></div></div></div></div>
      <div class="card"><h3>Quyền lợi (nút “Xem quyền lợi”)</h3><div id="eQl"></div></div>
      <div class="card"><h3>Màn hình hoàn thành & liên hệ</h3><div class="grid g2">
        <label>Tiêu đề hoàn thành<input data-h="tieu_de"></label><label>Hotline<input data-n="hotline"></label>
        <label>Địa chỉ công ty<input data-n="dia_chi"></label><label>Câu đồng ý (bước kiểm tra)<textarea data-n="dong_y"></textarea></label>
        <label>Zalo<input data-m="zalo"></label><label>Facebook<input data-m="facebook"></label><label>TikTok<input data-m="tiktok"></label></div>
        <div style="margin-top:12px"><label>Lời nhắn hoàn thành (mỗi dòng)</label><div id="eHt"></div></div></div>
      <div class="card"><h3>Giao diện</h3><div class="grid g4">
        <label>Màu chủ đạo (navy)<div class="row" style="margin-top:5px"><input type="color" data-g="mau_chinh"><input data-g2="mau_chinh" style="width:110px"></div></label>
        <label>Màu nhấn (xanh dương)<div class="row" style="margin-top:5px"><input type="color" data-g="mau_nhan"><input data-g2="mau_nhan" style="width:110px"></div></label>
        <label class="chk" style="align-self:end;min-height:38px"><input type="checkbox" id="anLogo"> Ẩn logo (chỉ hiện tên thương hiệu)</label></div>
        <div class="grid g2" style="margin-top:14px">${[["logo", "Logo (thay chữ trên thanh đầu)"], ["banner", "Ảnh banner chào mừng (toàn màn hình)"], ["nen", "Ảnh nền câu hỏi (mờ)"], ["hoan_thanh", "Ảnh màn hình hoàn thành"]].map(([k, t]) => `<div><label>${t}</label><div class="slot" style="margin-top:6px"><div class="pv" data-pv="${k}"></div><div class="row"><button class="b sm" type="button" data-pick="${k}">Chọn ảnh</button><button class="b sm dan" type="button" data-clr="${k}">Gỡ</button></div></div></div>`).join("")}</div></div>`;
    $$("[data-n]", v).forEach((i) => { i.value = N[i.dataset.n] || ""; i.addEventListener("input", () => { N[i.dataset.n] = i.value; markCd(); }); });
    $$("[data-h]", v).forEach((i) => { i.value = N.hoan_thanh[i.dataset.h] || ""; i.addEventListener("input", () => { N.hoan_thanh[i.dataset.h] = i.value; markCd(); }); });
    $$("[data-m]", v).forEach((i) => { i.value = N.mxh[i.dataset.m] || ""; i.addEventListener("input", () => { N.mxh[i.dataset.m] = i.value.trim(); markCd(); }); });
    $$("[data-g]", v).forEach((i) => { const k = i.dataset.g, t = $(`[data-g2="${k}"]`, v); i.value = t.value = G[k] || "#0b2f6b";
      i.addEventListener("input", () => { G[k] = t.value = i.value; markCd(); }); t.addEventListener("input", () => { if (/^#[0-9a-f]{6}$/i.test(t.value)) { G[k] = i.value = t.value; markCd(); } }); });
    $("#anLogo").checked = !!N.an_logo;
    $("#anLogo").addEventListener("change", (e) => { N.an_logo = e.target.checked; markCd(); });
    $("#eKh").appendChild(listEditor(N.khau_hieu, null, markCd));
    $("#eDn").appendChild(listEditor(N.diem_nhan, null, markCd));
    $("#eQl").appendChild(listEditor(N.quyen_loi, [{ k: "icon", ph: "Biểu tượng", w: "70px" }, { k: "tieu_de", ph: "Tiêu đề" }, { k: "mo_ta", ph: "Mô tả" }], markCd));
    $("#eHt").appendChild(listEditor(N.hoan_thanh.dong, null, markCd));
    const drawSlots = async () => { await loadImgs(); $$("[data-pv]", v).forEach((p) => { const im = S.imgs.find((x) => x.id === G[p.dataset.pv]); p.style.backgroundImage = im ? `url('${imgUrl(im, true)}')` : ""; p.textContent = im ? "" : "Chưa có"; }); };
    $$("[data-pick]", v).forEach((b) => b.addEventListener("click", () => pickImage(b.dataset.pick === "logo" ? "logo" : b.dataset.pick, (id) => { G[b.dataset.pick] = id; markCd(); drawSlots(); })));
    $$("[data-clr]", v).forEach((b) => b.addEventListener("click", () => { G[b.dataset.clr] = ""; markCd(); drawSlots(); }));
    drawSlots();
  }

  // ================= HINH ANH =================
  const imgUrl = (im, thumb) => API + "/api/files/tuyendung_anh/" + im.id + "/" + encodeURIComponent(im.tep) + (thumb ? "?thumb=480x0" : "");
  async function loadImgs() { S.imgs = await listAll("tuyendung_anh", "", "-created"); return S.imgs; }
  async function usageMap() {
    const use = {};
    const add = (id, t) => { if (!id) return; (use[id] = use[id] || []).push(t); };
    const cds = await listAll("tuyendung_chiendich", "", "");
    cds.forEach((c) => Object.entries(c.giao_dien || {}).forEach(([k, id]) => typeof id === "string" && id && add(id, c.ten + " · " + k)));
    const qs = await listAll("tuyendung_cauhoi", "", "");
    qs.forEach((q) => (q.lua_chon || []).forEach((o) => add(o.anh, "câu " + q.ma)));
    return use;
  }
  function compress(file, maxW) {
    return new Promise((res, rej) => {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return rej(new Error("Chỉ nhận ảnh JPG, PNG, WEBP, GIF"));
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const s = Math.min(1, maxW / Math.max(im.width, im.height)), w = Math.round(im.width * s), h = Math.round(im.height * s);
        if (file.type === "image/gif" || (s === 1 && file.size < 400000)) { URL.revokeObjectURL(u); return res({ file, w: im.width, h: im.height }); }
        const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
        if (file.type === "image/png") g.clearRect(0, 0, w, h);
        g.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(u);
        c.toBlob((b) => { if (!b) return rej(new Error("Không nén được ảnh")); const nb = b.size < file.size ? b : file; res({ file: new File([nb], file.name.replace(/\.\w+$/, "") + (nb === b ? ".webp" : file.name.match(/\.\w+$/)[0]), { type: nb.type }), w: nb === b ? w : im.width, h: nb === b ? h : im.height }); }, "image/webp", 0.85);
      };
      im.onerror = () => rej(new Error("Ảnh lỗi")); im.src = u;
    });
  }
  async function uploadImg(file, loai, replaceId) {
    const { file: f, w, h } = await compress(file, loai === "logo" ? 800 : loai === "vi_tri" ? 1000 : 2000);
    if (f.size > 5 * 1048576) throw new Error("Ảnh vẫn > 5MB sau khi nén: " + file.name);
    if ((loai === "banner" || loai === "nen") && w < 1200) toast("Lưu ý: ảnh " + file.name + " chỉ rộng " + w + "px – nên dùng ảnh ≥ 1600px cho banner.", "");
    const fd = new FormData(); fd.append("tep", f); fd.append("rong", w); fd.append("cao", h);
    if (!replaceId) { fd.append("ten", file.name.replace(/\.\w+$/, "").slice(0, 120)); fd.append("loai", loai); }
    return replaceId ? api(rec("tuyendung_anh", replaceId), { method: "PATCH", body: fd }) : api(rec("tuyendung_anh"), { method: "POST", body: fd });
  }
  async function vAnh(v) {
    v.innerHTML = `<div class="h"><h2>Hình ảnh</h2>
      <select id="aLoai" style="width:auto">${Object.entries(IMG_TYPES).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
      <label class="b pri" style="cursor:pointer">⬆ Tải ảnh lên<input type="file" id="aUp" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label>
      <select id="aFil" style="width:auto"><option value="">Tất cả</option><option value="_unused">Chưa dùng</option>${Object.entries(IMG_TYPES).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></div>
      <p class="mut">Ảnh được nén tự động (WEBP, tối đa 2000px) trước khi tải. Định dạng: JPG, PNG, WEBP, GIF; tối đa 5MB. <b>Thay ảnh</b> cập nhật ngay trên form đang chạy. Ảnh đang dùng không xoá được.</p>
      <div id="aGrid" class="imgs"><div class="card empty">Đang tải…</div></div>`;
    const draw = async () => {
      const [imgs, use] = await Promise.all([loadImgs(), usageMap()]);
      const fl = $("#aFil").value;
      const list = imgs.filter((i) => !fl || (fl === "_unused" ? !use[i.id] : i.loai === fl));
      $("#aGrid").innerHTML = list.length ? list.map((i) => `<div class="im" data-id="${i.id}"><div class="pv" style="background-image:url('${imgUrl(i, true)}')"></div><div class="meta">
        <input data-ten value="${esc(i.ten)}" title="Tên ảnh">
        <select data-loai>${Object.entries(IMG_TYPES).map(([k, t]) => `<option value="${k}" ${i.loai === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <span class="mut">${i.rong || "?"}×${i.cao || "?"}px</span>${use[i.id] ? `<span class="use" title="${esc(use[i.id].join(", "))}">● Đang dùng (${use[i.id].length})</span>` : `<span class="mut">Chưa dùng</span>`}
        <div class="row"><a class="b sm" href="${imgUrl(i)}" target="_blank" rel="noopener">Xem</a><label class="b sm" style="cursor:pointer">Thay<input type="file" data-rep accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><button class="b sm dan" data-del type="button">Xoá</button></div></div></div>`).join("") : `<div class="card empty">Không có ảnh.</div>`;
      $$(".im", $("#aGrid")).forEach((card) => {
        const id = card.dataset.id;
        $("[data-ten]", card).addEventListener("change", (e) => api(rec("tuyendung_anh", id), { method: "PATCH", body: { ten: e.target.value } }).then(() => toast("Đã đổi tên", "ok")).catch(fail));
        $("[data-loai]", card).addEventListener("change", (e) => api(rec("tuyendung_anh", id), { method: "PATCH", body: { loai: e.target.value } }).then(() => toast("Đã đổi loại", "ok")).catch(fail));
        $("[data-rep]", card).addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; try { const im = imgs.find((x) => x.id === id); await uploadImg(f, im.loai, id); toast("Đã thay ảnh", "ok"); draw(); } catch (er) { fail(er); } });
        $("[data-del]", card).addEventListener("click", async () => { if (!confirm("Xoá ảnh này?")) return; try { await api(rec("tuyendung_anh", id), { method: "DELETE" }); toast("Đã xoá ảnh", "ok"); draw(); } catch (er) { fail(er); } });
      });
    };
    $("#aFil").addEventListener("change", draw);
    $("#aUp").addEventListener("change", async (e) => { const fs = Array.from(e.target.files); e.target.value = ""; for (const f of fs) { try { await uploadImg(f, $("#aLoai").value); } catch (er) { fail(er); } } toast("Đã tải " + fs.length + " ảnh", "ok"); draw(); });
    draw().catch(fail);
  }
  async function pickImage(loai, cb) {
    openModal("Chọn ảnh", `<div class="row" style="margin-bottom:12px"><label class="b pri" style="cursor:pointer">⬆ Tải ảnh mới<input type="file" id="pkUp" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><span class="mut">Bấm vào ảnh để chọn</span></div><div class="imgs" id="pkG"><div class="empty">Đang tải…</div></div>`);
    const draw = async () => {
      const imgs = await loadImgs();
      const sorted = imgs.slice().sort((a, b) => (a.loai === loai ? -1 : 0) - (b.loai === loai ? -1 : 0));
      $("#pkG").innerHTML = sorted.length ? sorted.map((i) => `<div class="im pick" data-id="${i.id}"><div class="pv" style="background-image:url('${imgUrl(i, true)}')"></div><div class="meta"><b>${esc(i.ten)}</b><span class="mut">${IMG_TYPES[i.loai] || ""}</span></div></div>`).join("") : `<div class="empty">Chưa có ảnh – tải ảnh mới.</div>`;
      $$(".im", $("#pkG")).forEach((c) => c.addEventListener("click", () => { closeModal(); cb(c.dataset.id); }));
    };
    $("#pkUp").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; try { const r = await uploadImg(f, loai); closeModal(); cb(r.id); } catch (er) { fail(er); } });
    draw().catch(fail);
  }
  function openModal(t, html) { $("#mTitle").textContent = t; $("#mBody").innerHTML = html; $("#modal").hidden = false; }
  function closeModal() { $("#modal").hidden = true; $("#mBody").innerHTML = ""; }
  $("#mClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

  // ================= CAU HOI =================
  const published = () => S.cd && S.cd.so_phien_ban > 0;
  function vCh(v) {
    v.innerHTML = `<div class="h"><h2>Câu hỏi</h2><select id="qAddT" style="width:auto">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select><button class="b pri" id="qAdd" type="button">＋ Thêm câu hỏi</button></div>
      <p class="mut">Kéo ⠿ để sắp xếp (hoặc ↑↓). Mỗi câu có <b>mã</b> cố định dùng làm khoá dữ liệu – đổi nội dung/thứ tự không làm mất liên kết hồ sơ cũ.</p>
      <div class="qb"><div class="ql" id="qList"></div><div id="qEd"></div></div>`;
    $("#qAdd").addEventListener("click", () => {
      const t = $("#qAddT").value, n = S.qs.length + 1;
      let ma = "cau_" + rid(4); while (S.qs.some((q) => q.ma === ma)) ma = "cau_" + rid(4);
      const q = { id: "new_" + rid(6), _new: true, _dirty: true, ma, loai: t, tieu_de: "Câu hỏi mới " + n, mo_ta: "", goi_y: "", bat_buoc: false, an: false, truong: "", lua_chon: CHOICE.indexOf(t) >= 0 ? [{ id: "o_" + rid(6), nhan: "Lựa chọn 1", icon: "", mo_ta: "", ma_goc: "" }, { id: "o_" + rid(6), nhan: "Lựa chọn 2", icon: "", mo_ta: "", ma_goc: "" }] : [], dieu_kien: [], kiem_tra: {} };
      const at = S.qs.findIndex((x) => x.id === S.selQ); S.qs.splice(at >= 0 ? at + 1 : S.qs.length, 0, q);
      S.selQ = q.id; pubState(); drawList(); drawEd();
    });
    if (!S.selQ && S.qs[0]) S.selQ = S.qs[0].id;
    drawList(); drawEd();
  }
  function drawList() {
    const L = $("#qList"); if (!L) return;
    L.innerHTML = S.qs.map((q, i) => `<div class="qi ${q.id === S.selQ ? "on" : ""} ${q.an ? "hidden-q" : ""}" draggable="true" data-id="${q.id}">
      <span class="hd" title="Kéo để sắp xếp" aria-hidden="true">⠿</span><span class="n">${i + 1}</span>
      <div class="t"><b>${esc(q.tieu_de)}</b><div>${`<span class="badge">${TYPES[q.loai]}</span>`}${q.bat_buoc ? '<span class="badge req">Bắt buộc</span>' : ""}${q.dieu_kien.length ? '<span class="badge cond">Điều kiện</span>' : ""}${q.an ? '<span class="badge hid">Ẩn</span>' : ""}${q.truong ? `<span class="badge map">${esc(FIELDS[q.truong].split(" (")[0])}</span>` : ""}${q._dirty || q._new ? '<span class="badge cond">●</span>' : ""}</div></div>
      <div class="mv"><button type="button" data-mv="-1" aria-label="Lên">▲</button><button type="button" data-mv="1" aria-label="Xuống">▼</button></div></div>`).join("") || `<div class="card empty">Chưa có câu hỏi.</div>`;
    let dragId = null;
    $$(".qi", L).forEach((el) => {
      el.addEventListener("click", (e) => { if (e.target.dataset.mv) return; S.selQ = el.dataset.id; drawList(); drawEd(); });
      $$("[data-mv]", el).forEach((b) => b.addEventListener("click", () => move(el.dataset.id, +b.dataset.mv)));
      el.addEventListener("dragstart", (e) => { dragId = el.dataset.id; el.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch (_) {} });
      el.addEventListener("dragend", () => { el.classList.remove("drag"); $$(".qi", L).forEach((x) => x.classList.remove("over")); });
      el.addEventListener("dragover", (e) => { e.preventDefault(); $$(".qi", L).forEach((x) => x.classList.remove("over")); el.classList.add("over"); });
      el.addEventListener("drop", (e) => { e.preventDefault(); if (!dragId || dragId === el.dataset.id) return; const from = S.qs.findIndex((q) => q.id === dragId); const [it] = S.qs.splice(from, 1); S.qs.splice(S.qs.findIndex((q) => q.id === el.dataset.id), 0, it); it._dirty = true; pubState(); drawList(); drawEd(); });
      // keo bang tay tren dien thoai (giu ⠿)
      const hd = $(".hd", el);
      hd.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; e.preventDefault(); const id = el.dataset.id; el.classList.add("drag");
        const mv = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); const over = t && t.closest(".qi"); $$(".qi", L).forEach((x) => x.classList.toggle("over", x === over && x !== el)); };
        const up = (ev) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); el.classList.remove("drag"); const t = document.elementFromPoint(ev.clientX, ev.clientY); const over = t && t.closest(".qi");
          if (over && over.dataset.id !== id) { const from = S.qs.findIndex((q) => q.id === id); const [it] = S.qs.splice(from, 1); S.qs.splice(S.qs.findIndex((q) => q.id === over.dataset.id), 0, it); it._dirty = true; pubState(); } drawList(); drawEd(); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); });
    });
  }
  function move(id, d) { const i = S.qs.findIndex((q) => q.id === id), j = i + d; if (j < 0 || j >= S.qs.length) return; [S.qs[i], S.qs[j]] = [S.qs[j], S.qs[i]]; S.qs[i]._dirty = S.qs[j]._dirty = true; pubState(); drawList(); drawEd(); }
  function drawEd() {
    const E = $("#qEd"); if (!E) return;
    const q = S.qs.find((x) => x.id === S.selQ);
    if (!q) { E.innerHTML = `<div class="card empty">Chọn một câu hỏi bên trái để sửa.</div>`; return; }
    const idx = S.qs.indexOf(q), lockMa = published() && !q._new;
    const k = q.kiem_tra;
    const vfields = { text: [["min_dai", "Số ký tự tối thiểu", "number"], ["max_dai", "Số ký tự tối đa", "number"], ["mau", "Mẫu kiểm tra (biểu thức chính quy, nâng cao)", "text"]], number: [["min", "Giá trị nhỏ nhất", "number"], ["max", "Giá trị lớn nhất", "number"]],
      date: [["min", "Ngày sớm nhất", "date"], ["max", "Ngày muộn nhất", "date"]], multi: [["min_chon", "Chọn ít nhất", "number"], ["max_chon", "Chọn nhiều nhất", "number"]], file: [["max_mb", "Dung lượng tối đa mỗi tệp (MB, ≤5)", "number"]] }[q.loai] || [];
    E.innerHTML = `<div class="card"><div class="row" style="margin-bottom:12px"><h3 style="margin:0;flex:1">Câu ${idx + 1}</h3>
        <button class="b sm" type="button" id="qDup">⧉ Nhân bản</button><button class="b sm" type="button" id="qPv">👁 Xem câu này</button><button class="b sm dan" type="button" id="qDel">Xoá câu</button></div>
      <div class="grid"><label>Nội dung câu hỏi<input id="eT" value="${esc(q.tieu_de)}" maxlength="300"></label>
        <label>Mô tả / hướng dẫn (không bắt buộc)<input id="eD" value="${esc(q.mo_ta)}" maxlength="500"></label>
        <div class="grid g3"><label>Loại dữ liệu<select id="eL">${Object.entries(TYPES).map(([kk, t]) => `<option value="${kk}" ${q.loai === kk ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label>Chữ gợi ý trong ô nhập<input id="eG" value="${esc(q.goi_y)}" maxlength="120"></label>
          <label>Mã câu hỏi (khoá dữ liệu)<input id="eM" value="${esc(q.ma)}" ${lockMa ? "readonly" : ""} pattern="[a-z][a-z0-9_]*"><div class="help">${lockMa ? "🔒 Đã khoá vì chiến dịch đã xuất bản." : "Chữ thường không dấu, số, _. Không đổi được sau khi xuất bản."}</div></label></div>
        <div class="row"><label class="chk"><input type="checkbox" id="eB" ${q.bat_buoc ? "checked" : ""}> Bắt buộc trả lời</label><label class="chk"><input type="checkbox" id="eA" ${q.an ? "checked" : ""}> Tạm ẩn câu này</label></div>
        <label>Gắn với trường của bảng ứng viên<select id="eF">${Object.entries(FIELDS).map(([kk, t]) => `<option value="${kk}" ${q.truong === kk ? "selected" : ""}>${t}</option>`).join("")}</select>
          <div class="help">Mọi câu trả lời đều được lưu đầy đủ. Gắn trường để điền thêm vào bảng ứng viên cũ (lọc, thống kê). Bắt buộc có câu gắn Họ tên và Số điện thoại.</div></label>
      </div></div>
      ${CHOICE.indexOf(q.loai) >= 0 ? `<div class="card"><h3>Lựa chọn trả lời</h3><div id="eOpts"></div></div>` : ""}
      <div class="card"><h3>Điều kiện hiển thị</h3><p class="help" style="margin-top:-6px">Không có điều kiện = luôn hiển thị. Nhiều điều kiện = phải thoả TẤT CẢ.</p><div id="eCond"></div><button class="b sm" type="button" id="eCAdd">＋ Thêm điều kiện</button></div>
      ${vfields.length || ["text", "phone", "number", "date", "multi", "file"].indexOf(q.loai) >= 0 ? `<div class="card"><h3>Kiểm tra dữ liệu</h3><div class="grid g3">${vfields.map(([kk, t, ty]) => `<label>${t}<input type="${ty}" data-k="${kk}" value="${esc(k[kk] == null ? "" : k[kk])}"></label>`).join("")}
        <label>Thông báo lỗi riêng (không bắt buộc)<input data-k="thong_bao" value="${esc(k.thong_bao || "")}"></label></div>
        ${q.loai === "phone" ? `<p class="help">Số điện thoại luôn được kiểm tra định dạng Việt Nam 10 số (03/05/07/08/09…), tự đổi +84 → 0.</p>` : ""}${q.truong === "nam_sinh" ? `<p class="help">Năm sinh luôn kiểm tra tuổi 15–65.</p>` : ""}</div>` : ""}`;
    const re = () => { markQ(q); drawList(); };
    $("#eT").addEventListener("input", (e) => { q.tieu_de = e.target.value; re(); });
    $("#eD").addEventListener("input", (e) => { q.mo_ta = e.target.value; markQ(q); });
    $("#eG").addEventListener("input", (e) => { q.goi_y = e.target.value; markQ(q); });
    $("#eM").addEventListener("change", (e) => { const m = e.target.value.trim(); if (!/^[a-z][a-z0-9_]{0,39}$/.test(m) || S.qs.some((x) => x !== q && x.ma === m)) { toast("Mã không hợp lệ hoặc bị trùng", "err"); e.target.value = q.ma; return; } q.ma = m; markQ(q); });
    $("#eB").addEventListener("change", (e) => { q.bat_buoc = e.target.checked; re(); });
    $("#eA").addEventListener("change", (e) => { q.an = e.target.checked; re(); });
    $("#eL").addEventListener("change", (e) => { q.loai = e.target.value; if (CHOICE.indexOf(q.loai) >= 0 && !q.lua_chon.length) q.lua_chon = [{ id: "o_" + rid(6), nhan: "Lựa chọn 1", icon: "", mo_ta: "", ma_goc: "" }]; q.kiem_tra = {}; re(); drawEd(); });
    $("#eF").addEventListener("change", (e) => { q.truong = e.target.value; re(); drawEd(); });
    $$("[data-k]", E).forEach((i) => i.addEventListener("input", () => { const kk = i.dataset.k; if (i.value === "") delete q.kiem_tra[kk]; else q.kiem_tra[kk] = i.type === "number" ? +i.value : i.value; markQ(q); }));
    $("#qDel").addEventListener("click", () => { if (!confirm("Xoá câu \"" + q.tieu_de + "\"? (Câu trả lời đã thu thập vẫn được giữ trong hồ sơ)")) return; const refs = S.qs.filter((x) => x.dieu_kien.some((d) => d.ma === q.ma)); if (refs.length && !confirm("Có " + refs.length + " câu đang dùng câu này làm điều kiện. Vẫn xoá?")) return; if (!q._new) S.delQ.push(q.id); S.qs.splice(idx, 1); S.selQ = (S.qs[idx] || S.qs[idx - 1] || {}).id; pubState(); drawList(); drawEd(); });
    $("#qDup").addEventListener("click", () => { const c = clone(q); c.id = "new_" + rid(6); c._new = true; c._dirty = true; c.ma = (q.ma + "_2").slice(0, 36); while (S.qs.some((x) => x.ma === c.ma)) c.ma = q.ma.slice(0, 30) + "_" + rid(3); c.tieu_de = q.tieu_de + " (bản sao)"; c.truong = ""; c.lua_chon.forEach((o) => (o.id = "o_" + rid(6))); S.qs.splice(idx + 1, 0, c); S.selQ = c.id; pubState(); drawList(); drawEd(); });
    $("#qPv").addEventListener("click", async () => { if (dirty() && !(await saveDraft(true))) return; S._pvQ = q.ma; tab("xt"); });
    if ($("#eOpts")) $("#eOpts").appendChild(optEditor(q));
    drawCond(q);
    $("#eCAdd").addEventListener("click", () => { const prevs = S.qs.slice(0, idx); q.dieu_kien.push({ ma: (prevs.filter((x) => CHOICE.indexOf(x.loai) >= 0).pop() || prevs[prevs.length - 1] || { ma: "@src" }).ma, toan_tu: "bang", gia_tri: [] }); markQ(q); drawCond(q); drawList(); });
  }
  function drawCond(q) {
    const box = $("#eCond"), idx = S.qs.indexOf(q), prevs = S.qs.slice(0, idx);
    box.innerHTML = q.dieu_kien.map((d, i) => {
      const src = S.qs.find((x) => x.ma === d.ma);
      const opts = d.ma === "@src" ? Object.entries(NGUON).filter(([kk]) => kk).map(([kk, t]) => ({ id: kk, nhan: t })) : src && CHOICE.indexOf(src.loai) >= 0 ? src.lua_chon : null;
      const vals = Array.isArray(d.gia_tri) ? d.gia_tri : [d.gia_tri];
      return `<div class="dk" data-i="${i}"><select data-c="ma"><option value="@src" ${d.ma === "@src" ? "selected" : ""}>Nguồn từ link/QR (?src=)</option>${prevs.map((x) => `<option value="${esc(x.ma)}" ${d.ma === x.ma ? "selected" : ""}>${esc(x.tieu_de)}</option>`).join("")}${d.ma !== "@src" && !prevs.some((x) => x.ma === d.ma) ? `<option selected value="${esc(d.ma)}">⚠ ${esc(d.ma)} (không còn ở trước)</option>` : ""}</select>
        <select data-c="toan_tu">${[["bang", "là một trong"], ["khac", "không phải"], ["da_tra_loi", "đã trả lời"], ["chua_tra_loi", "chưa trả lời / bỏ trống"]].map(([kk, t]) => `<option value="${kk}" ${d.toan_tu === kk ? "selected" : ""}>${t}</option>`).join("")}</select>
        ${["bang", "khac"].indexOf(d.toan_tu) >= 0 ? (opts ? `<div class="vals">${opts.map((o) => `<label><input type="checkbox" value="${esc(o.id)}" ${vals.indexOf(o.id) >= 0 ? "checked" : ""}>${esc(o.nhan)}</label>`).join("")}</div>` : `<input data-c="gia_tri" value="${esc(vals.join(","))}" placeholder="Giá trị">`) : "<span></span>"}
        <button class="b sm dan" type="button" data-x>✕</button></div>`;
    }).join("") || `<p class="mut">Luôn hiển thị.</p>`;
    $$(".dk", box).forEach((row) => { const d = q.dieu_kien[+row.dataset.i];
      $('[data-c="ma"]', row).addEventListener("change", (e) => { d.ma = e.target.value; d.gia_tri = []; markQ(q); drawCond(q); });
      $('[data-c="toan_tu"]', row).addEventListener("change", (e) => { d.toan_tu = e.target.value; markQ(q); drawCond(q); });
      $$(".vals input", row).forEach((c) => c.addEventListener("change", () => { d.gia_tri = $$(".vals input:checked", row).map((x) => x.value); markQ(q); }));
      const gv = $('[data-c="gia_tri"]', row); if (gv) gv.addEventListener("input", () => { d.gia_tri = gv.value.split(",").map((s) => s.trim()).filter(Boolean); markQ(q); });
      $("[data-x]", row).addEventListener("click", () => { q.dieu_kien.splice(+row.dataset.i, 1); markQ(q); drawCond(q); drawList(); });
    });
  }
  function optEditor(q) {
    const box = document.createElement("div");
    const codes = MAP_CODES[q.truong];
    const draw = () => {
      box.innerHTML = `${codes ? `<p class="help" style="margin-top:-6px">Câu này gắn với “${esc(FIELDS[q.truong])}”: chọn <b>Mã bảng ứng viên</b> cho từng lựa chọn (lựa chọn mới như “Kỹ thuật” có thể để “Khác/bất kỳ” – tên đầy đủ vẫn được lưu).</p>` : ""}
        <div class="opl">${q.lua_chon.map((o, i) => `<div class="op ${codes ? "map" : ""}" data-i="${i}">
          <div class="tools" style="flex-direction:column"><button type="button" data-m="-1" title="Lên">▲</button><button type="button" data-m="1" title="Xuống">▼</button></div>
          <div class="thumb" data-img title="Ảnh cho lựa chọn" style="${o.anh && S.imgs.find((x) => x.id === o.anh) ? `background-image:url('${imgUrl(S.imgs.find((x) => x.id === o.anh), true)}')` : ""}">${o.anh ? "" : "＋ảnh"}</div>
          <div class="row" style="flex-wrap:nowrap"><input data-k="icon" value="${esc(o.icon)}" placeholder="😀" style="width:52px;text-align:center" title="Biểu tượng (emoji)"><input data-k="nhan" value="${esc(o.nhan)}" placeholder="Nội dung lựa chọn"></div>
          <input data-k="mo_ta" value="${esc(o.mo_ta)}" placeholder="Mô tả ngắn (không bắt buộc)">
          ${codes ? `<select data-k="ma_goc"><option value="">– Mã –</option>${codes.map(([c, t]) => `<option value="${c}" ${o.ma_goc === c ? "selected" : ""}>${t}</option>`).join("")}</select>` : ""}
          <div class="tools">${o.anh ? `<button type="button" data-noimg title="Gỡ ảnh">🚫</button>` : ""}<button type="button" data-x title="Xoá lựa chọn">✕</button></div>
          <div class="id">id: ${esc(o.id)}</div></div>`).join("")}</div>
        <div class="row" style="margin-top:10px"><button class="b sm" type="button" data-add>＋ Thêm lựa chọn</button><button class="b sm" type="button" data-bulk>Thêm nhiều (dán danh sách)</button></div>`;
      $$(".op", box).forEach((row) => { const i = +row.dataset.i, o = q.lua_chon[i];
        $$("[data-k]", row).forEach((inp) => inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", () => { o[inp.dataset.k] = inp.value; markQ(q); }));
        $$("[data-m]", row).forEach((b) => b.addEventListener("click", () => { const j = i + +b.dataset.m; if (j < 0 || j >= q.lua_chon.length) return; [q.lua_chon[i], q.lua_chon[j]] = [q.lua_chon[j], q.lua_chon[i]]; markQ(q); draw(); }));
        $("[data-x]", row).addEventListener("click", () => { if (q.lua_chon.length <= 1) return toast("Cần ít nhất 1 lựa chọn", "err"); if (!confirm("Xoá lựa chọn \"" + o.nhan + "\"?")) return; q.lua_chon.splice(i, 1); markQ(q); draw(); });
        $("[data-img]", row).addEventListener("click", () => pickImage("vi_tri", (id) => { o.anh = id; markQ(q); loadImgs().then(draw, draw); }));
        const ni = $("[data-noimg]", row); if (ni) ni.addEventListener("click", () => { o.anh = ""; markQ(q); draw(); });
      });
      $("[data-add]", box).addEventListener("click", () => { q.lua_chon.push({ id: "o_" + rid(6), nhan: "", icon: "", mo_ta: "", ma_goc: "" }); markQ(q); draw(); const ins = $$('[data-k="nhan"]', box); ins[ins.length - 1].focus(); });
      $("[data-bulk]", box).addEventListener("click", () => { const t = prompt("Dán danh sách, mỗi dòng một lựa chọn:"); if (!t) return; t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((s) => q.lua_chon.push({ id: "o_" + (keyify(s) || rid(4)).slice(0, 20) + "_" + rid(3), nhan: s, icon: "", mo_ta: "", ma_goc: "" })); markQ(q); draw(); });
    };
    loadImgs().then(draw).catch(draw); draw();
    return box;
  }

  // ================= LUA CHON TRA LOI =================
  function vLc(v) {
    const cq = S.qs.filter((q) => CHOICE.indexOf(q.loai) >= 0);
    if (!S.lcQ || !cq.find((q) => q.id === S.lcQ)) S.lcQ = (cq.find((q) => q.truong === "vi_tri") || cq[0] || {}).id;
    v.innerHTML = `<div class="h"><h2>Lựa chọn trả lời</h2></div>
      <p class="mut">Sửa nhanh đáp án của các câu chọn. <b>Vị trí tuyển dụng</b> = lựa chọn của câu gắn trường “Vị trí”.</p>
      <div class="row" style="margin-bottom:14px">${cq.map((q) => `<button class="b sm ${q.id === S.lcQ ? "pri" : ""}" type="button" data-q="${q.id}">${q.truong === "vi_tri" ? "📌 Vị trí tuyển dụng" : esc(q.tieu_de.slice(0, 40))}</button>`).join("") || `<span class="mut">Chưa có câu hỏi dạng chọn.</span>`}</div>
      <div id="lcBox"></div>`;
    $$("[data-q]", v).forEach((b) => b.addEventListener("click", () => { S.lcQ = b.dataset.q; vLc(v); }));
    const q = S.qs.find((x) => x.id === S.lcQ);
    if (q) { const c = document.createElement("div"); c.className = "card"; c.innerHTML = `<h3>${esc(q.tieu_de)}</h3>`; c.appendChild(optEditor(q)); $("#lcBox").appendChild(c); }
  }

  // ================= XEM TRUOC =================
  async function vXt(v) {
    const mode = LS.get("td_admin_pvm") || "phone";
    v.innerHTML = `<div class="h"><h2>Xem trước</h2><button class="b sm ${mode === "phone" ? "pri" : ""}" data-m="phone" type="button">📱 Điện thoại</button><button class="b sm ${mode === "desk" ? "pri" : ""}" data-m="desk" type="button">🖥 Máy tính</button><button class="b sm" id="xR" type="button">⟳ Tải lại</button><a class="b sm" id="xO" target="_blank" rel="noopener">Mở tab mới ↗</a></div>
      <p class="mut">Hiển thị <b>bản nháp đã lưu</b> (chưa xuất bản). Gửi thử trong xem trước <b>không lưu</b> dữ liệu.</p><div id="xErr"></div><div class="pvw ${mode}"><iframe id="xF" title="Xem trước form"></iframe></div>`;
    if (dirty()) { if (!(await saveDraft(true))) return; }
    const url = location.pathname.replace(/admin\/?(index\.html)?$/, "") + "?preview=" + S.cd.id + (S._pvQ ? "&q=" + encodeURIComponent(S._pvQ) : "");
    S._pvQ = null;
    $("#xF").src = url; $("#xO").href = url;
    $$("[data-m]", v).forEach((b) => b.addEventListener("click", () => { LS.set("td_admin_pvm", b.dataset.m); vXt(v); }));
    $("#xR").addEventListener("click", () => { $("#xF").src = url; });
    try { const d = await api("/api/tuyendung/admin/xem-truoc/" + S.cd.id); if (d.loi.length) $("#xErr").innerHTML = `<div class="card"><h3>⚠ Cần sửa trước khi xuất bản</h3><ul class="msgs">${d.loi.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`; } catch (_) {}
  }

  // ================= XUAT BAN =================
  async function vXb(v) {
    v.innerHTML = `<div class="h"><h2>Xuất bản</h2></div><div id="pBody"><div class="card empty">Đang kiểm tra…</div></div>`;
    if (dirty()) { if (!(await saveDraft(true))) return; }
    try {
      const [d, vers] = await Promise.all([api("/api/tuyendung/admin/xem-truoc/" + S.cd.id), listAll("tuyendung_phienban", `chien_dich="${S.cd.id}"`, "-so")]);
      const cur = vers.find((x) => x.id === S.cd.phien_ban_id);
      const diff = cur ? diffSnap(cur.noi_dung || {}, d) : ["Lần xuất bản đầu tiên"];
      const changed = !cur || diff.length > 0;
      $("#pBody").innerHTML = `<div class="grid g2">
        <div class="card"><h3>Trạng thái</h3><div class="kv"><span>Chiến dịch</span><b>${esc(S.cd.ten)}</b><span>Đang chạy</span><b>${cur ? "Phiên bản " + cur.so + " · " + fmtDate(cur.created) : "Chưa xuất bản"}</b>
          <span>Hoạt động</span><b>${S.cd.hoat_dong ? "Đang mở cho ứng viên" : "Đang tắt (bật ở mục Chiến dịch)"}</b><span>Link form</span><b><a href="${esc(formUrl(S.cd))}" target="_blank" rel="noopener">${esc(formUrl(S.cd))}</a></b></div>
          <h3 style="margin-top:16px">Thay đổi so với bản đang chạy</h3>${changed ? `<ul class="msgs diff">${diff.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="mut">Không có thay đổi.</p>`}
          ${d.loi.length ? `<h3 style="margin-top:16px">⚠ Cần sửa</h3><ul class="msgs">${d.loi.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          <div class="row" style="margin-top:16px"><button class="b pri" id="pGo" type="button" ${d.loi.length || !changed ? "disabled" : ""}>🚀 Xuất bản phiên bản ${S.cd.so_phien_ban + 1}</button><button class="b" type="button" id="pPv">👁 Xem trước</button></div>
          <p class="help">Hồ sơ đã nộp luôn gắn với phiên bản ứng viên đã dùng – sửa form về sau không làm thay đổi hồ sơ cũ.</p></div>
        <div class="card"><h3>Lịch sử phiên bản</h3>${vers.length ? `<table class="tbl"><thead><tr><th>Phiên bản</th><th>Thời gian</th><th>Người xuất bản</th><th>Số câu</th></tr></thead><tbody>${vers.map((x) => `<tr><td><b>v${x.so}</b>${x.id === S.cd.phien_ban_id ? ' <span class="badge map">đang chạy</span>' : ""}</td><td>${fmtDate(x.created)}</td><td>${esc(x.nguoi_xuat_ban)}</td><td>${((x.noi_dung || {}).cau_hoi || []).length}</td></tr>`).join("")}</tbody></table>` : `<p class="mut">Chưa có.</p>`}</div></div>`;
      $("#pPv").addEventListener("click", () => tab("xt"));
      $("#pGo").addEventListener("click", async () => {
        if (!confirm("Xuất bản phiên bản mới? Ứng viên sẽ thấy ngay nội dung này" + (S.cd.hoat_dong ? "." : " (khi chiến dịch được bật Hoạt động)."))) return;
        try { const r = await api("/api/tuyendung/admin/xuat-ban/" + S.cd.id, { method: "POST" }); toast("Đã xuất bản phiên bản " + r.so, "ok"); brandLogo(); await loadCds(); await pickCd(S.cd.id); vXb(v); }
        catch (e) { fail(e); }
      });
    } catch (e) { fail(e); }
  }

  // ================= TAI KHOAN =================
  const VAI_TRO = { quan_tri: "Quản trị (toàn quyền)", nhan_vien: "Nhân viên tuyển dụng (Dashboard + Ứng viên)" };
  const genPass = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", r = crypto.getRandomValues(new Uint8Array(10)); return Array.from(r, (x) => a[x % a.length]).join(""); };
  function showPass(email, pass) {
    openModal("Thông tin đăng nhập", `<p>Gửi cho nhân viên <b>trực tiếp</b> (Zalo riêng / giấy), không đăng lên nhóm chung. Mật khẩu chỉ hiện <b>một lần</b>.</p>
      <div class="kv" style="margin:12px 0"><span>Trang</span><b>${esc(location.origin + location.pathname)}</b><span>Email</span><b>${esc(email)}</b><span>Mật khẩu</span><b style="font-size:18px;letter-spacing:.05em">${esc(pass)}</b></div>
      <button class="b pri" type="button" id="cpP">📋 Copy toàn bộ</button>`);
    $("#cpP").addEventListener("click", () => navigator.clipboard.writeText(`Trang quản trị tuyển dụng: ${location.origin + location.pathname}\nEmail: ${email}\nMật khẩu: ${pass}\n(Đổi mật khẩu sau khi đăng nhập: bấm "Đổi mật khẩu" góc dưới bên trái)`).then(() => toast("Đã copy", "ok")));
  }
  async function vTk(v) {
    v.innerHTML = `<div class="h"><h2>Tài khoản tuyển dụng</h2></div>
      <div class="card"><h3>Thêm tài khoản</h3><div class="grid g4">
        <label>Họ tên<input id="nTen" placeholder="Nguyễn Thị A"></label>
        <label>Email đăng nhập<input id="nEmail" type="email" placeholder="ten@il-sungtech.com"></label>
        <label>Vai trò<select id="nVt">${Object.entries(VAI_TRO).map(([k, t]) => `<option value="${k}" ${k === "nhan_vien" ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Mật khẩu (tự tạo)<div class="row" style="margin-top:5px;flex-wrap:nowrap"><input id="nPass"><button class="b sm" type="button" id="nGen" title="Tạo mật khẩu khác">⟳</button></div></label></div>
        <div class="row" style="margin-top:12px"><button class="b pri" type="button" id="nAdd">＋ Tạo tài khoản</button><span class="mut small">Nhân viên tuyển dụng chỉ xem Dashboard và xử lý Ứng viên, không sửa được form.</span></div></div>
      <div id="tkList"><div class="card empty">Đang tải…</div></div>`;
    $("#nPass").value = genPass();
    $("#nGen").addEventListener("click", () => ($("#nPass").value = genPass()));
    $("#nAdd").addEventListener("click", async () => {
      const email = $("#nEmail").value.trim(), pass = $("#nPass").value, ho_ten = $("#nTen").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Email chưa đúng", "err");
      if (pass.length < 8) return toast("Mật khẩu cần ít nhất 8 ký tự", "err");
      try { await api(rec("tuyendung_quantri"), { method: "POST", body: { email, password: pass, passwordConfirm: pass, ho_ten, vai_tro: $("#nVt").value } }); showPass(email, pass); $("#nEmail").value = $("#nTen").value = ""; $("#nPass").value = genPass(); draw(); }
      catch (e) { if (e.detail && /email/i.test(e.detail)) e.detail = "Email đã có tài khoản hoặc không hợp lệ"; fail(e); }
    });
    const draw = async () => {
      try {
        const list = await listAll("tuyendung_quantri", "", "email");
        $("#tkList").innerHTML = `<div class="tblw"><table class="tbl"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th></th></tr></thead><tbody>${list.map((u) => `<tr data-id="${u.id}">
          <td><input data-ten value="${esc(u.ho_ten)}" style="min-width:160px"></td><td>${esc(u.email)}${u.id === S.meId ? ' <span class="badge map">bạn</span>' : ""}</td>
          <td><select data-vt>${Object.entries(VAI_TRO).map(([k, t]) => `<option value="${k}" ${u.vai_tro === k ? "selected" : ""}>${t.split(" (")[0]}</option>`).join("")}</select></td>
          <td class="row" style="flex-wrap:nowrap"><button class="b sm" data-rs type="button">Đặt lại mật khẩu</button><button class="b sm dan" data-del type="button" ${u.id === S.meId ? "disabled" : ""}>Xoá</button></td></tr>`).join("")}</tbody></table></div>`;
        $$("tr[data-id]", $("#tkList")).forEach((tr) => {
          const u = list.find((x) => x.id === tr.dataset.id);
          $("[data-ten]", tr).addEventListener("change", (e) => api(rec("tuyendung_quantri", u.id), { method: "PATCH", body: { ho_ten: e.target.value } }).then(() => toast("Đã lưu", "ok")).catch(fail));
          $("[data-vt]", tr).addEventListener("change", (e) => api(rec("tuyendung_quantri", u.id), { method: "PATCH", body: { vai_tro: e.target.value } }).then(() => toast("Đã đổi vai trò", "ok")).catch((er) => { fail(er); draw(); }));
          $("[data-rs]", tr).addEventListener("click", async () => { if (!confirm("Đặt mật khẩu mới cho " + u.email + "? Mật khẩu cũ sẽ không dùng được nữa.")) return; const p = genPass();
            try { await api(rec("tuyendung_quantri", u.id), { method: "PATCH", body: { password: p, passwordConfirm: p } }); if (u.id === S.meId) { toast("Đã đổi mật khẩu của bạn – vui lòng đăng nhập lại", "ok"); showPass(u.email, p); setTimeout(logout, 100); return; } showPass(u.email, p); } catch (e) { fail(e); } });
          $("[data-del]", tr).addEventListener("click", async () => { if (!confirm("Xoá tài khoản " + u.email + "?")) return; try { await api(rec("tuyendung_quantri", u.id), { method: "DELETE" }); toast("Đã xoá", "ok"); draw(); } catch (e) { fail(e); } });
        });
      } catch (e) { fail(e); }
    };
    draw();
  }
  // doi mat khau cua chinh minh
  $("#chPass").addEventListener("click", () => {
    if (!S.auth || S.auth.col !== "tuyendung_quantri") return toast("Tài khoản superuser đổi mật khẩu trong trang quản trị ORG (/_/).", "");
    openModal("Đổi mật khẩu", `<div class="grid"><label>Mật khẩu hiện tại<input type="password" id="cpO" autocomplete="current-password"></label><label>Mật khẩu mới (≥ 8 ký tự)<input type="password" id="cpN" autocomplete="new-password"></label><label>Nhập lại mật khẩu mới<input type="password" id="cpN2" autocomplete="new-password"></label><button class="b pri" type="button" id="cpGo">Đổi mật khẩu</button></div>`);
    $("#cpGo").addEventListener("click", async () => {
      const o = $("#cpO").value, n = $("#cpN").value;
      if (n.length < 8) return toast("Mật khẩu mới cần ít nhất 8 ký tự", "err");
      if (n !== $("#cpN2").value) return toast("Hai lần nhập mật khẩu mới chưa khớp", "err");
      try { await api(rec("tuyendung_quantri", S.meId), { method: "PATCH", body: { oldPassword: o, password: n, passwordConfirm: n } }); closeModal(); toast("Đã đổi mật khẩu – vui lòng đăng nhập lại", "ok"); logout(); }
      catch (e) { if (e.detail && /oldPassword/.test(e.detail)) e.detail = "Mật khẩu hiện tại chưa đúng"; fail(e); }
    });
  });

  // Logo that: lay logo cua chien dich dang chay (Admin > Noi dung > Logo, sau khi Xuat ban)
  async function brandLogo() {
    try {
      const j = await (await fetch(API + "/api/tuyendung/form?t=" + Date.now(), { cache: "no-store" })).json();
      if (j && j.noi_dung && j.noi_dung.an_logo) { $$(".lbrand .mark, .sbrand .mark, .lbrand .blogo, .sbrand .blogo").forEach((m) => m.remove()); return; }
      const lg = j && j.giao_dien && j.giao_dien.anh && j.giao_dien.anh.logo;
      if (!lg || !lg.url) return;
      const src = /^https?:/.test(lg.url) ? lg.url : API + lg.url;
      $$(".lbrand .mark, .sbrand .mark, .lbrand .blogo, .sbrand .blogo").forEach((m) => { const im = document.createElement("img"); im.className = "blogo"; im.alt = "Logo"; im.src = src + (src.indexOf("?") < 0 ? "?t=" : "&t=") + Date.now(); m.replaceWith(im); });
      $(".lbrand").childNodes.forEach((n) => { if (n.nodeType === 3) n.textContent = ""; });
    } catch (_) {}
  }
  brandLogo();
  boot();
})();
