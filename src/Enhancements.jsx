import { useEffect, useRef } from "react";
import { supabase } from "./lib/supabase.js";
import "./enhancements.css";

const ADMIN_EMAIL = "kanshoev.amika@gmail.com";
const typeLabels = { film: "Фильм", series: "Сериал", anime: "Аниме" };
let topState = { page: null, status: "idle", request: 0 };
let refreshTimer = null;

const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Выберите файл изображения."));
    if (file.size > 10 * 1024 * 1024) return reject(new Error("Изображение слишком большое. Максимум 10 МБ."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1800, scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.88));
      };
      img.onerror = () => reject(new Error("Не удалось обработать изображение в браузере."));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Не удалось подготовить изображение.")); img.src = src;
  });
}

async function cropToPoster(src, x = 50, y = 50, zoom = 1) {
  const img = await loadImage(src), iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const tw = 700, th = 1050, ratio = tw / th, ir = iw / ih;
  let cw = ir > ratio ? ih * ratio : iw, ch = ir > ratio ? ih : iw / ratio;
  const z = Math.max(1, Math.min(2.4, Number(zoom) || 1)); cw = Math.min(iw, cw / z); ch = Math.min(ih, ch / z);
  const px = Math.max(0, Math.min(100, Number(x) || 50)) / 100, py = Math.max(0, Math.min(100, Number(y) || 50)) / 100;
  const sx = Math.max(0, Math.min(iw - cw, px * (iw - cw))), sy = Math.max(0, Math.min(ih - ch, py * (ih - ch)));
  const canvas = document.createElement("canvas"); canvas.width = tw; canvas.height = th;
  canvas.getContext("2d").drawImage(img, sx, sy, cw, ch, 0, 0, tw, th);
  return canvas.toDataURL("image/webp", 0.9);
}

async function findWork(title, year) {
  const exact = await supabase.from("media").select("id,title,release_year,poster_url").eq("title", title).maybeSingle();
  if (exact.data) return exact.data;
  const q = await supabase.from("media").select("id,title,release_year,poster_url").ilike("title", title).limit(10);
  return (q.data || []).find(x => !year || Number(x.release_year) === Number(year)) || null;
}

function currentWork() {
  const hero = document.querySelector(".work-hero"), h1 = hero?.querySelector(".work-info h1");
  if (!hero || !h1) return null;
  const match = (hero.querySelector(".work-info .eyebrow")?.textContent || "").match(/·\s*(\d{4})/);
  return { hero, poster: hero.querySelector(":scope > .poster"), title: h1.textContent.trim(), year: match?.[1] || null };
}

function openPosterEditor({ source, mediaId, mode, userId, refresh }) {
  const overlay = document.createElement("div"); overlay.className = "frame-poster-editor-overlay";
  overlay.innerHTML = `<div class="frame-poster-editor"><button class="frame-editor-close" type="button">×</button><div class="frame-editor-kicker">FRAME99 · ${mode === "admin" ? "АДМИН" : "ПРЕДЛОЖЕНИЕ"}</div><h2>ОБРЕЗАТЬ ПОСТЕР</h2><p class="frame-editor-help">Сразу видно финальный вид. Перетаскивай изображение внутри рамки и меняй масштаб.</p><div class="frame-editor-preview-row"><div class="frame-editor-crop-wrap"><span>ФИНАЛЬНЫЙ КАДР 2:3</span><div class="frame-editor-stage"><img alt="Предпросмотр постера"/></div></div></div><div class="frame-editor-controls"><label>МАСШТАБ <strong data-zoom-value>100%</strong><input data-zoom type="range" min="100" max="240" value="100"/></label></div><div class="frame-editor-actions"><button class="frame-editor-button secondary" type="button" data-reset>ЦЕНТРИРОВАТЬ</button><button class="frame-editor-button primary" type="button" data-save>${mode === "admin" ? "СОХРАНИТЬ ПОСТЕР" : "ОТПРАВИТЬ ПРЕДЛОЖЕНИЕ"}</button></div><p class="frame-editor-message"></p></div>`;
  document.body.appendChild(overlay);
  const img = overlay.querySelector("img"), stage = overlay.querySelector(".frame-editor-stage"), zoomInput = overlay.querySelector("[data-zoom]"), zoomValue = overlay.querySelector("[data-zoom-value]"), msg = overlay.querySelector(".frame-editor-message");
  img.src = source; let x = 50, y = 50, zoom = 1;
  const render = () => { img.style.transform = `scale(${zoom})`; img.style.transformOrigin = `${x}% ${y}%`; zoomValue.textContent = `${Math.round(zoom * 100)}%`; };
  render();
  const close = () => overlay.remove(); overlay.querySelector(".frame-editor-close").onclick = close;
  overlay.querySelector(".frame-editor-close").onclick = close;
  overlay.querySelector("[data-reset]").onclick = () => { x = 50; y = 50; zoom = 1; zoomInput.value = "100"; render(); };
  zoomInput.oninput = () => { zoom = Number(zoomInput.value) / 100; render(); };
  let dragging = false, sx = 0, sy = 0, ox = 50, oy = 50;
  stage.addEventListener("pointerdown", e => { dragging = true; stage.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = x; oy = y; });
  stage.addEventListener("pointermove", e => { if (!dragging) return; x = Math.max(0, Math.min(100, ox - (e.clientX - sx) / Math.max(1, stage.clientWidth) * 100)); y = Math.max(0, Math.min(100, oy - (e.clientY - sy) / Math.max(1, stage.clientHeight) * 100)); render(); });
  ["pointerup", "pointercancel"].forEach(ev => stage.addEventListener(ev, () => { dragging = false; }));
  overlay.querySelector("[data-save]").onclick = async () => {
    const btn = overlay.querySelector("[data-save]"); btn.disabled = true; msg.textContent = "ГОТОВИМ ФИНАЛЬНЫЙ ПОСТЕР…";
    try {
      const cropped = await cropToPoster(source, x, y, zoom);
      if (mode === "admin") {
        const { data, error } = await supabase.rpc("admin_update_media_poster", { p_media_id: mediaId, p_poster_url: cropped, p_position_x: 50, p_position_y: 50 });
        if (error) throw error; refresh?.(data || { poster_url: cropped }); msg.textContent = "Постер сохранён.";
      } else {
        const { error } = await supabase.from("poster_proposals").insert({ media_id: mediaId, user_id: userId, poster_url: cropped, position_x: 50, position_y: 50 });
        if (error) throw error; msg.textContent = "Предложение отправлено администратору.";
      }
      setTimeout(close, 550);
    } catch (e) { msg.textContent = e.message || "Не удалось сохранить постер."; btn.disabled = false; }
  };
}

