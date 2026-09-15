import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Heart, Menu, Plus, Search, UserRound, X } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./styles.css";

const DEMO_WORKS = [
  { id: "demo-1", title: "ДЮНА", original_title: "Dune", release_year: 2021, media_type: "film", poster_url: "", country: "США", director: "Дени Вильнёв", duration_minutes: 155, score: 84, count: 12481, description: "Монументальная научно-фантастическая история о власти, вере, наследии и цене пророчества." },
  { id: "demo-2", title: "ИДЕАЛЬНАЯ ГРУСТЬ", original_title: "Perfect Blue", release_year: 1997, media_type: "anime", poster_url: "", country: "Япония", director: "Сатоси Кон", duration_minutes: 81, score: 91, count: 8904, description: "Психологический триллер, в котором монтаж превращает сомнение в физическое пространство." },
  { id: "demo-3", title: "РАЗДЕЛЕНИЕ", original_title: "Severance", release_year: 2022, media_type: "series", poster_url: "", country: "США", seasons: 2, score: 88, count: 10317, description: "История о людях, чьи рабочие и личные воспоминания разделены радикальной процедурой." },
  { id: "demo-4", title: "ПРОШЛЫЕ ЖИЗНИ", original_title: "Past Lives", release_year: 2023, media_type: "film", poster_url: "", country: "США", director: "Селин Сон", duration_minutes: 106, score: 77, count: 5266, description: "История о близости, времени и жизни, которая могла случиться иначе." },
];

const criteria = [
  { key: "content_score", short: "МАТЕРИАЛ", title: "МАТЕРИАЛ / СОДЕРЖАНИЕ", text: "Насколько последовательно и содержательно произведение работает со своим материалом." },
  { key: "composition_score", short: "КОМПОЗИЦИЯ", title: "КОМПОЗИЦИЯ / ТЕМП", text: "Как структура, ритм и длительность служат задаче произведения." },
  { key: "execution_score", short: "РЕАЛИЗАЦИЯ", title: "РЕАЛИЗАЦИЯ / ТЕХНИКА", text: "Насколько профессионально замысел воплощён выбранными средствами." },
  { key: "integrity_score", short: "ЦЕЛОСТНОСТЬ", title: "ЦЕЛОСТНОСТЬ / АВТОРСКИЙ ЯЗЫК", text: "Насколько форма, содержание, тон и художественные решения работают как единое целое." },
];

const levels = ["критически слабо", "очень слабо", "слабо", "ниже среднего", "средний уровень", "выше среднего", "сильно", "очень сильно", "выдающийся уровень", "почти эталонно"];
const typeLabels = { film: "Фильм", series: "Сериал", anime: "Аниме" };
const posterKinds = ["dune", "blue", "severance", "lives"];

const multiplier = impression => 1 + ((impression - 1) * 1.475) / 9;
const finalScore = (scores, impression) => Math.round(Object.values(scores).reduce((a, b) => a + b, 0) * multiplier(impression));
const mediaTypeLabel = type => typeLabels[type] || type || "Произведение";
const initials = name => (name || "U").trim().slice(0, 1).toUpperCase() || "U";

function titleForMedia(work) { return work?.title || "Без названия"; }
function isDemo(work) { return String(work?.id || "").startsWith("demo-"); }

async function fileToDataUrl(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Можно прикрепить только изображение.");
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(file);
  });
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось обработать изображение."));
      img.src = raw;
    });
    const maxSize = 1400;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/webp", 0.82);
  } catch {
    return raw;
  }
}

function Poster({ kind = "dune", compact = false, src = "" }) {
  if (src) return <img className={`poster-image ${compact ? "compact" : ""}`} src={src} alt="Постер" loading="lazy" />;
  return <div className={`poster ${posterKinds.includes(kind) ? kind : "dune"} ${compact ? "compact" : ""}`}><span className="poster-index">F.99</span><span className="poster-mark">{kind === "dune" ? "DUNE" : kind === "blue" ? "BLUE" : kind === "severance" ? "SVR" : "PL"}</span></div>;
}

function Score({ value, small = false }) {
  return <div className={`score ${small ? "small" : ""}`}><div><strong>{value ?? "—"}</strong><span>/99</span></div></div>;
}

