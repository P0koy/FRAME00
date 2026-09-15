import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import "./enhancements.css";

const ADMIN_EMAIL = "kanshoev.amika@gmail.com";
const typeLabels = { film: "Фильм", series: "Сериал", anime: "Аниме" };

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Выберите файл изображения."));
    if (file.size > 10 * 1024 * 1024) return reject(new Error("Изображение слишком большое. Максимум 10 МБ."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.88));
      };
      img.onerror = () => reject(new Error("Этот формат изображения не удалось прочитать браузером."));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось подготовить изображение для обрезки."));
    img.src = src;
  });
}

async function cropToPoster(src, positionX = 50, positionY = 50, zoom = 1) {
  if (!src) return "";
  const img = await loadImage(src);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const targetW = 700;
  const targetH = 1050;
  const targetRatio = targetW / targetH;
  const imageRatio = iw / ih;
  let cropW;
  let cropH;
  if (imageRatio > targetRatio) {
    cropH = ih;
    cropW = ih * targetRatio;
  } else {
    cropW = iw;
    cropH = iw / targetRatio;
  }
  const safeZoom = Math.max(1, Math.min(2.4, Number(zoom) || 1));
  cropW = Math.max(2, Math.min(iw, cropW / safeZoom));
  cropH = Math.max(2, Math.min(ih, cropH / safeZoom));
  const px = Math.max(0, Math.min(100, Number(positionX) || 50)) / 100;
  const py = Math.max(0, Math.min(100, Number(positionY) || 50)) / 100;
  const sx = Math.max(0, Math.min(iw - cropW, px * (iw - cropW)));
  const sy = Math.max(0, Math.min(ih - cropH, py * (ih - cropH)));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/webp", 0.9);
}

function findWorkId(title, year) {
  return supabase.from("media").select("id,title,release_year,poster_url,poster_position_x,poster_position_y").eq("title", title).maybeSingle().then(async r => {
    if (r.data) return r.data;
    const q = await supabase.from("media").select("id,title,release_year,poster_url,poster_position_x,poster_position_y").ilike("title", title).limit(5);
    return (q.data || []).find(x => !year || Number(x.release_year) === Number(year)) || null;
  });
}

function getCurrentWorkFromDom() {
  const hero = document.querySelector(".work-hero");
  if (!hero) return null;
  const h1 = hero.querySelector(".work-info h1");
  if (!h1) return null;
  const eyebrow = hero.querySelector(".work-info .eyebrow")?.textContent || "";
  const match = eyebrow.match(/·\s*(\d{4})/);
  return { title: h1.textContent.trim(), year: match?.[1] || null, poster: hero.querySelector(":scope > .poster") };
}