function stylePlaceholders() {
  document.querySelectorAll(".placeholder-poster").forEach(el => { el.querySelector(".poster-mark")?.replaceChildren(document.createTextNode("99")); const small = el.querySelector("small"); if (small) small.textContent = "FRAME99"; el.classList.add("frame99-placeholder"); });
}

async function renderTopFive() {
  const home = document.querySelector(".hero"), catalog = document.querySelector(".catalog"), page = home ? "home" : catalog ? "catalog" : null;
  const old = [...document.querySelectorAll(".frame-top-five")];
  if (!page) { if (topState.page) { old.forEach(x => x.remove()); topState = { page:null,status:"idle",request:topState.request + 1 }; } return; }
  const anchor = home || document.querySelector(".catalog-head");
  if (!anchor) return;
  const existing = anchor.nextElementSibling?.classList?.contains("frame-top-five") ? anchor.nextElementSibling : null;
  if (existing && existing.dataset.frameTopPage === page) { topState = { page, status:"ready", request:topState.request }; return; }
  if (topState.page === page && topState.status === "loading") return;
  if (topState.page === page && topState.status === "ready") return;
  old.forEach(x => x.remove());
  const request = topState.request + 1; topState = { page, status:"loading", request };
  const { data: media, error } = await supabase.from("media").select("id,title,media_type,poster_url").limit(1000);
  if (request !== topState.request) return;
  if (error || !media?.length || !(home ? document.querySelector(".hero") : document.querySelector(".catalog"))) { topState.status = "idle"; return; }
  const { data: reviews } = await supabase.from("reviews").select("media_id").in("media_id", media.map(m => m.id));
  if (request !== topState.request) return;
  const counts = {}; (reviews || []).forEach(r => { counts[r.media_id] = (counts[r.media_id] || 0) + 1; });
  const top = media.map(m => ({ ...m, reviewCount: counts[m.id] || 0 })).filter(m => m.reviewCount > 0).sort((a,b) => b.reviewCount - a.reviewCount || a.title.localeCompare(b.title,"ru")).slice(0,5);
  if (!top.length) { topState.status = "ready"; return; }
  if (document.querySelector(`.frame-top-five[data-frame-top-page="${page}"]`)) { topState.status = "ready"; return; }
  const host = document.createElement("section"); host.className = "frame-top-five"; host.dataset.frameTopPage = page;
  host.innerHTML = `<div class="frame-top-head"><div><span>СООБЩЕСТВО</span><h2>ТОП 5 ПО КОЛИЧЕСТВУ РЕЦЕНЗИЙ</h2></div><p>Пять произведений, на которые сообщество оставило больше всего рецензий.</p></div><div class="frame-top-grid">${top.map((m,i) => `<button class="frame-top-item" data-work-id="${esc(m.id)}" type="button"><span class="frame-top-rank">${i+1}</span><span class="frame-top-poster">${m.poster_url ? `<img src="${esc(m.poster_url)}" alt=""/>` : `<b>99</b>`}</span><span class="frame-top-title">${esc(m.title)}</span><small>${typeLabels[m.media_type] || "Произведение"} · ${m.reviewCount} ${m.reviewCount === 1 ? "рецензия" : "рецензий"}</small><strong class="frame-top-action">ОЦЕНИТЬ →</strong></button>`).join("")}</div>`;
  anchor.insertAdjacentElement("afterend", host); topState.status = "ready";
  host.querySelectorAll("[data-work-id]").forEach(btn => btn.onclick = () => {
    const target = media.find(m => m.id === btn.dataset.workId); if (!target) return;
    const card = [...document.querySelectorAll(".catalog .work-card, .editorial-grid .work-card")].find(c => c.querySelector("h3")?.textContent?.trim() === target.title);
    if (card) { card.click(); window.setTimeout(() => document.querySelector(".work-hero .primary-action")?.click(), 350); return; }
    localStorage.setItem("frame99_rate_target", target.title);
    [...document.querySelectorAll(".nav button")].find(b => (b.textContent || "").trim() === "КАТАЛОГ")?.click();
  });
}

