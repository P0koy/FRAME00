import { supabase } from "./lib/supabase.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[ch]));
}

function openLogin() {
  const button = [...document.querySelectorAll("button")].find(b => /ВОЙТИ/.test(b.textContent || ""));
  button?.click();
}

async function goToProfile(nickname) {
  const target = String(nickname || "").trim();
  if (!target) return;
  localStorage.setItem("frame99_profile_target", target);
  const peopleButton = [...document.querySelectorAll(".nav button")].find(b => (b.textContent || "").trim() === "ЛЮДИ");
  peopleButton?.click();
  for (let i = 0; i < 20; i += 1) {
    await sleep(120);
    const input = document.querySelector(".people-page .search-wrap input");
    if (!input) continue;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, target);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(300);
    const exact = [...document.querySelectorAll(".people-grid .person-card")].find(card => {
      const name = card.querySelector("b")?.textContent?.trim().replace(/^@/, "");
      return name?.toLowerCase() === target.toLowerCase();
    });
    const first = exact || document.querySelector(".people-grid .person-card");
    if (first) {
      localStorage.removeItem("frame99_profile_target");
      first.click();
      return;
    }
  }
}

async function consumeProfileTarget() {
  const target = localStorage.getItem("frame99_profile_target");
  if (!target || !document.querySelector(".people-page")) return;
  await goToProfile(target);
}

function positionPosters(grid, reviewData) {
  const cards = [...grid.querySelectorAll(".review-card")];
  cards.forEach((card, index) => {
    if (card.dataset.frameReviewEnhanced === "1") return;
    const review = reviewData[index];
    if (!review) return;
    card.dataset.frameReviewEnhanced = "1";
    card.dataset.frameReviewId = review.id;
    const content = document.createElement("div");
    content.className = "frame-review-content";
    while (card.firstChild) content.appendChild(card.firstChild);
    card.appendChild(content);

    const media = review.media;
    const poster = document.createElement("button");
    poster.type = "button";
    poster.className = "frame-review-poster";
    poster.title = media?.title || "Произведение";
    poster.innerHTML = media?.poster_url
      ? `<img src="${escapeHtml(media.poster_url)}" alt="Постер" style="object-position:${Number(media.poster_position_x) || 50}% ${Number(media.poster_position_y) || 50}%"/>`
      : `<span>99</span>`;
    poster.onclick = e => {
      e.stopPropagation();
      const target = media?.title;
      if (!target) return;
      const workCard = [...document.querySelectorAll(".work-card")].find(el => el.textContent?.includes(target));
      workCard?.click();
    };
    card.appendChild(poster);

    const author = card.querySelector(".review-top div:nth-child(2) b");
    if (author && !author.dataset.frameAuthorLink) {
      const nickname = String(author.textContent || "").replace(/^@/, "").trim();
      author.dataset.frameAuthorLink = "1";
      author.classList.add("frame-review-author-link");
      author.title = "Открыть профиль";
      author.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        goToProfile(nickname);
      };
    }
  });
}