function openPosterEditor({ dataUrl, existingSrc = "", title, mode, mediaId, userId, refresh }) {
  const overlay = document.createElement("div");
  overlay.className = "frame-poster-editor-overlay";
  overlay.innerHTML = `
    <div class="frame-poster-editor">
      <button class="frame-editor-close" type="button">×</button>
      <div class="frame-editor-kicker">FRAME99 · ${mode === "admin" ? "АДМИН" : "ПРЕДЛОЖЕНИЕ"}</div>
      <h2>ОБРЕЗАТЬ ПОСТЕР</h2>
      <p class="frame-editor-help">Сразу видно финальный вид постера. Перетаскивай изображение, чтобы выбрать кадр, и меняй масштаб для точной обрезки.</p>
      <div class="frame-editor-preview-row"><div class="frame-editor-crop-wrap"><span>ФИНАЛЬНЫЙ КАДР 2:3</span><div class="frame-editor-stage"><img alt="Предпросмотр постера" /></div></div></div>
      <div class="frame-editor-controls"><label>МАСШТАБ <strong data-zoom-value>100%</strong><input data-zoom type="range" min="100" max="240" step="1" value="100" /></label></div>
      <div class="frame-editor-actions"><button class="frame-editor-button secondary" type="button" data-reset>ЦЕНТРИРОВАТЬ</button><button class="frame-editor-button primary" type="button" data-save>${mode === "admin" ? "СОХРАНИТЬ ПОСТЕР" : "ОТПРАВИТЬ ПРЕДЛОЖЕНИЕ"}</button></div>
      <p class="frame-editor-message"></p>
    </div>`;
  document.body.appendChild(overlay);
  const img = overlay.querySelector("img");
  const stage = overlay.querySelector(".frame-editor-stage");
  const zoomInput = overlay.querySelector("[data-zoom]");
  const zoomValue = overlay.querySelector("[data-zoom-value]");
  const msg = overlay.querySelector(".frame-editor-message");
  const initialSrc = dataUrl || existingSrc;
  img.src = initialSrc || "";
  let x = 50, y = 50, zoom = 1;
  const render = () => { img.style.transformOrigin = `${x}% ${y}%`; img.style.transform = `scale(${zoom})`; zoomValue.textContent = `${Math.round(zoom * 100)}%`; };
  render();
  const close = () => overlay.remove();
  overlay.querySelector(".frame-editor-close").onclick = close;
  overlay.querySelector("[data-reset]").onclick = () => { x = 50; y = 50; zoom = 1; zoomInput.value = "100"; render(); };
  zoomInput.oninput = () => { zoom = Math.max(1, Number(zoomInput.value) / 100); render(); };
  let dragging = false, sx = 0, sy = 0, ox = 50, oy = 50;
  stage.addEventListener("pointerdown", e => { dragging = true; stage.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = x; oy = y; });
  stage.addEventListener("pointermove", e => { if (!dragging) return; x = Math.max(0, Math.min(100, ox - ((e.clientX - sx) / Math.max(1, stage.clientWidth)) * 100)); y = Math.max(0, Math.min(100, oy - ((e.clientY - sy) / Math.max(1, stage.clientHeight)) * 100)); render(); });
  stage.addEventListener("pointerup", () => { dragging = false; });
  stage.addEventListener("pointercancel", () => { dragging = false; });
  overlay.querySelector("[data-save]").onclick = async () => {
    const button = overlay.querySelector("[data-save]");
    button.disabled = true; msg.textContent = "ГОТОВИМ ФИНАЛЬНЫЙ ПОСТЕР…";
    try {
      const source = dataUrl || existingSrc;
      if (!source) throw new Error("Сначала выберите изображение.");
      const cropped = await cropToPoster(source, x, y, zoom);
      if (mode === "admin") {
        const { data, error } = await supabase.rpc("admin_update_media_poster", { p_media_id: mediaId, p_poster_url: cropped, p_position_x: 50, p_position_y: 50 });
        if (error) throw error;
        refresh?.(data || { poster_url: cropped, poster_position_x: 50, poster_position_y: 50 });
        msg.textContent = "Постер сохранён.";
        setTimeout(close, 500);
      } else {
        const { error } = await supabase.from("poster_proposals").insert({ media_id: mediaId, user_id: userId, poster_url: cropped, position_x: 50, position_y: 50 });
        if (error) throw error;
        msg.textContent = "Предложение отправлено администратору.";
        setTimeout(close, 700);
      }
    } catch (e) { msg.textContent = e.message || "Не удалось сохранить постер."; button.disabled = false; }
  };
}

