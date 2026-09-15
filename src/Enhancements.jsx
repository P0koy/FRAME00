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
        resolve(canvas.toDataURL("image/webp", 0.84));
      };
      img.onerror = () => reject(new Error("Этот формат изображения не удалось прочитать браузером."));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
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

function openPosterEditor({ dataUrl, existingSrc = "", positionX = 50, positionY = 50, title, mode, mediaId, userId, refresh }) {
  const overlay = document.createElement("div");
  overlay.className = "frame-poster-editor-overlay";
  overlay.innerHTML = `
    <div class="frame-poster-editor">
      <button class="frame-editor-close" type="button">×</button>
      <div class="frame-editor-kicker">FRAME99 · ${mode === "admin" ? "АДМИН" : "ПРЕДЛОЖЕНИЕ"}</div>
      <h2>НАСТРОИТЬ ПОСТЕР</h2>
      <p class="frame-editor-help">Перетаскивай изображение внутри рамки. Так выбирается, какая часть картинки будет показана на постере.</p>
      <div class="frame-editor-stage"><img alt="Предпросмотр" /></div>
      <div class="frame-editor-actions">
        <button class="frame-editor-button secondary" type="button" data-reset>ЦЕНТР</button>
        <button class="frame-editor-button primary" type="button" data-save>${mode === "admin" ? "СОХРАНИТЬ ПОСТЕР" : "ОТПРАВИТЬ ПРЕДЛОЖЕНИЕ"}</button>
      </div>
      <p class="frame-editor-message"></p>
    </div>`;
  document.body.appendChild(overlay);
  const img = overlay.querySelector("img");
  const stage = overlay.querySelector(".frame-editor-stage");
  const msg = overlay.querySelector(".frame-editor-message");
  const initialSrc = dataUrl || existingSrc;
  img.src = initialSrc || "";
  let x = Number(positionX) || 50, y = Number(positionY) || 50;
  const render = () => { img.style.objectPosition = `${x}% ${y}%`; };
  render();
  const close = () => overlay.remove();
  overlay.querySelector(".frame-editor-close").onclick = close;
  overlay.querySelector("[data-reset]").onclick = () => { x = 50; y = 50; render(); };
  let dragging = false, sx = 0, sy = 0, ox = x, oy = y;
  stage.addEventListener("pointerdown", e => { dragging = true; stage.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = x; oy = y; });
  stage.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = (e.clientX - sx) / stage.clientWidth * 100;
    const dy = (e.clientY - sy) / stage.clientHeight * 100;
    x = Math.max(0, Math.min(100, ox - dx));
    y = Math.max(0, Math.min(100, oy - dy));
    render();
  });
  stage.addEventListener("pointerup", () => { dragging = false; });
  overlay.querySelector("[data-save]").onclick = async () => {
    const button = overlay.querySelector("[data-save]");
    button.disabled = true; msg.textContent = "СОХРАНЕНИЕ…";
    try {
      if (mode === "admin") {
        const { data, error } = await supabase.rpc("admin_update_media_poster", { p_media_id: mediaId, p_poster_url: dataUrl || existingSrc, p_position_x: x, p_position_y: y });
        if (error) throw error;
        refresh?.(data || { poster_url: dataUrl || existingSrc, poster_position_x: x, poster_position_y: y });
        msg.textContent = "Постер сохранён.";
        setTimeout(close, 500);
      } else {
        const { error } = await supabase.from("poster_proposals").insert({ media_id: mediaId, user_id: userId, poster_url: dataUrl, position_x: x, position_y: y });
        if (error) throw error;
        msg.textContent = "Предложение отправлено администратору.";
        setTimeout(close, 700);
      }
    } catch (e) {
      msg.textContent = e.message || "Не удалось сохранить постер.";
      button.disabled = false;
    }
  };
}

