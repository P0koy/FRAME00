import { supabase } from "./lib/supabase.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function esc(value = "") { return String(value).replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])); }
function openLogin(){ [...document.querySelectorAll("button")].find(b => /ВОЙТИ/.test(b.textContent || ""))?.click(); }
async function goToProfile(nickname){
  const target=String(nickname||"").trim(); if(!target)return;
  localStorage.setItem("frame99_profile_target",target);
  [...document.querySelectorAll(".nav button")].find(b=>(b.textContent||"").trim()==="ЛЮДИ")?.click();
  for(let i=0;i<20;i++){await sleep(120);const input=document.querySelector(".people-page .search-wrap input");if(!input)continue;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;setter?.call(input,target);input.dispatchEvent(new Event("input",{bubbles:true}));await sleep(300);const exact=[...document.querySelectorAll(".people-grid .person-card")].find(c=>(c.querySelector("b")?.textContent||"").replace(/^@/,"").trim().toLowerCase()===target.toLowerCase());const card=exact||document.querySelector(".people-grid .person-card");if(card){localStorage.removeItem("frame99_profile_target");card.click();return;}}
}
async function consumeProfileTarget(){const target=localStorage.getItem("frame99_profile_target");if(target&&document.querySelector(".people-page"))await goToProfile(target);}

function enhanceCards(grid, rows, mediaMap, likeMap, session){
  [...grid.querySelectorAll(".review-card")].forEach((card,index)=>{
    const review=rows[index]; if(!review)return;
    if(card.dataset.frameReviewReady==="1")return;
    card.dataset.frameReviewReady="1"; card.dataset.frameReviewId=review.id;

    const media=mediaMap[review.media_id];
    // The poster is an element INSIDE the review card, filling the right placeholder area.
    const poster=document.createElement("button");
    poster.type="button"; poster.className="frame-review-poster-slot";
    poster.title=media?.title||"Открыть произведение";
    poster.innerHTML=media?.poster_url?`<img src="${esc(media.poster_url)}" alt="Постер"/>`:`<span>99</span>`;
    poster.onclick=e=>{
      e.stopPropagation();
      if(!media?.title)return;
      localStorage.setItem("frame99_rate_target",media.title);
      [...document.querySelectorAll(".nav button")].find(b=>(b.textContent||"").trim()==="КАТАЛОГ")?.click();
    };
    card.appendChild(poster);

    const author=card.querySelector(".review-top div:nth-child(2) b");
    if(author&&!author.dataset.frameAuthorLink){
      const nickname=(author.textContent||"").replace(/^@/,"").trim(); author.dataset.frameAuthorLink="1"; author.classList.add("frame-review-author-link"); author.title="Открыть профиль";
      author.onclick=e=>{e.preventDefault();e.stopPropagation();goToProfile(nickname)};
    }

    const ids=likeMap[review.id]||[]; const liked=Boolean(session?.user?.id&&ids.includes(session.user.id));
    const wrap=document.createElement("div"); wrap.className="frame-review-like-wrap";
    const button=document.createElement("button"); button.type="button"; button.className=`frame-review-like${liked?" is-liked":""}`; button.setAttribute("aria-label",liked?"Убрать лайк":"Поставить лайк");
    button.innerHTML=`<span class="frame-like-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 40S7 29.7 4.8 18.1C3.4 10.7 8.3 5.3 15 5.3c4.5 0 7.5 2.4 9 6 1.5-3.6 4.5-6 9-6 6.7 0 11.6 5.4 10.2 12.8C41 29.7 24 40 24 40Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg></span><span class="frame-like-count">${ids.length||""}</span>`;
    const tip=document.createElement("div"); tip.className="frame-like-tooltip"; tip.innerHTML=`<div>КТО ЛАЙКНУЛ</div><span>Наведите, чтобы посмотреть</span>`;
    wrap.append(button,tip); card.appendChild(wrap);
    let hoverLoaded=false;
    wrap.addEventListener("mouseenter",async()=>{if(hoverLoaded)return;hoverLoaded=true;const userIds=likeMap[review.id]||[];if(!userIds.length){tip.innerHTML=`<div>КТО ЛАЙКНУЛ</div><span>Пока никто</span>`;return;}const {data}=await supabase.from("profiles").select("id,nickname").in("id",userIds);const names=userIds.map(id=>(data||[]).find(p=>p.id===id)?.nickname).filter(Boolean);tip.innerHTML=`<div>КТО ЛАЙКНУЛ</div>${names.length?names.map(n=>`<span>@${esc(n)}</span>`).join(""):"<span>Пользователи</span>"}`});
    button.onclick=async e=>{e.stopPropagation();const current=(await supabase.auth.getSession()).data?.session;if(!current?.user){openLogin();return;}button.disabled=true;try{const existing=await supabase.from("review_likes").select("review_id,user_id").eq("review_id",review.id).eq("user_id",current.user.id).maybeSingle();if(existing.data){const {error}=await supabase.from("review_likes").delete().eq("review_id",review.id).eq("user_id",current.user.id);if(error)throw error;button.classList.remove("is-liked")}else{const {error}=await supabase.from("review_likes").insert({review_id:review.id,user_id:current.user.id});if(error)throw error;button.classList.add("is-liked")}const {count}=await supabase.from("review_likes").select("review_id",{count:"exact",head:true}).eq("review_id",review.id);button.querySelector(".frame-like-count").textContent=count?String(count):"";hoverLoaded=false}catch(err){window.alert(err.message||"Не удалось изменить лайк.")}finally{button.disabled=false}};
  });
}

async function enhanceReviews(){
  const grids=[...document.querySelectorAll(".review-grid")]; if(!grids.length)return;
  const [{data:reviews},sessionResult]=await Promise.all([supabase.from("reviews").select("id,rating_id,user_id,media_id,body,created_at").order("created_at",{ascending:false}).limit(40),supabase.auth.getSession()]);
  const rows=reviews||[], userIds=[...new Set(rows.map(r=>r.user_id).filter(Boolean))], mediaIds=[...new Set(rows.map(r=>r.media_id).filter(Boolean))];
  const [{data:profiles},{data:media},{data:likes}]=await Promise.all([userIds.length?supabase.from("profiles").select("id,nickname,avatar_url").in("id",userIds):Promise.resolve({data:[]}),mediaIds.length?supabase.from("media").select("id,title,poster_url").in("id",mediaIds):Promise.resolve({data:[]}),rows.length?supabase.from("review_likes").select("review_id,user_id").in("review_id",rows.map(r=>r.id)):Promise.resolve({data:[]})]);
  const profilesById=Object.fromEntries((profiles||[]).map(p=>[p.id,p])),mediaMap=Object.fromEntries((media||[]).map(m=>[m.id,m])),likeMap={};(likes||[]).forEach(l=>(likeMap[l.review_id]||=[]).push(l.user_id));
  const hydrated=rows.map(r=>({...r,profiles:profilesById[r.user_id]}));
  grids.forEach(g=>enhanceCards(g,hydrated,mediaMap,likeMap,sessionResult.data?.session||null));
}
function removeRoundNote(){document.querySelectorAll(".method-note").forEach(el=>el.remove())}
let timer=null;
export function runReviewEnhancements(){clearTimeout(timer);timer=setTimeout(()=>{removeRoundNote();enhanceReviews();consumeProfileTarget()},180)}