function injectPosterButton(user, isAdmin, refresh) {
  const current = getCurrentWorkFromDom();
  if (!current?.poster || current.poster.dataset.framePosterReady === "1") return;
  current.poster.dataset.framePosterReady = "1";
  const noPoster = !current.poster.querySelector(".poster-image");
  const wrap = document.createElement("div"); wrap.className = "frame-poster-actions";
  const pick = document.createElement("input"); pick.type = "file"; pick.accept = "image/*"; pick.className = "frame-hidden-file";
  const button = document.createElement("button"); button.type = "button"; button.className = "frame-poster-action"; button.textContent = isAdmin ? (noPoster ? "ПОСТАВИТЬ ПОСТЕР" : "ИЗМЕНИТЬ ПОСТЕР") : (noPoster ? "ПРЕДЛОЖИТЬ ПОСТЕР" : "ПРЕДЛОЖИТЬ ДРУГОЙ ПОСТЕР");
  const deleteButton = document.createElement("button"); deleteButton.type = "button"; deleteButton.className = "frame-poster-action danger"; deleteButton.textContent = "УДАЛИТЬ ПОСТЕР";
  pick.onchange = async () => { try { const dataUrl = await imageToDataUrl(pick.files?.[0]); const media = await findWorkId(current.title, current.year); if (!media) throw new Error("Произведение не найдено в каталоге."); openPosterEditor({ dataUrl, existingSrc: media.poster_url || "", title: current.title, mode: isAdmin ? "admin" : "proposal", mediaId: media.id, userId: user?.id, refresh }); } catch (e) { window.alert(e.message || "Не удалось обработать изображение."); } };
  button.onclick = () => pick.click(); wrap.append(button, pick);
  if (isAdmin && !noPoster) { deleteButton.onclick = async e => { e.stopPropagation(); const media = await findWorkId(current.title, current.year); if (!media) return; if (!window.confirm(`Удалить постер у «${media.title}»?`)) return; const { error } = await supabase.rpc("admin_delete_poster", { p_media_id: media.id }); if (error) return window.alert(error.message); refresh?.({ poster_url: null, poster_position_x: 50, poster_position_y: 50 }); }; wrap.append(deleteButton); }
  if (isAdmin) { const manage = document.createElement("button"); manage.type = "button"; manage.className = "frame-poster-action ghost"; manage.textContent = "ВЫБРАТЬ ФОТО"; manage.onclick = () => pick.click(); wrap.append(manage); }
  current.poster.appendChild(wrap);
}

function stylePlaceholders() { document.querySelectorAll(".placeholder-poster").forEach(el => { const mark = el.querySelector(".poster-mark"); const small = el.querySelector("small"); if (mark) mark.textContent = "99"; if (small) small.textContent = "FRAME99"; el.classList.add("frame99-placeholder"); }); }