function injectPosterButton(user, isAdmin, refresh) {
  const current = getCurrentWorkFromDom();
  if (!current?.poster || current.poster.dataset.framePosterReady === "1") return;
  current.poster.dataset.framePosterReady = "1";
  const noPoster = !current.poster.querySelector(".poster-image");
  const wrap = document.createElement("div");
  wrap.className = "frame-poster-actions";
  const pick = document.createElement("input");
  pick.type = "file"; pick.accept = "image/*"; pick.className = "frame-hidden-file";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "frame-poster-action";
  button.textContent = isAdmin ? (noPoster ? "ПОСТАВИТЬ ПОСТЕР" : "ИЗМЕНИТЬ ПОСТЕР") : (noPoster ? "ПРЕДЛОЖИТЬ ПОСТЕР" : "ПРЕДЛОЖИТЬ ДРУГОЙ ПОСТЕР");
  const deleteButton = document.createElement("button");
  deleteButton.type = "button"; deleteButton.className = "frame-poster-action danger"; deleteButton.textContent = "УДАЛИТЬ ПОСТЕР";
  pick.onchange = async () => {
    try {
      const dataUrl = await imageToDataUrl(pick.files?.[0]);
      const media = await findWorkId(current.title, current.year);
      if (!media) throw new Error("Произведение не найдено в каталоге.");
      openPosterEditor({ dataUrl, existingSrc: media.poster_url || "", positionX: media.poster_position_x, positionY: media.poster_position_y, title: current.title, mode: isAdmin ? "admin" : "proposal", mediaId: media.id, userId: user?.id, refresh });
    } catch (e) { window.alert(e.message || "Не удалось обработать изображение."); }
  };
  button.onclick = () => pick.click();
  wrap.append(button, pick);
  if (isAdmin && !noPoster) {
    deleteButton.onclick = async e => {
      e.stopPropagation();
      const media = await findWorkId(current.title, current.year);
      if (!media) return;
      if (!window.confirm(`Удалить постер у «${media.title}»?`)) return;
      const { error } = await supabase.rpc("admin_delete_poster", { p_media_id: media.id });
      if (error) return window.alert(error.message);
      refresh?.({ poster_url: null, poster_position_x: 50, poster_position_y: 50 });
    };
    wrap.append(deleteButton);
  }
  if (isAdmin) {
    const manage = document.createElement("button");
    manage.type = "button"; manage.className = "frame-poster-action ghost"; manage.textContent = "ВЫБРАТЬ ФОТО";
    manage.onclick = () => pick.click();
    wrap.append(manage);
  }
  current.poster.appendChild(wrap);
}

function stylePlaceholders() {
  document.querySelectorAll(".placeholder-poster").forEach(el => {
    const mark = el.querySelector(".poster-mark");
    const small = el.querySelector("small");
    if (mark) mark.textContent = "99";
    if (small) small.textContent = "FRAME99";
    el.classList.add("frame99-placeholder");
  });
}

async function renderTopFive() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  let host = document.querySelector(".frame-top-five");
  if (!host) { host = document.createElement("section"); host.className = "frame-top-five"; hero.insertAdjacentElement("afterend", host); }
  const { data: media } = await supabase.from("media").select("id,title,original_title,media_type,release_year,poster_url,poster_position_x,poster_position_y").limit(1000);
  if (!media?.length) { host.innerHTML = ""; return; }
  const ids = media.map(m => m.id);
  const [{ data: ratings }, { data: reviews }] = await Promise.all([
    supabase.from("ratings").select("media_id,final_score").in("media_id", ids),
    supabase.from("reviews").select("media_id").in("media_id", ids)
  ]);
  const rc = {}, wc = {}, sums = {};
  (ratings || []).forEach(r => { rc[r.media_id] = (rc[r.media_id] || 0) + 1; sums[r.media_id] = (sums[r.media_id] || 0) + Number(r.final_score || 0); });
  (reviews || []).forEach(r => { wc[r.media_id] = (wc[r.media_id] || 0) + 1; });
  const top = media.map(m => ({ ...m, ratingCount: rc[m.id] || 0, reviewCount: wc[m.id] || 0, avg: rc[m.id] ? sums[m.id] / rc[m.id] : 0, metric: (rc[m.id] || 0) + (wc[m.id] || 0) * 2 })).filter(x => x.metric > 0).sort((a,b) => b.metric-a.metric || b.ratingCount-a.ratingCount || b.reviewCount-a.reviewCount || b.avg-a.avg).slice(0,5);
  host.innerHTML = `<div class="frame-top-head"><div><span>СООБЩЕСТВО</span><h2>ТОП 5 ПО КОЛИЧЕСТВУ ОЦЕНОК И РЕЦЕНЗИЙ</h2></div><p>Считаются все оценки и рецензии. Рецензия весит в рейтинге сообщества вдвое сильнее обычной оценки.</p></div><div class="frame-top-grid">${top.map((m,i)=>`<button class="frame-top-item" data-work-id="${m.id}"><span class="frame-top-rank">${i+1}</span><span class="frame-top-poster">${m.poster_url ? `<img src="${m.poster_url}" style="object-position:${m.poster_position_x||50}% ${m.poster_position_y||50}%"/>` : `<b>99</b>`}</span><span class="frame-top-title">${m.title}</span><small>${typeLabels[m.media_type]||"Произведение"} · ${m.ratingCount} оценок · ${m.reviewCount} рец.</small></button>`).join("")}</div>`;
  host.querySelectorAll("[data-work-id]").forEach(btn => btn.addEventListener("click", () => {
    const work = media.find(m => m.id === btn.dataset.workId);
    const card = [...document.querySelectorAll(".work-card")].find(c => c.textContent.includes(work?.title));
    if (card) card.click();
  }));
}