function Logo({ onClick }) { return <button className="logo" onClick={onClick} aria-label="На главную">FRAME<span>99</span></button>; }

function Header({ setPage, user, onAuth }) {
  const [open, setOpen] = useState(false);
  const go = page => { setPage(page); setOpen(false); };
  return <header className="header"><Logo onClick={() => go("home")} /><nav className={open ? "nav open" : "nav"}>
    <button onClick={() => go("catalog")}>КАТАЛОГ</button><button onClick={() => go("reviews")}>РЕЦЕНЗИИ</button><button onClick={() => go("method")}>МЕТОДИКА</button><button onClick={() => user ? go("profile") : onAuth()}><UserRound size={17} /> {user ? "ПРОФИЛЬ" : "ВОЙТИ"}</button>
  </nav><button className="menu" onClick={() => setOpen(!open)} aria-label="Меню">{open ? <X /> : <Menu />}</button></header>;
}

function SearchBox({ works, setSelected, setPage }) {
  const [term, setTerm] = useState("");
  const found = useMemo(() => { const q = term.trim().toLowerCase(); return q.length < 2 ? [] : works.filter(w => `${w.title} ${w.original_title || ""} ${mediaTypeLabel(w.media_type)}`.toLowerCase().includes(q)).slice(0, 8); }, [term, works]);
  return <div className="search-wrap"><Search size={26} /><input aria-label="Найти произведение" placeholder="Найти фильм, сериал или аниме..." value={term} onChange={e => setTerm(e.target.value)} />{found.length > 0 && <div className="search-results">{found.map(w => <button key={w.id} onClick={() => { setSelected(w); setPage("work"); setTerm(""); }}><Poster kind={posterKinds[(w.release_year || 0) % 4]} compact src={w.poster_url} /><span><b>{titleForMedia(w)}</b><small>{mediaTypeLabel(w.media_type)} · {w.release_year || "—"}</small></span><Score value={w.score} small /></button>)}</div>}</div>;
}

function WorkCard({ work, onOpen, feature = false }) {
  const kind = posterKinds[(work.release_year || 0) % 4] || "dune";
  return <article className={`work-card ${feature ? "feature" : ""}`} onClick={() => onOpen(work)}><Poster kind={kind} compact={!feature} src={work.poster_url} /><div className="work-copy"><div className="eyebrow">{mediaTypeLabel(work.media_type)} · {work.release_year || "—"}</div><h3>{titleForMedia(work)}</h3><Score value={work.score} small={!feature}/><div className="author">FRAME99 <ArrowRight size={16} /></div></div></article>;
}

function Home({ works, setSelected, setPage }) {
  const recent = works.slice(0, 4);
  return <><section className="hero"><div className="hero-kicker">АРХИВ ЧЕЛОВЕЧЕСКОГО ВОСПРИЯТИЯ</div><h1>У ЦИФРЫ<br /><i>ЕСТЬ</i> ПРИЧИНА.</h1><p>Фильмы, сериалы и аниме: разберите по критериям, добавьте личное впечатление, объясните свой итог.</p><SearchBox works={works} setSelected={setSelected} setPage={setPage} /><div className="calibration"><span>01</span><div /><span>99</span></div></section><section className="section-pad"><div className="section-head"><div><span>СЕЙЧАС</span><h2>ПОСЛЕДНЕЕ ОЦЕНЁННОЕ</h2></div><button onClick={() => setPage("catalog")}>СМОТРЕТЬ ВСЁ <ArrowRight /></button></div><div className="editorial-grid">{recent[0] && <WorkCard work={recent[0]} feature onOpen={w => { setSelected(w); setPage("work"); }} />}<div className="side-grid">{recent.slice(1).map(w => <WorkCard key={w.id} work={w} onOpen={x => { setSelected(x); setPage("work"); }} />)}</div></div></section><section className="manifesto section-pad"><div className="manifesto-num">40 <span>×</span> 2.475 <span>=</span> 99</div><div><h2>НЕ ИСТИНА.<br />АРГУМЕНТИРОВАННЫЙ ВЗГЛЯД.</h2><p>Четыре наблюдаемых критерия создают основу. «Общее впечатление» честно добавляет личное.</p><button onClick={() => setPage("method")}>КАК РАБОТАЕТ FRAME99 <ArrowRight /></button></div></section></>;
}