let topFiveRequest = 0;
async function renderTopFive() {
  const isHome = Boolean(document.querySelector(".hero"));
  const isCatalog = Boolean(document.querySelector(".catalog"));
  const old = document.querySelectorAll(".frame-top-five");
  if (!isHome && !isCatalog) { old.forEach(el => el.remove()); return; }
  const pageKey = isHome ? "home" : "catalog";
  const anchor = isHome ? document.querySelector(".hero") : document.querySelector(".catalog-head");
  if (!anchor) return;
  if (anchor.nextElementSibling?.classList?.contains("frame-top-five") && anchor.nextElementSibling.dataset.frameTopPage === pageKey) return;
  if (document.querySelector(`.frame-top-five[data-frame-top-page="${pageKey}"]`)) return;
  old.forEach(el => el.remove());
  const requestId = ++topFiveRequest;
  const { data: media } = await supabase.from("media").select("id,title,original_title,media_type,release_year,poster_url").limit(1000);
  if (requestId !== topFiveRequest) return;
  if (!document.querySelector(isHome ? ".hero" : ".catalog") || !media?.length) return;
  const ids = media.map(m => m.id);
  const { data: reviews } = await supabase.from("reviews").select("media_id").in("media_id", ids);
  if (requestId !== topFiveRequest) return;
  const counts = {};
  (reviews || []).forEach(r => { counts[r.media_id] = (counts[r.media_id] || 0) + 1; });
  const top = media.map(m => ({ ...m, reviewCount: counts[m.id] || 0 })).filter(m => m.reviewCount > 0).sort((a,b) => b.reviewCount-a.reviewCount || a.title.localeCompare(b.title, "ru")).slice(0,5);
  if (!top.length || !document.querySelector(isHome ? ".hero" : ".catalog")) return;
  const host = document.createElement("section"); host.className = "frame-top-five"; host.dataset.frameTopPage = pageKey;
  host.innerHTML = `<div class="frame-top-head"><div><span>СООБЩЕСТВО</span><h2>ТОП 5 ПО КОЛИЧЕСТВУ РЕЦЕНЗИЙ</h2></div><p>Пять произведений, на которые сообщество оставило больше всего рецензий.</p></div><div class="frame-top-grid">${top.map((m,i)=>`<button class="frame-top-item" data-work-id="${m.id}" type="button"><span class="frame-top-rank">${i+1}</span><span class="frame-top-poster">${m.poster_url ? `<img src="${m.poster_url}" alt=""/>` : `<b>99</b>`}</span><span class="frame-top-title">${String(m.title||"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]))}</span><small>${typeLabels[m.media_type]||"Произведение"} · ${m.reviewCount} ${m.reviewCount===1?"рецензия":"рецензий"}</small><strong class="frame-top-action">ОЦЕНИТЬ →</strong></button>`).join("")}</div>`;
  anchor.insertAdjacentElement("afterend", host);
  host.querySelectorAll("[data-work-id]").forEach(btn => btn.addEventListener("click", () => openAndRate(btn.dataset.workId)));
}

async function openAndRate(workId) {
  const work = await supabase.from("media").select("id,title,original_title,media_type,release_year,poster_url").eq("id", workId).maybeSingle();
  if (!work.data) return;
  const card = [...document.querySelectorAll(".catalog .work-card, .editorial-grid .work-card")].find(c => c.querySelector("h3")?.textContent?.trim() === work.data.title);
  if (card) { card.click(); setTimeout(() => document.querySelector(".work-hero .primary-action")?.click(), 300); return; }
  localStorage.setItem("frame99_rate_target", work.data.title);
  [...document.querySelectorAll(".nav button")].find(b => (b.textContent || "").trim() === "КАТАЛОГ")?.click();
}

async function consumeRateTarget() {
  const target = localStorage.getItem("frame99_rate_target");
  if (!target || !document.querySelector(".catalog")) return;
  const exact = [...document.querySelectorAll(".catalog .work-card")].find(c => c.querySelector("h3")?.textContent?.trim()?.toLowerCase() === target.toLowerCase());
  if (exact) { localStorage.removeItem("frame99_rate_target"); exact.click(); setTimeout(() => document.querySelector(".work-hero .primary-action")?.click(), 300); }
}

function adminCatalogControls(user) { if ((user?.email||"").toLowerCase()!==ADMIN_EMAIL)return; document.querySelectorAll(".work-card").forEach(card=>{if(card.dataset.frameAdminReady==="1")return; const title=card.querySelector("h3")?.textContent?.trim(); const eyebrow=card.querySelector(".eyebrow")?.textContent||""; const year=eyebrow.match(/·\s*(\d{4})/)?.[1]||null;if(!title)return;card.dataset.frameAdminReady="1";const bar=document.createElement("div");bar.className="frame-admin-card-actions";const edit=document.createElement("button");edit.type="button";edit.textContent="ПОСТЕР";const del=document.createElement("button");del.type="button";del.textContent="УДАЛИТЬ";const stop=e=>e.stopPropagation();edit.onclick=async e=>{stop(e);const m=await findWorkId(title,year);if(!m)return window.alert("Произведение не найдено.");const input=document.createElement("input");input.type="file";input.accept="image/*";input.onchange=async()=>{try{const d=await imageToDataUrl(input.files?.[0]);openPosterEditor({dataUrl:d,existingSrc:m.poster_url||"",title,mode:"admin",mediaId:m.id,userId:user.id,refresh:()=>window.location.reload()});}catch(err){window.alert(err.message)}};input.click();};del.onclick=async e=>{stop(e);const m=await findWorkId(title,year);if(!m)return;if(!window.confirm(`Удалить «${m.title}» из каталога вместе с оценками и рецензиями?`))return;const {error}=await supabase.rpc("admin_delete_media",{p_media_id:m.id});if(error)return window.alert(error.message);card.remove();};bar.append(edit,del);card.appendChild(bar);});}

async function adminProposals(user) { if ((user?.email||"").toLowerCase()!==ADMIN_EMAIL||!document.querySelector(".admin-page"))return;let host=document.querySelector(".frame-poster-proposals");if(!host){host=document.createElement("section");host.className="admin-section frame-poster-proposals";document.querySelector(".admin-page")?.appendChild(host);}const {data:proposals}=await supabase.from("poster_proposals").select("id,media_id,user_id,poster_url,position_x,position_y,status,created_at").eq("status","pending").order("created_at",{ascending:false});host.innerHTML=`<div class="section-head"><div><span>ПОСТЕРЫ</span><h2>ПРЕДЛОЖЕНИЯ ПОЛЬЗОВАТЕЛЕЙ</h2></div></div>${proposals?.length?`<div class="frame-proposal-list">${proposals.map(p=>`<div class="frame-proposal"><img src="${p.poster_url}" alt=""/><div><b>Предложение постера</b><small>${new Date(p.created_at).toLocaleString("ru-RU")}</small><div class="frame-proposal-actions"><button data-approve="${p.id}">ПРИНЯТЬ</button><button data-reject="${p.id}">ОТКЛОНИТЬ</button></div></div></div>`).join("")}</div>`:`<div class="empty-state">Новых предложений нет.</div>`}`;host.querySelectorAll("[data-approve],[data-reject]").forEach(btn=>btn.onclick=async()=>{const {error}=await supabase.rpc("admin_review_poster_proposal",{p_proposal_id:btn.dataset.approve||btn.dataset.reject,p_approve:Boolean(btn.dataset.approve)});if(error)window.alert(error.message);else adminProposals(user);});}

export default function Enhancements(){const userRef=useRef(null);const [user,setUser]=useState(null);const refresh=()=>window.setTimeout(()=>{stylePlaceholders();renderTopFive();adminCatalogControls(userRef.current);injectPosterButton(userRef.current,(userRef.current?.email||"").toLowerCase()===ADMIN_EMAIL,data=>{const poster=document.querySelector(".work-hero>.poster");if(!poster)return;if(data?.poster_url)poster.innerHTML=`<img class="poster-image" src="${data.poster_url}" alt="Постер"/>`;else poster.innerHTML=`<div class="poster placeholder-poster frame99-placeholder"><span class="poster-index">FRAME99</span><span class="poster-mark">99</span><small>FRAME99</small></div>`;poster.dataset.framePosterReady="";injectPosterButton(userRef.current,(userRef.current?.email||"").toLowerCase()===ADMIN_EMAIL,refresh);});adminProposals(userRef.current);consumeRateTarget();},150);
 useEffect(()=>{let timer;supabase.auth.getSession().then(({data})=>{userRef.current=data.session?.user||null;setUser(userRef.current);refresh();});const {data:sub}=supabase.auth.onAuthStateChange((_e,session)=>{userRef.current=session?.user||null;setUser(userRef.current);refresh();});const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{stylePlaceholders();adminCatalogControls(userRef.current);injectPosterButton(userRef.current,(userRef.current?.email||"").toLowerCase()===ADMIN_EMAIL,refresh);consumeRateTarget();},140);});observer.observe(document.body,{childList:true,subtree:true});const poll=window.setInterval(refresh,5000);return()=>{sub.subscription.unsubscribe();observer.disconnect();clearInterval(poll);clearTimeout(timer)};},[]);return null;}
