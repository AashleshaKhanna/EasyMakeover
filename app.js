/* global React, ReactDOM, OCCASIONS, WEATHERS, STYLES, PRESENTATIONS, MAKEUP, JEWELLERY, CLOTHING, HAIRSTYLE */
const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ---------- Recommendation engine ----------

// Filter a pool to items that match the user's chosen presentation.
function presentationFits(item, presentation) {
  if (!item.presentations || item.presentations.includes("any")) return true;
  return item.presentations.includes(presentation);
}

// Score how well an item matches the user's selection. Higher = better fit.
function scoreItem(item, { occasion, weather, style }) {
  let score = 0;
  if (item.occasions.includes(occasion)) score += 5;
  if (item.weather.includes(weather)) score += 3;
  else if (item.weather.includes("any")) score += 1;
  if (item.styles.includes(style)) score += 4;
  if (!item.occasions.includes(occasion) && !item.styles.includes(style)) score -= 2;
  return score;
}

// Pick one item per category. `rerollSeed` shuffles among the top matches so
// each press of "Re-roll" gives a fresh-feeling look without going off-brief.
function pickFromPool(pool, selection, rerollSeed = 0) {
  const filtered = pool.filter((item) => presentationFits(item, selection.presentation));
  const workingPool = filtered.length > 0 ? filtered : pool;

  const ranked = workingPool
    .map((item, idx) => ({ item, score: scoreItem(item, selection), idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  const topScore = ranked[0].score;
  const topTier = ranked.filter((r) => r.score >= topScore - 2);
  const choice = topTier[rerollSeed % topTier.length];
  return { ...choice.item, _score: choice.score };
}

function buildLook(selection, rerollSeed = 0) {
  return {
    makeup:    pickFromPool(MAKEUP,    selection, rerollSeed),
    jewellery: pickFromPool(JEWELLERY, selection, rerollSeed + 1),
    clothing:  pickFromPool(CLOTHING,  selection, rerollSeed + 2),
    hairstyle: pickFromPool(HAIRSTYLE, selection, rerollSeed + 3),
    selection,
    createdAt: Date.now(),
  };
}

// ---------- AI hero image (Pollinations — free, keyless) ----------

function buildImagePrompt(look, selection) {
  const occLabel = OCCASIONS.find((o) => o.id === selection.occasion)?.label || selection.occasion;
  const weatherLabel = WEATHERS.find((w) => w.id === selection.weather)?.label || selection.weather;
  const styleLabel = STYLES.find((s) => s.id === selection.style)?.label || selection.style;
  // Concrete subject words produce much better fashion-photo output than
  // "feminine-presenting" abstractions.
  const subject =
    selection.presentation === "feminine"  ? "woman" :
    selection.presentation === "masculine" ? "man"   :
    "androgynous person";

  // Short, concrete clauses + strong photorealism keywords. Flux responds
  // best when the subject + outfit cues are in the FIRST clauses.
  return [
    `editorial fashion photograph of one ${subject}, full body, standing, centered, looking at camera`,
    `wearing ${look.clothing.name}`,
    `${look.hairstyle.name} hair`,
    `${look.jewellery.name}`,
    `${look.makeup.name} look`,
    `${occLabel.toLowerCase()}, ${weatherLabel.toLowerCase()} day, ${styleLabel.toLowerCase()} mood`,
    `shot on 85mm lens, shallow depth of field, soft natural studio lighting, neutral seamless background`,
    `hyperrealistic, photorealistic, ultra detailed skin and fabric, fashion magazine quality, sharp focus, 4k`,
  ].join(", ");
}

function buildImageUrl(prompt, seed = 1) {
  // Flux model produces much higher quality than the default turbo.
  // We rely on a deterministic seed + Image() preloader (see HeroImage) to
  // make this reliable from any origin, including hosted netlify.app.
  const base = "https://image.pollinations.ai/prompt/";
  const params = new URLSearchParams({
    width: "720",
    height: "960",
    nologo: "true",
    model: "flux",
    seed: String(seed),
  });
  return base + encodeURIComponent(prompt) + "?" + params.toString();
}

// ---------- Open-Meteo (keyless) weather helper ----------
function bucketWeather({ temperature, weather_code, humidity }) {
  const rainy = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);
  if (rainy(weather_code)) return "rainy";
  if (temperature <= 12) return "cold";
  if (humidity >= 70 && temperature >= 22) return "humid";
  return "sunny";
}

async function fetchLiveWeather() {
  if (!navigator.geolocation) throw new Error("Geolocation not available");
  const pos = await new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
  );
  const { latitude, longitude } = pos.coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather lookup failed");
  const data = await res.json();
  const c = data.current;
  return {
    bucket: bucketWeather({
      temperature: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      weather_code: c.weather_code,
    }),
    temperature: c.temperature_2m,
  };
}

// ---------- UI atoms ----------
function Chip({ active, onClick, emoji, label, sub }) {
  return (
    <button
      onClick={onClick}
      className={
        "chip group relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 text-sm transition-all duration-200 " +
        (active
          ? "border-rose-400 bg-gradient-to-br from-rose-100 to-amber-100 text-rose-900 shadow-md scale-[1.02]"
          : "border-white/60 bg-white/60 text-stone-700 hover:border-rose-200 hover:bg-white hover:-translate-y-0.5")
      }
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="font-medium">{label}</span>
      {sub && <span className="text-[10px] uppercase tracking-wider text-stone-500">{sub}</span>}
    </button>
  );
}

function SectionLabel({ step, title, hint }) {
  return (
    <div className="mb-3 flex items-baseline gap-3 flex-wrap">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-500 text-xs font-bold text-white shadow">
        {step}
      </span>
      <h3 className="font-serif text-xl text-stone-800">{title}</h3>
      {hint && <span className="text-sm text-stone-500">{hint}</span>}
    </div>
  );
}

function LookCard({ category, item, accent }) {
  const palette = item.palette || [];
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            {category}
          </p>
          <h4 className="mt-1 font-serif text-2xl text-stone-900">
            <span className="mr-2">{item.emoji}</span>
            {item.name}
          </h4>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-stone-700">{item.desc}</p>
      {palette.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-stone-500">Palette</span>
          <div className="flex gap-1.5">
            {palette.map((c) => (
              <span
                key={c}
                className="h-5 w-5 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Categorize clothing/hair/jewellery into broad shapes so the SVG silhouette
// can adapt to roughly represent the look.
function categorizeClothing(name) {
  const n = name.toLowerCase();
  if (n.includes("saree") || n.includes("lehenga") || n.includes("anarkali") || n.includes("maxi") || n.includes("sundress")) return "long-drape";
  if (n.includes("dress") || n.includes("bodycon") || n.includes("cocktail")) return "fitted-dress";
  if (n.includes("suit") || n.includes("tuxedo") || n.includes("pantsuit") || n.includes("blazer")) return "tailored-suit";
  if (n.includes("sherwani") || n.includes("bandhgala") || n.includes("kurta") || n.includes("pathani")) return "long-tunic";
  if (n.includes("skirt") || n.includes("palazzo")) return "skirt-set";
  if (n.includes("trench") || n.includes("overcoat") || n.includes("sweater dress")) return "coat";
  if (n.includes("athleisure") || n.includes("bomber") || n.includes("hoodie") || n.includes("polo") || n.includes("shorts")) return "casual";
  return "shirt-trousers";
}

function categorizeHair(name, presentation) {
  const n = name.toLowerCase();
  if (n.includes("buzz") || n.includes("crop") || n.includes("textured")) return "short";
  if (n.includes("side part") || n.includes("slick back") || n.includes("pompadour") || n.includes("quiff") || n.includes("curtains")) return "groomed-short";
  if (n.includes("bun") || n.includes("ponytail") || n.includes("knot")) return "up";
  if (n.includes("braid") || n.includes("fishtail") || n.includes("crown")) return "braid";
  if (n.includes("gajra")) return "floral-bun";
  if (n.includes("wave") || n.includes("curls") || n.includes("straight") || n.includes("half-up")) return "long-flowing";
  if (n.includes("man bun")) return "long-tied";
  return presentation === "masculine" ? "groomed-short" : "long-flowing";
}

function jewelleryAccents(name) {
  const n = name.toLowerCase();
  return {
    earrings: /stud|hoop|jhumka|earring|tikka|kundan|pearl/.test(n),
    necklace: /chain|necklace|choker|pendant|kundan|pearl|cord/.test(n),
    chunkyNecklace: /chunky|kundan|polki|cord|chain necklace/.test(n),
    headpiece: /tikka/.test(n) || /gajra/.test(name.toLowerCase()),
    brooch: /brooch|cufflinks|tie pin/.test(n),
  };
}

// A fashion-illustration SVG that adapts to the actual look picked.
function SilhouettePlaceholder({ look, selection }) {
  if (!look) return null;
  const palette = look.makeup.palette || ["#FFB8A0", "#E07060", "#B83860"];
  const [cTop, cMid, cBottom] = [palette[0] || "#FFB8A0", palette[1] || "#E07060", palette[2] || "#B83860"];
  const presentation = selection.presentation;
  const clothing = categorizeClothing(look.clothing.name);
  const hair = categorizeHair(look.hairstyle.name, presentation);
  const accents = jewelleryAccents(look.jewellery.name);

  // Background tint per weather
  const bgGradient = {
    sunny: ["#FFF7E8", "#FCE7F3"],
    rainy: ["#E8EFF7", "#D8E4F0"],
    cold:  ["#EEF2FA", "#E8DCEF"],
    humid: ["#FFF1E0", "#FFE0D0"],
  }[selection.weather] || ["#FFF5EE", "#FCE7F3"];

  // Skin tone shifts subtly with the makeup palette
  const skin = "#EAC4A8";
  const hairColor = "#3A2A22";

  // Body width / outfit silhouette based on clothing category
  const isLongDrape = clothing === "long-drape";
  const isFittedDress = clothing === "fitted-dress";
  const isSuit = clothing === "tailored-suit";
  const isLongTunic = clothing === "long-tunic";
  const isSkirt = clothing === "skirt-set";
  const isCoat = clothing === "coat";

  // Outfit path
  let outfitPath;
  if (isLongDrape) {
    // flowy drape from shoulders to ankles
    outfitPath = "M60 100 Q100 96 140 100 L165 250 Q100 270 35 250 Z";
  } else if (isFittedDress) {
    // body-skimming dress mid-thigh
    outfitPath = "M65 100 Q100 96 135 100 L142 195 Q100 205 58 195 Z";
  } else if (isSuit) {
    // structured jacket + trousers (jacket part)
    outfitPath = "M58 100 L62 175 L138 175 L142 100 Q100 92 58 100 Z";
  } else if (isLongTunic) {
    // long kurta-style tunic to knees
    outfitPath = "M62 100 Q100 96 138 100 L148 215 Q100 225 52 215 Z";
  } else if (isSkirt) {
    // crop top + flared skirt
    outfitPath = "M68 100 Q100 96 132 100 L132 130 L60 145 L155 240 Q100 250 45 240 L68 130 Z";
  } else if (isCoat) {
    // long coat with lapels
    outfitPath = "M55 100 Q100 96 145 100 L152 230 Q100 240 48 230 Z";
  } else {
    // shirt + trousers (top portion)
    outfitPath = "M62 100 Q100 96 138 100 L142 165 Q100 172 58 165 Z";
  }

  // Hair rendering varies by category
  let hairEl = null;
  if (hair === "short") {
    hairEl = <path d="M78 56 Q100 38 122 56 L122 64 Q100 52 78 64 Z" fill={hairColor} />;
  } else if (hair === "groomed-short") {
    hairEl = <path d="M77 56 Q100 32 124 58 L120 66 Q100 50 80 66 Z" fill={hairColor} />;
  } else if (hair === "up") {
    hairEl = (
      <g>
        <path d="M78 58 Q100 36 122 58 L122 70 Q100 60 78 70 Z" fill={hairColor} />
        <circle cx="100" cy="38" r="9" fill={hairColor} />
      </g>
    );
  } else if (hair === "braid") {
    hairEl = (
      <g>
        <path d="M78 60 Q100 28 122 60 L124 80 Q100 70 76 80 Z" fill={hairColor} />
        <path d="M118 80 Q124 110 128 145 L122 148 Q116 110 114 82 Z" fill={hairColor} />
      </g>
    );
  } else if (hair === "floral-bun") {
    hairEl = (
      <g>
        <path d="M78 58 Q100 32 122 58 L122 68 Q100 56 78 68 Z" fill={hairColor} />
        <circle cx="100" cy="40" r="11" fill={hairColor} />
        <circle cx="93" cy="38" r="3" fill="#F7E2EE" />
        <circle cx="100" cy="34" r="3" fill="#F4C8DC" />
        <circle cx="107" cy="38" r="3" fill="#F7E2EE" />
      </g>
    );
  } else if (hair === "long-tied") {
    hairEl = (
      <g>
        <path d="M78 58 Q100 32 122 58 L122 70 Q100 60 78 70 Z" fill={hairColor} />
        <circle cx="100" cy="92" r="7" fill={hairColor} />
      </g>
    );
  } else {
    // long-flowing
    hairEl = <path d="M74 60 Q100 22 126 60 L130 130 Q100 115 70 130 Z" fill={hairColor} />;
  }

  return (
    <svg viewBox="0 0 200 280" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="em-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bgGradient[0]} />
          <stop offset="100%" stopColor={bgGradient[1]} />
        </linearGradient>
        <linearGradient id="em-outfit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={cTop} />
          <stop offset="55%"  stopColor={cMid} />
          <stop offset="100%" stopColor={cBottom} />
        </linearGradient>
        <linearGradient id="em-outfit-soft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={cTop} stopOpacity="0.75" />
          <stop offset="100%" stopColor={cMid} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="200" height="280" fill="url(#em-bg)" />

      {/* decorative weather hint */}
      {selection.weather === "sunny" && <circle cx="165" cy="35" r="14" fill="#FCD34D" opacity="0.5" />}
      {selection.weather === "rainy" && (
        <g opacity="0.45">
          {[40, 60, 80, 150, 170].map((x, i) => (
            <line key={i} x1={x} y1={15} x2={x - 4} y2={30} stroke="#7DA3C0" strokeWidth="1.5" strokeLinecap="round" />
          ))}
        </g>
      )}
      {selection.weather === "cold" && (
        <g fill="#C8D6E8" opacity="0.55">
          <circle cx="35" cy="25" r="2" />
          <circle cx="60" cy="40" r="1.5" />
          <circle cx="160" cy="22" r="1.5" />
          <circle cx="175" cy="42" r="2" />
        </g>
      )}

      {/* hair back-layer for long styles */}
      {(hair === "long-flowing" || hair === "braid") && (
        <path d="M70 80 Q60 130 70 175 L78 175 Q72 130 80 88 Z" fill={hairColor} opacity="0.9" />
      )}
      {(hair === "long-flowing" || hair === "braid") && (
        <path d="M130 80 Q140 130 130 175 L122 175 Q128 130 120 88 Z" fill={hairColor} opacity="0.9" />
      )}

      {/* neck */}
      <rect x="92" y="80" width="16" height="14" fill={skin} />

      {/* outfit */}
      <path d={outfitPath} fill="url(#em-outfit)" />

      {/* legs / trousers — show for non-long-drape */}
      {!isLongDrape && !isLongTunic && !isCoat && !isSkirt && (
        <g>
          {isSuit ? (
            <>
              <path d="M82 175 L80 268 L98 268 L100 178 Z" fill={cBottom} />
              <path d="M118 175 L120 268 L102 268 L100 178 Z" fill={cBottom} />
            </>
          ) : isFittedDress ? (
            <>
              <path d="M85 195 L82 268 L98 268 L100 198 Z" fill={skin} />
              <path d="M115 195 L118 268 L102 268 L100 198 Z" fill={skin} />
            </>
          ) : (
            <>
              <path d="M82 165 L80 268 L98 268 L100 168 Z" fill="#3F3128" />
              <path d="M118 165 L120 268 L102 268 L100 168 Z" fill="#3F3128" />
            </>
          )}
        </g>
      )}

      {/* arms */}
      <path d="M58 102 L46 178 L56 180 L70 110 Z" fill="url(#em-outfit-soft)" />
      <path d="M142 102 L154 178 L144 180 L130 110 Z" fill="url(#em-outfit-soft)" />

      {/* head + face */}
      <circle cx="100" cy="62" r="22" fill={skin} />

      {/* simple eyes + lips hint to suggest makeup */}
      <circle cx="93" cy="62" r="1.4" fill="#2A1A14" />
      <circle cx="107" cy="62" r="1.4" fill="#2A1A14" />
      <path d="M94 72 Q100 75 106 72" stroke={cMid} strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* hair */}
      {hairEl}

      {/* jewellery accents */}
      {accents.earrings && (
        <g>
          <circle cx="78" cy="68" r="2.5" fill="#F5D274" stroke="#C19432" strokeWidth="0.5" />
          <circle cx="122" cy="68" r="2.5" fill="#F5D274" stroke="#C19432" strokeWidth="0.5" />
        </g>
      )}
      {accents.necklace && !accents.chunkyNecklace && (
        <path d="M88 89 Q100 96 112 89" stroke="#F5D274" strokeWidth="1.4" fill="none" />
      )}
      {accents.chunkyNecklace && (
        <g>
          <path d="M84 88 Q100 100 116 88" stroke="#F5D274" strokeWidth="3" fill="none" />
          <circle cx="100" cy="100" r="3" fill="#F5D274" stroke="#C19432" strokeWidth="0.5" />
        </g>
      )}
      {accents.headpiece && (
        <g>
          <circle cx="100" cy="44" r="2.5" fill="#F5D274" stroke="#C19432" strokeWidth="0.5" />
          <line x1="100" y1="46" x2="100" y2="52" stroke="#F5D274" strokeWidth="1" />
        </g>
      )}
      {accents.brooch && (
        <circle cx="110" cy="118" r="3" fill="#F5D274" stroke="#C19432" strokeWidth="0.5" />
      )}

      {/* style sparkles for fancy/stylish */}
      {(selection.style === "fancy" || selection.style === "stylish") && (
        <g opacity="0.7">
          <path d="M30 130 l2 0 l0 -6 l-2 6 l-6 0 l6 2 l0 6 l-2 -6 z" transform="translate(0,0)" fill={cTop} />
          <path d="M170 200 l2 0 l0 -6 l-2 6 l-6 0 l6 2 l0 6 l-2 -6 z" transform="translate(0,0)" fill={cMid} />
        </g>
      )}

      {/* corner color palette swatches */}
      <g>
        <rect x="12" y="252" width="14" height="14" rx="3" fill={cTop} stroke="white" />
        <rect x="28" y="252" width="14" height="14" rx="3" fill={cMid} stroke="white" />
        <rect x="44" y="252" width="14" height="14" rx="3" fill={cBottom} stroke="white" />
      </g>
    </svg>
  );
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0);
  return Math.abs(h);
}

function HeroImage({ look, selection, reroll }) {
  const [status, setStatus] = useState("loading"); // loading | done | error
  const [retryCount, setRetryCount] = useState(0);

  // One deterministic URL per (look, selection, reroll, retry). No double-fires.
  const { url, alt } = useMemo(() => {
    if (!look) return { url: null, alt: "" };
    const prompt = buildImagePrompt(look, selection);
    const seed = (hashString(prompt) + reroll * 1009 + retryCount * 7919) % 100000;
    return {
      url: buildImageUrl(prompt, seed),
      alt: `${look.clothing.name}, ${look.hairstyle.name}, ${look.jewellery.name}`,
    };
  }, [look, selection, reroll, retryCount]);

  // Auto-retry once if the first attempt fails (transient ORB / generation issue).
  const onError = useCallback(() => {
    if (retryCount < 1) {
      setRetryCount((c) => c + 1);
    } else {
      setStatus("error");
    }
  }, [retryCount]);

  // Preload via Image() so we reliably detect load completion even when the
  // browser has already cached the response (avoids onLoad race conditions).
  useEffect(() => {
    if (!url) return;
    setStatus("loading");
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => { if (!cancelled) setStatus("done"); };
    probe.onerror = () => { if (!cancelled) onError(); };
    probe.src = url;
    return () => { cancelled = true; };
  }, [url, onError]);

  const onTryAgain = () => {
    setRetryCount((c) => c + 1);
    setStatus("loading");
  };

  if (!look) return null;

  return (
    <div className="relative aspect-[5/7] w-full overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl">
      {/* Styled silhouette is always rendered; AI image fades over it when ready */}
      <div className="absolute inset-0">
        <SilhouettePlaceholder look={look} selection={selection} />
      </div>

      {url && (
        <img
          key={url}
          src={url}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("done")}
          onError={onError}
          className={
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " +
            (status === "done" ? "opacity-100" : "opacity-0")
          }
        />
      )}

      {/* Loading shimmer (subtle — SVG is already showing through) */}
      {status === "loading" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-stone-900/55 via-stone-900/10 to-transparent p-4 text-white">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-medium uppercase tracking-[0.2em]">Painting your look…</span>
        </div>
      )}

      {/* Error — quiet retry chip, the SVG silhouette is doing the visual work */}
      {status === "error" && (
        <button
          onClick={onTryAgain}
          className="absolute bottom-3 right-3 rounded-full border border-white/60 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 shadow backdrop-blur-sm transition hover:bg-white"
          title="Retry AI render"
        >
          ✨ Retry AI render
        </button>
      )}

      {/* Top caption — changes label based on status so the SVG fallback reads intentional */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-stone-900/40 to-transparent p-3 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-90">
          {status === "done" ? "AI-rendered look preview" :
           status === "error" ? "Stylized look preview" :
           "Look preview"}
        </p>
      </div>
    </div>
  );
}

// ---------- Saved looks (localStorage) ----------
const STORAGE_KEY = "easymakeover.saved.v2";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveSaved(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ---------- App ----------
function App() {
  const [occasion, setOccasion] = useState("brunch");
  const [weather, setWeather] = useState("sunny");
  const [style, setStyle] = useState("stylish");
  const [presentation, setPresentation] = useState("feminine");
  const [look, setLook] = useState(null);
  const [reroll, setReroll] = useState(0);
  const [weatherStatus, setWeatherStatus] = useState({ state: "idle" });
  const [saved, setSaved] = useState(loadSaved);
  const [showSaved, setShowSaved] = useState(false);
  const [toast, setToast] = useState(null);

  const selection = useMemo(
    () => ({ occasion, weather, style, presentation }),
    [occasion, weather, style, presentation]
  );

  const occasionLabel = OCCASIONS.find((o) => o.id === occasion)?.label;
  const weatherLabel  = WEATHERS.find((w) => w.id === weather)?.label;
  const styleLabel    = STYLES.find((s) => s.id === style)?.label;
  const presLabel     = PRESENTATIONS.find((p) => p.id === presentation)?.label;

  // The "makeup" card is relabelled to "Grooming" for masculine selections.
  const makeupCategoryLabel = presentation === "masculine" ? "Grooming" : "Makeup";

  const generate = useCallback(() => {
    setReroll(0);
    setLook(buildLook(selection, 0));
  }, [selection]);

  const onReroll = () => {
    const next = reroll + 1;
    setReroll(next);
    setLook(buildLook(selection, next));
  };

  const surpriseMe = () => {
    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
    const o = pickRandom(OCCASIONS);
    const w = pickRandom(WEATHERS);
    const s = pickRandom(STYLES);
    const p = pickRandom(PRESENTATIONS);
    setOccasion(o); setWeather(w); setStyle(s); setPresentation(p);
    setReroll(0);
    setLook(buildLook({ occasion: o, weather: w, style: s, presentation: p }, 0));
  };

  const autoDetectWeather = async () => {
    setWeatherStatus({ state: "loading" });
    try {
      const { bucket, temperature } = await fetchLiveWeather();
      setWeather(bucket);
      setWeatherStatus({ state: "done", bucket, temperature });
    } catch (err) {
      setWeatherStatus({ state: "error", message: err.message || "Couldn't fetch weather" });
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const onSave = () => {
    if (!look) return;
    const entry = {
      id: Date.now(),
      occasion, weather, style, presentation,
      occasionLabel, weatherLabel, styleLabel, presLabel,
      makeup: look.makeup.name,
      jewellery: look.jewellery.name,
      clothing: look.clothing.name,
      hairstyle: look.hairstyle.name,
    };
    const next = [entry, ...saved].slice(0, 12);
    setSaved(next);
    saveSaved(next);
    showToast("Look saved to your lookbook ✨");
  };

  const onShare = async () => {
    if (!look) return;
    const text =
      `My EasyMakeover for ${occasionLabel} (${weatherLabel}, ${styleLabel}, ${presLabel}):\n` +
      `${makeupCategoryLabel === "Grooming" ? "🪒" : "💄"} ${look.makeup.name}\n` +
      `💍 ${look.jewellery.name}\n` +
      `👗 ${look.clothing.name}\n` +
      `💇 ${look.hairstyle.name}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Look copied to clipboard 📋");
    } catch {
      showToast("Couldn't access clipboard");
    }
  };

  const removeSaved = (id) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    saveSaved(next);
  };

  useEffect(() => { generate(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-rose-50 via-amber-50 to-fuchsia-50 text-stone-900">
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-fuchsia-200/40 blur-3xl" />
      <div className="pointer-events-none fixed top-1/3 right-1/4 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />

      <header className="relative mx-auto max-w-6xl px-6 pt-12 pb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-rose-700 shadow-sm">
          <span>💄</span> EasyMakeover
        </div>
        <h1 className="mt-5 font-serif text-5xl sm:text-6xl text-stone-900">
          The <span className="italic text-rose-600">perfect look</span> for every moment.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-stone-600">
          Tell us the occasion, peek at the weather, choose how you'd like to present, and pick your
          vibe — we'll curate the outfit, accessories, hair, and beauty look for you in seconds.
        </p>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24">
        <section className="rounded-3xl border border-white/70 bg-white/70 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <div className="grid gap-8">
            <div>
              <SectionLabel step="1" title="What's the occasion?" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {OCCASIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={occasion === o.id}
                    onClick={() => setOccasion(o.id)}
                    emoji={o.emoji}
                    label={o.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel
                step="2"
                title="How's the weather?"
                hint={
                  weatherStatus.state === "done"
                    ? `Detected · ${Math.round(weatherStatus.temperature)}°C`
                    : weatherStatus.state === "loading"
                    ? "Detecting…"
                    : weatherStatus.state === "error"
                    ? "Couldn't detect — pick manually"
                    : null
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  {WEATHERS.map((w) => (
                    <Chip
                      key={w.id}
                      active={weather === w.id}
                      onClick={() => setWeather(w.id)}
                      emoji={w.emoji}
                      label={w.label}
                    />
                  ))}
                </div>
                <button
                  onClick={autoDetectWeather}
                  disabled={weatherStatus.state === "loading"}
                  className="rounded-2xl border border-rose-200 bg-white/80 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  📍 Use my location
                </button>
              </div>
            </div>

            <div>
              <SectionLabel step="3" title="Who's the look for?" hint="we keep it inclusive — pick what feels right" />
              <div className="grid grid-cols-3 gap-2">
                {PRESENTATIONS.map((p) => (
                  <Chip
                    key={p.id}
                    active={presentation === p.id}
                    onClick={() => setPresentation(p.id)}
                    emoji={p.emoji}
                    label={p.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel step="4" title="Pick your vibe" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STYLES.map((s) => (
                  <Chip
                    key={s.id}
                    active={style === s.id}
                    onClick={() => setStyle(s.id)}
                    emoji={s.emoji}
                    label={s.label}
                    sub={s.blurb}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generate}
                  className="rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-rose-200/60 transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  ✨ Create my look
                </button>
                <button
                  onClick={surpriseMe}
                  className="rounded-2xl border border-stone-300 bg-white/80 px-5 py-3 font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  🎲 Surprise me
                </button>
              </div>
              <button
                onClick={() => setShowSaved((v) => !v)}
                className="text-sm font-medium text-stone-600 underline-offset-4 hover:underline"
              >
                {showSaved ? "Hide" : "Show"} my lookbook ({saved.length})
              </button>
            </div>
          </div>
        </section>

        {showSaved && (
          <section className="mt-6 rounded-3xl border border-white/70 bg-white/60 p-6 shadow-md backdrop-blur-md">
            <h3 className="mb-3 font-serif text-xl text-stone-800">Your lookbook</h3>
            {saved.length === 0 ? (
              <p className="text-sm text-stone-500">No saved looks yet — save one and it'll show up here.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {saved.map((s) => (
                  <li key={s.id} className="rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-stone-800">
                          {s.occasionLabel} · {s.weatherLabel} · {s.styleLabel} · {s.presLabel}
                        </p>
                        <p className="mt-1 text-stone-600">
                          {s.presentation === "masculine" ? "🪒" : "💄"} {s.makeup} · 💍 {s.jewellery}
                        </p>
                        <p className="text-stone-600">
                          👗 {s.clothing} · 💇 {s.hairstyle}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSaved(s.id)}
                        className="text-xs text-stone-400 hover:text-rose-600"
                      >
                        remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {look && (
          <section className="mt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-rose-600">Your curated look</p>
                <h2 className="mt-1 font-serif text-3xl text-stone-900">
                  {occasionLabel} · <span className="text-stone-500">{weatherLabel}</span> · {styleLabel}
                  <span className="ml-2 text-stone-400 text-2xl">· {presLabel}</span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={onReroll} className="rounded-2xl border border-stone-300 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50">🔁 Re-roll</button>
                <button onClick={onSave} className="rounded-2xl border border-rose-300 bg-white/80 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50">💾 Save look</button>
                <button onClick={onShare} className="rounded-2xl border border-stone-300 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50">📤 Share</button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <HeroImage look={look} selection={selection} reroll={reroll} />
                <p className="mt-3 text-center text-xs italic text-stone-500">
                  Stylized silhouette is rendered locally from your look; an AI photo from
                  Pollinations.ai fades in on top when it's ready.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:col-span-3">
                <LookCard category={makeupCategoryLabel} item={look.makeup}    accent="linear-gradient(90deg,#F472B6,#FB7185)" />
                <LookCard category="Jewellery"           item={look.jewellery} accent="linear-gradient(90deg,#F59E0B,#FBBF24)" />
                <LookCard category="Clothing"            item={look.clothing}  accent="linear-gradient(90deg,#A78BFA,#F472B6)" />
                <LookCard category="Hairstyle"           item={look.hairstyle} accent="linear-gradient(90deg,#34D399,#60A5FA)" />
              </div>
            </div>

            <p className="mt-8 text-center text-sm italic text-stone-500">
              Tip: hit <span className="font-medium text-stone-700">Re-roll</span> for a different
              variation that still fits the brief — the AI image regenerates too.
            </p>
          </section>
        )}
      </main>

      <footer className="relative mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-stone-500">
        Built with curated styling logic + live weather (Open-Meteo) + AI image preview (Pollinations.ai).
        EasyMakeover · hackathon edition.
      </footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