function MethodPage() {
  return <main className="method-page section-pad"><div className="method-hero"><span>МЕТОДИКА FRAME99</span><h1>ДВЕ ЧАСТИ.<br />ОДНА ЧЕСТНАЯ ЦИФРА.</h1><p>Не научная истина, а формализованный инструмент критического взгляда.</p></div><div className="method-grid"><div className="method-number">01</div><div><h2>ОБЪЕКТИВНАЯ ОСНОВА</h2><p>Четыре универсальных критерия. Каждый от 1 до 10.</p>{criteria.map(c => <div className="method-criterion" key={c.key}><b>{c.title}</b><span>{c.text}</span></div>)}</div><div className="method-number accent-text">02</div><div><h2>ОБЩЕЕ ВПЕЧАТЛЕНИЕ</h2><p>Личный отклик от 1 до 10 превращается в множитель от ×1.000 до ×2.475.</p></div><div className="method-number">99</div><div><h2>ИТОГ</h2><div className="formula-large">ROUND ( B × [1 + (I−1) × 1.475 / 9] )</div><p>Например: база 34/40, впечатление 8/10, итог 73/99.</p></div></div></main>;
}

function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [nickname, setNickname] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const submit = async e => { e.preventDefault(); setBusy(true); setMessage(""); try { if (mode === "signup") { if (nickname.trim().length < 2) throw new Error("Никнейм должен содержать минимум 2 символа."); const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { nickname: nickname.trim() } } }); if (error) throw error; setMessage("Регистрация выполнена. Проверьте почту, если включено подтверждение e-mail."); } else { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; onSuccess(); } } catch (err) { setMessage(err.message || "Не удалось выполнить операцию."); } finally { setBusy(false); } };
  return <div className="app-modal" role="dialog" aria-modal="true"><div className="auth-panel"><button className="modal-close" onClick={onClose}><X /></button><div className="eyebrow">FRAME99</div><h2>{mode === "login" ? "ВОЙТИ" : "СОЗДАТЬ ПРОФИЛЬ"}</h2><form onSubmit={submit}>{mode === "signup" && <input className="dark-input" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Никнейм" minLength={2} maxLength={40} required />}<input className="dark-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required /><input className="dark-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" minLength={6} required /><button className="publish" disabled={busy}>{busy ? "СЕКУНДУ…" : mode === "login" ? "ВОЙТИ" : "ЗАРЕГИСТРИРОВАТЬСЯ"} <ArrowRight /></button></form>{message && <p className="form-message">{message}</p>}<button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}</button></div></div>;
}