function adminCatalogControls(user) {
  if ((user?.email || "").toLowerCase() !== ADMIN_EMAIL) return;
  document.querySelectorAll(".work-card").forEach(card => {
    if (card.dataset.frameAdminReady === "1") return;
    const title = card.querySelector("h3")?.textContent?.trim();
    const eyebrow = card.querySelector(".eyebrow")?.textContent || "";
    const year = eyebrow.match(/·\s*(\d{4})/)?.[1] || null;
    if (!title) return;
    card.dataset.frameAdminReady = "1";
    const bar = document.createElement("div"); bar.className = "frame-admin-card-actions";
    const edit = document.createElement("button"); edit.type="button"; edit.textContent="ПОСТЕР";
    const del = document.createElement("button"); del.type="button"; del.textContent="УДАЛИТЬ";
    const stop = e => e.stopPropagation(); edit.onclick = async e => { stop(e); const m=await findWorkId(title,year); if(!m)return window.alert("Произведение не найдено."); const input=document.createElement("input"); input.type="file"; input.accept="image/*"; input.onchange=async()=>{try{const d=await imageToDataUrl(input.files?.[0]);openPosterEditor({dataUrl:d,existingSrc:m.poster_url||"",positionX:m.poster_position_x,positionY:m.poster_position_y,title,mode:"admin",mediaId:m.id,userId:user.id,refresh:()=>window.location.reload()});}catch(err){window.alert(err.message)}};input.click();};
    del.onclick = async e => { stop(e); const m=await findWorkId(title,year); if(!m)return; if(!window.confirm(`Удалить «${m.title}» из каталога вместе с оценками и рецензиями?`))return; const {error}=await supabase.rpc("admin_delete_media",{p_media_id:m.id}); if(error)return window.alert(error.message); card.remove(); renderTopFive(); };
    bar.append(edit,del); card.appendChild(bar);
  });
}

async function adminProposals(user) {
  if ((user?.email || "").toLowerCase() !== ADMIN_EMAIL || !document.querySelector(".admin-page")) return;
  let host = document.querySelector(".frame-poster-proposals");
  if (!host) { host=document.createElement("section"); host.className="admin-section frame-poster-proposals"; document.querySelector(".admin-page")?.appendChild(host); }
  const {data: proposals} = await supabase.from("poster_proposals").select("id,media_id,user_id,poster_url,position_x,position_y,status,created_at").eq("status","pending").order("created_at",{ascending:false});
  host.innerHTML = `<div class="section-head"><div><span>ПОСТЕРЫ</span><h2>ПРЕДЛОЖЕНИЯ ПОЛЬЗОВАТЕЛЕЙ</h2></div></div>${proposals?.length ? `<div class="frame-proposal-list">${proposals.map(p=>`<div class="frame-proposal"><img src="${p.poster_url}" style="object-position:${p.position_x}% ${p.position_y}%"/><div><b>Предложение постера</b><small>${new Date(p.created_at).toLocaleString("ru-RU")}</small><div class="frame-proposal-actions"><button data-approve="${p.id}">ПРИНЯТЬ</button><button data-reject="${p.id}">ОТКЛОНИТЬ</button></div></div></div>`).join("")}</div>` : `<div class="empty-state">Новых предложений нет.</div>`}`;
  host.querySelectorAll("[data-approve], [data-reject]").forEach(btn=>btn.onclick=async()=>{const {error}=await supabase.rpc("admin_review_poster_proposal",{p_proposal_id:btn.dataset.approve||btn.dataset.reject,p_approve:Boolean(btn.dataset.approve)}); if(error)window.alert(error.message); else adminProposals(user);});
}

export default function Enhancements() {
  const userRef = useRef(null);
  const [user, setUser] = useState(null);
  const refresh = () => window.setTimeout(() => { stylePlaceholders(); renderTopFive(); adminCatalogControls(userRef.current); injectPosterButton(userRef.current, (userRef.current?.email || "").toLowerCase() === ADMIN_EMAIL, data => {
    const poster = document.querySelector(".work-hero>.poster");
    if (!poster) return;
    if (data?.poster_url) {
      poster.innerHTML = `<img class="poster-image" src="${data.poster_url}" alt="Постер" style="object-position:${data.poster_position_x||50}% ${data.poster_position_y||50}%"/>`;
    } else {
      poster.innerHTML = `<div class="poster placeholder-poster frame99-placeholder"><span class="poster-index">FRAME99</span><span class="poster-mark">99</span><small>FRAME99</small></div>`;
    }
    poster.dataset.framePosterReady = "";
    injectPosterButton(userRef.current, (userRef.current?.email || "").toLowerCase() === ADMIN_EMAIL, refresh);
  }); adminProposals(userRef.current); }, 150); 
  useEffect(() => {
    let timer;
    supabase.auth.getSession().then(({data}) => { userRef.current=data.session?.user||null; setUser(userRef.current); refresh(); });
    const {data: sub}=supabase.auth.onAuthStateChange((_e,session)=>{userRef.current=session?.user||null;setUser(userRef.current);refresh();});
    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{stylePlaceholders();renderTopFive();adminCatalogControls(userRef.current);injectPosterButton(userRef.current,(userRef.current?.email||"").toLowerCase()===ADMIN_EMAIL,refresh);},120)});
    observer.observe(document.body,{childList:true,subtree:true});
    const poll=window.setInterval(refresh,5000);
    return()=>{sub.subscription.unsubscribe();observer.disconnect();clearInterval(poll);clearTimeout(timer)};
  },[]);
  return null;
}