function consumeRateTarget() {
  const target = localStorage.getItem("frame99_rate_target"); if (!target || !document.querySelector(".catalog")) return;
  const card = [...document.querySelectorAll(".catalog .work-card")].find(c => c.querySelector("h3")?.textContent?.trim()?.toLowerCase() === target.toLowerCase());
  if (!card) return; localStorage.removeItem("frame99_rate_target"); card.click(); window.setTimeout(() => document.querySelector(".work-hero .primary-action")?.click(), 350);
}

function injectPosterControls(user) {
  const work = currentWork(); if (!work?.poster || work.poster.dataset.frameReady === "1") return;
  work.poster.dataset.frameReady = "1"; const admin = (user?.email || "").toLowerCase() === ADMIN_EMAIL, noPoster = !work.poster.querySelector(".poster-image");
  const wrap = document.createElement("div"); wrap.className = "frame-poster-actions";
  const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.className = "frame-hidden-file";
  const add = document.createElement("button"); add.type = "button"; add.className = "frame-poster-action"; add.textContent = admin ? (noPoster ? "ПОСТАВИТЬ ПОСТЕР" : "ИЗМЕНИТЬ ПОСТЕР") : (noPoster ? "ПРЕДЛОЖИТЬ ПОСТЕР" : "ПРЕДЛОЖИТЬ ДРУГОЙ ПОСТЕР");
  input.onchange = async () => { try { const src = await imageToDataUrl(input.files?.[0]); const media = await findWork(work.title, work.year); if (!media) throw new Error("Произведение не найдено в каталоге."); openPosterEditor({ source:src, mediaId:media.id, mode:admin ? "admin" : "proposal", userId:user?.id, refresh:()=>window.location.reload() }); } catch (e) { window.alert(e.message); } };
  add.onclick = () => input.click(); wrap.append(add,input);
  if (admin && !noPoster) { const del = document.createElement("button"); del.type="button"; del.className="frame-poster-action danger"; del.textContent="УДАЛИТЬ ПОСТЕР"; del.onclick=async e=>{e.stopPropagation(); const m=await findWork(work.title,work.year); if(!m)return; if(!window.confirm(`Удалить постер у «${m.title}»?`))return; const {error}=await supabase.rpc("admin_delete_poster",{p_media_id:m.id}); if(error)return window.alert(error.message); window.location.reload();}; wrap.append(del); }
  work.poster.appendChild(wrap);
}

async function adminProposals(user) {
  if ((user?.email || "").toLowerCase() !== ADMIN_EMAIL || !document.querySelector(".admin-page")) return;
  let host = document.querySelector(".frame-poster-proposals"); if (!host) { host=document.createElement("section"); host.className="admin-section frame-poster-proposals"; document.querySelector(".admin-page")?.appendChild(host); }
  const { data } = await supabase.from("poster_proposals").select("id,poster_url,created_at").eq("status","pending").order("created_at",{ascending:false});
  host.innerHTML = `<div class="section-head"><div><span>ПОСТЕРЫ</span><h2>ПРЕДЛОЖЕНИЯ ПОЛЬЗОВАТЕЛЕЙ</h2></div></div>${data?.length ? `<div class="frame-proposal-list">${data.map(p=>`<div class="frame-proposal"><img src="${esc(p.poster_url)}" alt=""/><div><b>Предложение постера</b><small>${new Date(p.created_at).toLocaleString("ru-RU")}</small></div></div>`).join("")}</div>` : `<div class="empty-state">Новых предложений нет.</div>`}`;
}

function scheduleRefresh(userRef) {
  clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { stylePlaceholders(); renderTopFive(); consumeRateTarget(); injectPosterControls(userRef.current); adminProposals(userRef.current); }, 80);
}

export default function Enhancements() {
  const userRef = useRef(null);
  useEffect(() => {
    let observerTimer;
    supabase.auth.getSession().then(({ data }) => { userRef.current = data.session?.user || null; scheduleRefresh(userRef); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { userRef.current = session?.user || null; topState = { page:null,status:"idle",request:topState.request+1 }; scheduleRefresh(userRef); });
    const observer = new MutationObserver(() => { clearTimeout(observerTimer); observerTimer = setTimeout(() => scheduleRefresh(userRef), 60); });
    observer.observe(document.body, { childList:true, subtree:true });
    const poll = setInterval(() => scheduleRefresh(userRef), 4000);
    return () => { sub.subscription.unsubscribe(); observer.disconnect(); clearInterval(poll); clearTimeout(observerTimer); };
  }, []);
  return null;
}