function RatingModal({ work, user, existing, onClose, onSaved }) {
  const [scores, setScores] = useState({ content_score: 8, composition_score: 8, execution_score: 8, integrity_score: 8 }), [impression, setImpression] = useState(8), [review, setReview] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const total = finalScore(scores, impression), base = Object.values(scores).reduce((a, b) => a + b, 0);
  const submit = async () => {
    if (existing) return;
    const body = review.trim();
    if (body && body.length < 50) { setError("Рецензия должна содержать минимум 50 символов."); return; }
    setBusy(true); setError("");
    try {
      const { data: rating, error: ratingErr } = await supabase.from("ratings").insert({ user_id: user.id, media_id: work.id, ...scores, impression_score: impression }).select().single();
      if (ratingErr) throw ratingErr;
      if (body) {
        const { error: reviewErr } = await supabase.from("reviews").insert({ rating_id: rating.id, user_id: user.id, media_id: work.id, body });
        if (reviewErr) throw new Error(`Оценка сохранена, но рецензия не сохранилась: ${reviewErr.message}`);
      }
      onSaved(rating, body);
      onClose();
    } catch (err) {
      setError(err.message || "Не удалось сохранить оценку.");
    } finally { setBusy(false); }
  };
  return <div className="app-modal" role="dialog" aria-modal="true"><div className="rating-modal"><button className="modal-close" onClick={onClose}><X /></button><div className="dialog-title">ОЦЕНИТЬ: {work.title}</div><div className="rating-layout"><div className="rating-aside"><Poster kind={posterKinds[(work.release_year || 0) % 4]} src={work.poster_url} /><div className="live-score"><span>ИТОГ</span><Score value={total} /><small>База {base}/40 · ×{multiplier(impression).toFixed(3)}</small></div></div><div className="rating-form"><div className="part-label">ОБЪЕКТИВНАЯ ЧАСТЬ <span>01</span></div>{criteria.map(c => <div className="criterion" key={c.key}><div><b>{c.title}</b><small>{scores[c.key]} · {levels[scores[c.key] - 1]}</small></div><div className="number-row">{[1,2,3,4,5,6,7,8,9,10].map(n => <button type="button" key={n} className={scores[c.key] === n ? "active" : ""} onClick={() => setScores(s => ({ ...s, [c.key]: n }))}>{n}</button>)}</div></div>)}<div className="subjective"><div className="part-label">СУБЪЕКТИВНАЯ ЧАСТЬ <span>02</span></div><div className="criterion"><div><b>ОБЩЕЕ ВПЕЧАТЛЕНИЕ</b><small>{impression} · личная сила воздействия</small></div><div className="number-row accent">{[1,2,3,4,5,6,7,8,9,10].map(n => <button type="button" key={n} className={impression === n ? "active" : ""} onClick={() => setImpression(n)}>{n}</button>)}</div></div></div><label className="review-field"><span>РЕЦЕНЗИЯ <em>необязательно</em></span><textarea maxLength={10000} value={review} onChange={e => setReview(e.target.value)} placeholder="Объясните свою оценку..." /><small>{review.length} / 10 000</small></label>{existing ? <p className="form-message">Вы уже оценивали это произведение. Повторная оценка недоступна.</p> : <button className="publish" disabled={busy} onClick={submit}>{busy ? "СОХРАНЕНИЕ…" : `ОПУБЛИКОВАТЬ ${total}/99`} <Check /></button>}{error && <p className="form-message">{error}</p>}</div></div></div></div>;
}

function Breakdown({ values, impression, value }) { const [open, setOpen] = useState(false); const base = Object.values(values || {}).filter(x => typeof x === "number").reduce((a, b) => a + b, 0); return <div className="breakdown"><button onClick={() => setOpen(!open)}>ПОЧЕМУ {value}? <ChevronDown className={open ? "rotate" : ""} /></button>{open && <div className="breakdown-body">{criteria.map(c => <div key={c.key}><span>{c.short}</span><b>{values?.[c.key] ?? "—"}/10</b></div>)}<div className="formula-row"><span>БАЗА {base}/40</span><span>ВПЕЧАТЛЕНИЕ {impression ?? "—"}/10</span><span>×{impression ? multiplier(impression).toFixed(3) : "—"}</span></div></div>}</div>; }

function ReviewCard({ review, likeState, onLike }) {
  const author = review.profiles?.nickname || "пользователь";
  return <article className="review-card"><div className="review-top"><div className="avatar">{initials(author)}</div><div><b>@{author}</b><small>{new Date(review.created_at).toLocaleDateString("ru-RU")}</small></div></div><p>«{review.body}»</p><div className="review-bottom"><button onClick={() => onLike?.(review)} className={likeState ? "liked" : ""}><Heart fill={likeState ? "currentColor" : "none"} /> {likeState ? 1 : 0}</button></div></article>;
}

async function enrichReviews(rows) {
  const list = rows || [];
  const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))];
  if (!ids.length) return list;
  const { data: profiles } = await supabase.from("profiles").select("id,nickname,avatar_url").in("id", ids);
  const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return list.map(r => ({ ...r, profiles: map[r.user_id] || null }));
}