async function enhanceReviews() {
  const grids = [...document.querySelectorAll(".review-grid")];
  if (!grids.length) return;
  const [{ data: reviews }, sessionResult] = await Promise.all([
    supabase.from("reviews").select("id,rating_id,user_id,media_id,body,created_at").order("created_at", { ascending: false }).limit(40),
    supabase.auth.getSession()
  ]);
  const rows = reviews || [];
  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  const mediaIds = [...new Set(rows.map(r => r.media_id).filter(Boolean))];
  const [{ data: profiles }, { data: media }, { data: likes }] = await Promise.all([
    ids.length ? supabase.from("profiles").select("id,nickname,avatar_url").in("id", ids) : Promise.resolve({ data: [] }),
    mediaIds.length ? supabase.from("media").select("id,title,poster_url,poster_position_x,poster_position_y").in("id", mediaIds) : Promise.resolve({ data: [] }),
    rows.length ? supabase.from("review_likes").select("review_id,user_id").in("review_id", rows.map(r => r.id)) : Promise.resolve({ data: [] })
  ]);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  const mediaMap = Object.fromEntries((media || []).map(m => [m.id, m]));
  const reviewData = rows.map(r => ({ ...r, profiles: profileMap[r.user_id] || null, media: mediaMap[r.media_id] || null }));
  const session = sessionResult.data?.session || null;
  const likeRows = likes || [];
  const byReview = {};
  likeRows.forEach(l => { (byReview[l.review_id] ||= []).push(l.user_id); });

  grids.forEach(grid => positionPosters(grid, reviewData));

  document.querySelectorAll(".review-card[data-frame-review-id]").forEach(card => {
    const reviewId = card.dataset.frameReviewId;
    if (card.dataset.frameLikeReady === "1") return;
    card.dataset.frameLikeReady = "1";
    const idsForReview = byReview[reviewId] || [];
    const currentLiked = Boolean(session?.user?.id && idsForReview.includes(session.user.id));
    const likeWrap = document.createElement("div");
    likeWrap.className = "frame-review-like-wrap";
    const likeButton = document.createElement("button");
    likeButton.type = "button";
    likeButton.className = `frame-review-like${currentLiked ? " is-liked" : ""}`;
    likeButton.setAttribute("aria-label", currentLiked ? "Убрать лайк" : "Поставить лайк");
    likeButton.innerHTML = `<span class="frame-like-icon">♥</span><span class="frame-like-count">${idsForReview.length || ""}</span>`;
    const tip = document.createElement("div");
    tip.className = "frame-like-tooltip";
    tip.innerHTML = `<div>КТО ЛАЙКНУЛ</div><span>Наведи для просмотра</span>`;
    likeWrap.append(likeButton, tip);
    card.querySelector(".frame-review-content")?.appendChild(likeWrap);

    let hoverLoaded = false;
    const loadNames = async () => {
      if (hoverLoaded) return;
      hoverLoaded = true;
      const userIds = byReview[reviewId] || [];
      if (!userIds.length) {
        tip.innerHTML = `<div>КТО ЛАЙКНУЛ</div><span>Пока никто</span>`;
        return;
      }
      const { data: ps } = await supabase.from("profiles").select("id,nickname").in("id", userIds);
      const names = (userIds.map(id => (ps || []).find(p => p.id === id)?.nickname).filter(Boolean));
      tip.innerHTML = `<div>КТО ЛАЙКНУЛ</div>${names.length ? names.map(n => `<span>@${escapeHtml(n)}</span>`).join("") : `<span>Пользователи</span>`}`;
    };
    likeWrap.addEventListener("mouseenter", loadNames);

    likeButton.onclick = async e => {
      e.stopPropagation();
      const currentSession = (await supabase.auth.getSession()).data?.session;
      if (!currentSession?.user) return openLogin();
      likeButton.disabled = true;
      const existing = await supabase.from("review_likes").select("review_id,user_id").eq("review_id", reviewId).eq("user_id", currentSession.user.id).maybeSingle();
      try {
        if (existing.data) {
          const { error } = await supabase.from("review_likes").delete().eq("review_id", reviewId).eq("user_id", currentSession.user.id);
          if (error) throw error;
          likeButton.classList.remove("is-liked");
        } else {
          const { error } = await supabase.from("review_likes").insert({ review_id: reviewId, user_id: currentSession.user.id });
          if (error) throw error;
          likeButton.classList.add("is-liked");
        }
        const { count } = await supabase.from("review_likes").select("review_id", { count: "exact", head: true }).eq("review_id", reviewId);
        const countEl = likeButton.querySelector(".frame-like-count");
        if (countEl) countEl.textContent = count ? String(count) : "";
        hoverLoaded = false;
      } catch (err) {
        window.alert(err.message || "Не удалось изменить лайк.");
      } finally {
        likeButton.disabled = false;
      }
    };
  });
}

function removeRoundNote() {
  document.querySelectorAll(".method-note").forEach(el => el.remove());
}

let timer = null;
export function runReviewEnhancements() {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    removeRoundNote();
    enhanceReviews();
    consumeProfileTarget();
  }, 180);
}