function AddMediaModal({ user, onClose, onSaved }) {
  const [title, setTitle] = useState(""), [original, setOriginal] = useState(""), [type, setType] = useState("film"), [year, setYear] = useState(""), [description, setDescription] = useState(""), [poster, setPoster] = useState(""), [posterName, setPosterName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submit = async e => { e.preventDefault(); setBusy(true); setError(""); try { const { data, error: err } = await supabase.from("media").insert({ title: title.trim(), original_title: original.trim() || null, media_type: type, release_year: year ? Number(year) : null, description: description.trim() || null, poster_url: poster || null, created_by: user.id }).select().single(); if (err) throw err; onSaved(data); onClose(); } catch (err) { setError(err.message || "Не удалось добавить произведение."); } finally { setBusy(false); } };
  const onFile = async e => { const file = e.target.files?.[0]; if (!file) return; try { setError(""); setPoster(await fileToDataUrl(file)); setPosterName(file.name); } catch (err) { setError(err.message || "Не удалось прикрепить изображение."); } };
  return <div className="app-modal"><div className="auth-panel media-modal"><button className="modal-close" onClick={onClose}><X /></button><div className="eyebrow">НОВАЯ ЗАПИСЬ</div><h2>ДОБАВИТЬ ПРОИЗВЕДЕНИЕ</h2><form onSubmit={submit}><input className="dark-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название" required /><input className="dark-input" value={original} onChange={e => setOriginal(e.target.value)} placeholder="Оригинальное название" /><div className="form-row"><select className="dark-input" value={type} onChange={e => setType(e.target.value)}><option value="film">Фильм</option><option value="series">Сериал</option><option value="anime">Аниме</option></select><input className="dark-input" type="number" min="1888" max="2100" value={year} onChange={e => setYear(e.target.value)} placeholder="Год" /></div><div className="poster-upload">{poster ? <img src={poster} alt="Предпросмотр постера" /> : <div className="poster-upload-empty"><span>FRAME</span><b>99</b><small>ПОСТЕР НЕ ПРИКРЕПЛЁН</small></div>}<label className="icon-action upload-button"><Plus size={17} /> {poster ? "ЗАМЕНИТЬ ПОСТЕР" : "ПРИКРЕПИТЬ ПОСТЕР"}<input type="file" accept="image/*" onChange={onFile} /></label>{posterName && <small className="upload-name">{posterName}</small>}</div><textarea className="dark-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание" /><button className="publish" disabled={busy}>{busy ? "СОЗДАНИЕ…" : "ДОБАВИТЬ"} <Plus /></button></form>{error && <p className="form-message">{error}</p>}</div></div>;
}

function Profile({ user, profile, ratings, favorites, setSelected, setPage, onSignOut }) { const nickname = profile?.nickname || user.email?.split("@")[0] || "USER"; return <main><section className="profile-hero section-pad"><div className="avatar big">{initials(nickname)}</div><div><span>КУЛЬТУРНЫЙ ПРОФИЛЬ</span><h1>{nickname.toUpperCase()}</h1><p>{profile?.bio || "Расскажите миру, что продолжает работать после титров."}</p><button className="icon-action" onClick={onSignOut}>ВЫЙТИ</button></div><div className="profile-stats"><div><b>{ratings.length}</b><span>ОЦЕНОК</span></div><div><b>{favorites.length}</b><span>ЛЮБИМЫХ</span></div></div></section><section className="section-pad"><div className="section-head"><div><span>ВКУС В ДВИЖЕНИИ</span><h2>ПОСЛЕДНИЕ ОЦЕНКИ</h2></div></div>{ratings.length ? <div className="catalog-grid">{ratings.map(r => r.media && <WorkCard key={r.id} work={{ ...r.media, score: r.final_score, count: 1 }} onOpen={x => { setSelected(x); setPage("work"); }} />)}</div> : <div className="empty-state">Здесь появятся твои оценки.</div>}</section></main>; }

function Catalog({ works, setSelected, setPage, user, onAdd }) { const [filter, setFilter] = useState("Все"), [q, setQ] = useState(""); const shown = useMemo(() => works.filter(w => (filter === "Все" || mediaTypeLabel(w.media_type) === filter) && `${w.title} ${w.original_title || ""}`.toLowerCase().includes(q.toLowerCase())), [works, filter, q]); return <main className="catalog section-pad"><div className="catalog-head"><span>АРХИВ</span><h1>НАЙТИ СЛЕДУЮЩЕЕ.</h1><div className="catalog-tools"><SearchBox works={works} setSelected={setSelected} setPage={setPage} />{user && <button className="icon-action" onClick={onAdd}><Plus size={17} /> ДОБАВИТЬ</button>}</div></div><div className="filter-row">{["Все", "Фильм", "Сериал", "Аниме"].map(x => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div><input className="catalog-filter" placeholder="Быстрый поиск в каталоге" value={q} onChange={e => setQ(e.target.value)} /><div className="catalog-grid">{shown.map(w => <WorkCard key={w.id} work={w} onOpen={x => { setSelected(x); setPage("work"); }} />)}</div>{shown.length === 0 && <div className="empty-state">Ничего не найдено.</div>}</main>; }

function WorkPage({ work, user, setPage, onRequireAuth, onRatingSaved }) {
  const [liked, setLiked] = useState(false), [rating, setRating] = useState(null), [reviews, setReviews] = useState([]), [showRating, setShowRating] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  useEffect(() => { let mounted = true; const load = async () => { if (isDemo(work)) { setLoading(false); return; } setLoadError(""); const [{ data: rs, error: ratingErr }, { data: rv, error: reviewErr }, { data: fav, error: favErr }] = await Promise.all([supabase.from("ratings").select("*").eq("media_id", work.id), supabase.from("reviews").select("id,rating_id,user_id,media_id,body,created_at").eq("media_id", work.id).order("created_at", { ascending: false }).limit(12), user ? supabase.from("favorites").select("media_id").eq("media_id", work.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null })]); if (!mounted) return; if (ratingErr || reviewErr || favErr) setLoadError((ratingErr || reviewErr || favErr).message); setRating(user ? (rs || []).find(x => x.user_id === user.id) || null : null); setReviews(await enrichReviews(rv || [])); setLiked(Boolean(fav)); setLoading(false); }; load(); return () => { mounted = false; }; }, [work.id, user?.id]);
  const toggleFavorite = async () => { if (!user) return onRequireAuth(); if (isDemo(work)) return; setLoadError(""); try { if (liked) { const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("media_id", work.id); if (error) throw error; } else { const { error } = await supabase.from("favorites").insert({ user_id: user.id, media_id: work.id }); if (error) throw error; } setLiked(!liked); } catch (err) { setLoadError(err.message || "Не удалось изменить избранное."); } };
  return <main><section className="work-hero"><Poster kind={posterKinds[(work.release_year || 0) % 4]} src={work.poster_url} /><div className="work-info"><div className="eyebrow">{mediaTypeLabel(work.media_type)} · {work.release_year || "—"} · {[work.country, work.duration_minutes ? `${work.duration_minutes} мин` : null, work.director].filter(Boolean).join(" · ")}</div><h1>{work.title}</h1><p className="original">{work.original_title || ""}</p><p className="synopsis">{work.description || "Произведение в архиве FRAME99."}</p><div className="actions"><button className="primary-action" onClick={() => user ? (isDemo(work) ? onRequireAuth() : setShowRating(true)) : onRequireAuth()}>ОЦЕНИТЬ <ArrowRight /></button><button className={liked ? "icon-action liked" : "icon-action"} onClick={toggleFavorite}><Heart fill={liked ? "currentColor" : "none"} /> {liked ? "В ЛЮБИМЫХ" : "В ЛЮБИМОЕ"}</button>{user && <button className="icon-action" onClick={() => setPage("profile")}>МОЙ ПРОФИЛЬ</button>}</div></div><div className="community-score"><span>СРЕДНЯЯ ОЦЕНКА FRAME99</span><Score value={work.score} /><p>{work.count ? `${work.count.toLocaleString("ru-RU")} оценок` : loading ? "Загрузка…" : "Пока без оценок"}</p>{rating && <><p className="form-message">Твоя оценка: {rating.final_score}/99</p><Breakdown values={rating} impression={rating.impression_score} value={rating.final_score} /></>}{loadError && <p className="form-message">{loadError}</p>}</div></section><section className="section-pad"><div className="section-head"><div><span>ОБЪЯСНЕНИЯ</span><h2>РЕЦЕНЗИИ</h2></div></div>{reviews.length ? <div className="review-grid">{reviews.map(r => <ReviewCard key={r.id} review={r} />)}</div> : <div className="empty-state">Пока нет публичных рецензий. Будь первым, кто объяснит свой взгляд.</div>}</section>{showRating && <RatingModal work={work} user={user} existing={rating} onClose={() => setShowRating(false)} onSaved={async (r) => { setRating(r); await onRatingSaved(); }} />}</main>;
}

function ReviewsPage({ reviews }) { return <main className="section-pad"><div className="catalog-head"><span>СООБЩЕСТВО</span><h1>РЕЦЕНЗИИ.</h1></div>{reviews.length ? <div className="review-grid">{reviews.map(r => <ReviewCard key={r.id} review={r} />)}</div> : <div className="empty-state">Пока нет рецензий.</div>}</main>; }

export default function App() {
  const [page, setPage] = useState("home"), [selected, setSelected] = useState(DEMO_WORKS[0]), [user, setUser] = useState(null), [profile, setProfile] = useState(null), [works, setWorks] = useState(DEMO_WORKS), [reviews, setReviews] = useState([]), [ratings, setRatings] = useState([]), [favorites, setFavorites] = useState([]), [authOpen, setAuthOpen] = useState(false), [addOpen, setAddOpen] = useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState("");

  const reloadUserData = async current => { if (!current) return; const [{ data: p }, { data: rs }, { data: fs }] = await Promise.all([supabase.from("profiles").select("*").eq("id", current.id).maybeSingle(), supabase.from("ratings").select("*, media(*)").eq("user_id", current.id).order("created_at", { ascending: false }), supabase.from("favorites").select("*, media(*)").eq("user_id", current.id).order("media_id")]); setProfile(p); setRatings(rs || []); setFavorites(fs || []); };
  const loadWorks = async () => { const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(200); if (!error && data?.length) { const ids = data.map(x => x.id); const { data: rows } = await supabase.from("ratings").select("media_id, final_score").in("media_id", ids); const grouped = {}; (rows || []).forEach(r => { grouped[r.media_id] ||= []; grouped[r.media_id].push(r.final_score); }); setWorks(data.map(w => ({ ...w, score: grouped[w.id]?.length ? Math.round(grouped[w.id].reduce((a, b) => a + b, 0) / grouped[w.id].length) : null, count: grouped[w.id]?.length || 0 }))); } else setWorks(DEMO_WORKS); };
  const loadReviews = async () => { const { data, error } = await supabase.from("reviews").select("id,rating_id,user_id,media_id,body,created_at").order("created_at", { ascending: false }).limit(40); if (error) { setReviews([]); return; } setReviews(await enrichReviews(data || [])); };
  useEffect(() => { let mounted = true; supabase.auth.getSession().then(async ({ data: { session } }) => { if (!mounted) return; setUser(session?.user || null); if (session?.user) await reloadUserData(session.user); await loadWorks(); await loadReviews(); setLoading(false); }); const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => { setUser(session?.user || null); if (session?.user) await reloadUserData(session.user); else { setProfile(null); setRatings([]); setFavorites([]); } }); return () => { mounted = false; sub.subscription.unsubscribe(); }; }, []);
  const notify = msg => { setNotice(msg); window.setTimeout(() => setNotice(""), 3500); };
  const afterRating = async () => { await loadWorks(); await loadReviews(); if (user) await reloadUserData(user); notify("Оценка опубликована."); };
  const handleSignOut = async () => { await supabase.auth.signOut(); setPage("home"); notify("Вы вышли из аккаунта."); };
  const body = page === "home" ? <Home works={works} setSelected={setSelected} setPage={setPage} /> : page === "work" ? <WorkPage work={selected} user={user} setPage={setPage} onRequireAuth={() => setAuthOpen(true)} onRatingSaved={afterRating} /> : page === "catalog" ? <Catalog works={works} user={user} setSelected={setSelected} setPage={setPage} onAdd={() => setAddOpen(true)} /> : page === "method" ? <MethodPage /> : page === "reviews" ? <ReviewsPage reviews={reviews} /> : <Profile user={user} profile={profile} ratings={ratings} favorites={favorites} setSelected={setSelected} setPage={setPage} onSignOut={handleSignOut} />;
  return <div className="app"><Header setPage={setPage} user={user} onAuth={() => setAuthOpen(true)} />{loading ? <div className="loading-screen">FRAME<span>99</span></div> : body}<footer><Logo onClick={() => setPage("home")} /><p>Система, в которой у цифры есть причина.</p><span>FRAME99 · 2026</span></footer>{authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); setPage("profile"); notify("Добро пожаловать в FRAME99."); }} />}{addOpen && user && <AddMediaModal user={user} onClose={() => setAddOpen(false)} onSaved={async w => { await loadWorks(); setSelected(w); setPage("work"); notify("Произведение добавлено."); }} />}{notice && <div className="notice">{notice}</div>}</div>;
}
