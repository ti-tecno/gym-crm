import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/theme.js";
import { settingsService } from "../services/modules.service.js";

/*
 * ═══════════════════════════════════════════════════════════════
 *   IRON CORE — LANDING PAGE  |  Rutas de imágenes:
 *
 *   Galería:
 *     frontend/public/images/gym-1.jpg  …  gym-5.jpg
 *
 *   Logo:
 *     frontend/public/images/logo.jpg
 * ═══════════════════════════════════════════════════════════════
 */

const PLANS = [
  {
    nombre: "Básico",
    precio: 450,
    features: [
      "Acceso a todas las máquinas",
      "Vestidores y casilleros",
      "Horario completo",
      "Evaluación inicial",
    ],
    color: COLORS.blue,
    destacado: false,
  },
  {
    nombre: "Premium",
    precio: 850,
    features: [
      "Todo lo del plan Básico",
      "Clases grupales ilimitadas",
      "App de seguimiento",
      "Asesoría nutricional básica",
    ],
    color: COLORS.accent,
    destacado: true,
  },
  {
    nombre: "Elite",
    precio: 1200,
    features: [
      "Todo lo del plan Premium",
      "Coach personal dedicado",
      "Plan nutricional personalizado",
      "Suplementos con 10% dto",
    ],
    color: COLORS.purple,
    destacado: false,
  },
];

const STATS = [
  { value: 500, suffix: "+", label: "Miembros Activos" },
  { value: 15, suffix: "", label: "Coaches Certificados" },
  { value: 5, suffix: "+", label: "Años de Excelencia" },
  { value: 98, suffix: "%", label: "Clientes Satisfechos" },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Entrenamiento Elite",
    desc: "Programas de alta intensidad diseñados por expertos para maximizar tus resultados. Cada sesión, cada rep cuenta.",
    color: COLORS.accent,
  },
  {
    icon: "🎯",
    title: "Seguimiento 360°",
    desc: "Monitorea progreso, medidas corporales, rutinas y diario de entrenamiento en una sola plataforma.",
    color: COLORS.blue,
  },
  {
    icon: "🏆",
    title: "Comunidad Forjada",
    desc: "Únete a atletas comprometidos que se superan cada día. Aquí no hay límites, solo hierro y voluntad.",
    color: COLORS.purple,
  },
];

const COACHES = [
  {
    name: "Arnold Schwarzenegger",
    role: "Hipertrofia & Fuerza",
    desc: "Planificación avanzada para desarrollo muscular, volumen y progresión de cargas.",
    image: "/images/coaches/arnoldo.png",
  },
  {
    name: "Chris Bumstead",
    role: "Classic Physique",
    desc: "Técnica, estética y estructura de entrenamiento para un físico balanceado y competitivo.",
    image: "/images/coaches/cbum.jpg",
  },
  {
    name: "Sergio Oliva",
    role: "Potencia & Volumen",
    desc: "Enfoque en densidad muscular, intensidad y ejecución en ejercicios compuestos.",
    image: "/images/coaches/oliva.jpg",
  },
  {
    name: "Ronnie Coleman",
    role: "Entrenamiento de Alto Rendimiento",
    desc: "Rutinas de alta exigencia para fuerza máxima, disciplina y rendimiento total.",
    image: "/images/coaches/ronnie.png",
  },
];

const CLASS_COLORS = {
  ZUMBA: "#E07840",
  PILATES: "#3BAFC7",
  "CARDIO BOX": "#3D8B66",
  "MUAY THAI": "#C97088",
  "DANZA URBANA": "#8B5BB5",
  YOGA: "#C4B830",
};

const SCHEDULE_SLOTS = [
  { time: "8:00 – 8:50 a.m.", classes: [null, "ZUMBA", null, "ZUMBA", null] },
  {
    time: "9:00 – 9:50 a.m.",
    classes: ["PILATES", "CARDIO BOX", "PILATES", "CARDIO BOX", "ZUMBA"],
  },
  { time: "10:00 – 10:50 a.m.", classes: [null, null, null, null, "PILATES"] },
  { time: "5:00 – 5:50 p.m.", classes: ["MUAY THAI", null, null, null, null] },
  {
    time: "6:00 – 6:50 p.m.",
    classes: ["ZUMBA", null, "MUAY THAI", "ZUMBA", "MUAY THAI"],
  },
  {
    time: "7:00 – 7:50 p.m.",
    classes: ["DANZA URBANA", "YOGA", "DANZA URBANA", "YOGA", "DANZA URBANA"],
  },
  { time: "8:00 – 8:50 p.m.", classes: [null, "PILATES", null, null, null] },
];

const DAYS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];

// frontend/public/images/gym-1.jpg … gym-6.jpg
const GALLERY = [
  {
    src: "/images/gym-1.jpg",
    alt: "Área de pesas libres",
    path: "frontend/public/images/gym-1.jpg",
  },
  {
    src: "/images/gym-2.jpg",
    alt: "Zona cardio",
    path: "frontend/public/images/gym-2.jpg",
  },
  {
    src: "/images/gym-3.jpg",
    alt: "Zona funcional",
    path: "frontend/public/images/gym-3.jpg",
  },
  {
    src: "/images/gym-4.jpg",
    alt: "Sala de máquinas",
    path: "frontend/public/images/gym-4.jpg",
  },
  {
    src: "/images/gym-5.jpg",
    alt: "Área de musculación",
    path: "frontend/public/images/gym-5.jpg",
  },
  {
    src: "/images/gym-6.jpg",
    alt: "Área CrossFit",
    path: "frontend/public/images/gym-6.jpg",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const statsRef = useRef(null);

  const [scrollY, setScrollY] = useState(0);
  const [counts, setCounts] = useState(STATS.map(() => 0));
  const [countersStarted, setCountersStarted] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [coachIndex, setCoachIndex] = useState(0);

  const [plans, setPlans] = useState(PLANS);
  const [coaches, setCoaches] = useState(COACHES);
  const [sched, setSched] = useState({
    days: DAYS,
    slots: SCHEDULE_SLOTS,
    classColors: CLASS_COLORS,
  });

  useEffect(() => {
    settingsService.public().then((data) => {
      if (Array.isArray(data.packages) && data.packages.length > 0)
        setPlans(data.packages);
      if (Array.isArray(data.coaches) && data.coaches.length > 0)
        setCoaches(data.coaches);
      if (data.schedule?.days?.length && data.schedule?.slots?.length)
        setSched({
          days: data.schedule.days,
          slots: data.schedule.slots,
          classColors: data.schedule.classColors || CLASS_COLORS,
        });
    }).catch(() => {/* fallback to hardcoded defaults */});
  }, []);

  // ── Inject keyframe CSS ──────────────────────────────────────
  useEffect(() => {
    document.getElementById("ic-styles")?.remove();
    const s = document.createElement("style");
    s.id = "ic-styles";
    s.textContent = `
      @keyframes ic-float {
        0%,100% { transform: translateY(0) rotate(0deg); }
        50%      { transform: translateY(-18px) rotate(3deg); }
      }
      @keyframes ic-float2 {
        0%,100% { transform: translateY(0) rotate(0deg); }
        50%      { transform: translateY(-12px) rotate(-2deg); }
      }
      @keyframes ic-glow-pulse {
        0%,100% { opacity: 0.5; }
        50%      { opacity: 1; }
      }
      @keyframes ic-slide-up {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes ic-shimmer {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
      }
      @keyframes ic-scan {
        from { transform: translateY(-100%); }
        to   { transform: translateY(110vh); }
      }
      @keyframes ic-bounce-arrow {
        0%,100% { transform: translateX(-50%) translateY(0); opacity: .7; }
        50%      { transform: translateX(-50%) translateY(8px); opacity: .3; }
      }
      @keyframes ic-box-glow {
        0%,100% { box-shadow: 0 0 30px ${COLORS.accent}25; }
        50%      { box-shadow: 0 0 60px ${COLORS.accent}55, 0 0 120px ${COLORS.accent}20; }
      }
      @keyframes ic-ticker {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }

      .ic-reveal        { opacity:0; transform:translateY(36px); transition:opacity .7s ease,transform .7s ease; }
      .ic-reveal-l      { opacity:0; transform:translateX(-36px); transition:opacity .7s ease,transform .7s ease; }
      .ic-reveal-r      { opacity:0; transform:translateX(36px);  transition:opacity .7s ease,transform .7s ease; }
      .ic-v             { opacity:1 !important; transform:none !important; }

      .ic-btn {
        transition: transform .25s ease, box-shadow .25s ease !important;
        cursor: pointer;
      }
      .ic-btn:hover  { transform:translateY(-4px) scale(1.04) !important; }
      .ic-btn:active { transform:translateY(-1px) scale(1.01) !important; }

      .ic-outline-btn {
        transition: all .25s ease !important;
        cursor: pointer;
      }
      .ic-outline-btn:hover {
        background: ${COLORS.accent}18 !important;
        border-color: ${COLORS.accent} !important;
        color: ${COLORS.text} !important;
        transform: translateY(-3px) !important;
      }

      .ic-feat-card {
        transition: transform .1s ease !important;
        will-change: transform;
      }

      .ic-plan-card {
        transition: transform .35s ease, box-shadow .35s ease !important;
      }
      .ic-plan-card:hover { transform:translateY(-14px) !important; }

      .ic-gal-item {
        transition: transform .35s ease, box-shadow .35s ease !important;
        overflow: hidden;
      }
      .ic-gal-item:hover { transform:scale(1.03) !important; box-shadow:0 20px 50px #00000066 !important; }
      .ic-gal-item img   { transition: transform .5s ease !important; }
      .ic-gal-item:hover img { transform:scale(1.1) !important; }

      .ic-nav-link {
        transition: color .2s !important;
        cursor: pointer;
      }
      .ic-nav-link:hover { color: ${COLORS.accent} !important; }

      /* ── Mobile nav ── */
      .ic-nav-desktop { display: flex; }
      .ic-hamburger   { display: none; }
      .ic-mobile-menu {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: ${COLORS.bg}f5;
        backdrop-filter: blur(24px);
        z-index: 190;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 32px;
      }
      .ic-mobile-menu.open { display: flex; }

      @media (max-width: 768px) {
        .ic-nav-desktop { display: none !important; }
        .ic-hamburger   { display: flex !important; }
        .ic-section-pad { padding: 60px 20px !important; }
        .ic-hero-title  { font-size: clamp(64px, 22vw, 130px) !important; }
      }
    `;
    document.head.appendChild(s);
    return () => document.getElementById("ic-styles")?.remove();
  }, []);

  // ── Canvas particle network ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const isMobile = window.innerWidth < 768;
    const N = isMobile
      ? 40
      : Math.min(
          100,
          Math.floor((window.innerWidth * window.innerHeight) / 11000),
        );

    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      r: Math.random() * 1.8 + 0.4,
      a: Math.random() * 0.55 + 0.1,
      gold: Math.random() > 0.3,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pts.forEach((p) => {
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 160 && d > 0) {
          const f = (160 - d) / 160;
          p.vx += (dx / d) * f * 0.45;
          p.vy += (dy / d) * f * 0.45;
        }
        p.vx = Math.max(-1.8, Math.min(1.8, p.vx * 0.985));
        p.vy = Math.max(-1.8, Math.min(1.8, p.vy * 0.985));
        p.x = (p.x + p.vx + canvas.width) % canvas.width;
        p.y = (p.y + p.vy + canvas.height) % canvas.height;
      });

      // Lines between nearby particles
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 155) {
            ctx.strokeStyle = `rgba(245,166,35,${(1 - d / 155) * 0.22})`;
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(245,166,35,${p.a})`
          : `rgba(74,144,217,${p.a})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    const onMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e) => {
      if (e.touches.length > 0) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchEnd = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    const onResize = () => resize();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ── Scroll listener ──────────────────────────────────────────
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // ── Scroll-reveal ────────────────────────────────────────────
  useEffect(() => {
    const reveal = () =>
      document
        .querySelectorAll(".ic-reveal, .ic-reveal-l, .ic-reveal-r")
        .forEach((el) => {
          if (el.getBoundingClientRect().top < window.innerHeight * 0.88)
            el.classList.add("ic-v");
        });
    reveal();
    window.addEventListener("scroll", reveal, { passive: true });
    return () => window.removeEventListener("scroll", reveal);
  }, []);

  // ── Counter animation ────────────────────────────────────────
  useEffect(() => {
    if (!statsRef.current || countersStarted) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setCountersStarted(true);
        STATS.forEach((stat, i) => {
          const frames = 90;
          let f = 0;
          const t = setInterval(() => {
            f++;
            const eased = 1 - Math.pow(1 - f / frames, 3);
            setCounts((prev) => {
              const next = [...prev];
              next[i] = Math.round(eased * stat.value);
              return next;
            });
            if (f >= frames) clearInterval(t);
          }, 1800 / frames);
        });
      },
      { threshold: 0.4 },
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, [countersStarted]);

  // ── 3D card tilt ─────────────────────────────────────────────
  const onTiltMove = useCallback((e) => {
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    const rx = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * -10;
    const ry = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 10;
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;
    const shine = card.querySelector(".ic-shine");
    if (shine) {
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      shine.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,.07), transparent 60%)`;
    }
  }, []);

  const onTiltLeave = useCallback((e) => {
    const card = e.currentTarget;
    card.style.transform =
      "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)";
    const shine = card.querySelector(".ic-shine");
    if (shine) shine.style.background = "transparent";
  }, []);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const nextCoach = useCallback(() => {
    setCoachIndex((prev) => (prev + 1) % coaches.length);
  }, [coaches.length]);

  const prevCoach = useCallback(() => {
    setCoachIndex((prev) => (prev - 1 + coaches.length) % coaches.length);
  }, [coaches.length]);

  useEffect(() => {
    if (!coaches.length) return;
    const t = setInterval(() => {
      setCoachIndex((prev) => (prev + 1) % coaches.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 480);
  const heroY = scrollY * 0.18;

  // ════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "Inter, sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* Fixed particle canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: scrollY > 60 ? `${COLORS.bg}e0` : "transparent",
          backdropFilter: scrollY > 60 ? "blur(24px)" : "none",
          borderBottom: scrollY > 60 ? `1px solid ${COLORS.border}` : "none",
          transition: "all .4s ease",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
          onClick={() => scrollTo("hero")}
        >
          <img
            src="/images/logo.jpg"
            alt="Iron Core"
            style={{
              height: 36,
              width: 36,
              borderRadius: 8,
              objectFit: "cover",
              flexShrink: 0,
              boxShadow: `0 4px 18px ${COLORS.accent}55`,
            }}
          />
          <span
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: 3,
              color: COLORS.text,
            }}
          >
            IRON CORE
          </span>
        </div>

        {/* Desktop links */}
        <div
          className="ic-nav-desktop"
          style={{ alignItems: "center", gap: 28 }}
        >
          {[
            ["NOSOTROS", "features"],
            ["COACHES", "coaches"],
            ["HORARIO", "horario"],
            ["PLANES", "planes"],
            ["GALERÍA", "galeria"],
          ].map(([lbl, id]) => (
            <span
              key={id}
              className="ic-nav-link"
              onClick={() => scrollTo(id)}
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                color: COLORS.muted,
              }}
            >
              {lbl}
            </span>
          ))}
          <button
            className="ic-btn"
            onClick={() => navigate("/login")}
            style={{
              background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
              color: COLORS.bg,
              border: "none",
              padding: "10px 24px",
              borderRadius: 8,
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 2,
              boxShadow: `0 4px 22px ${COLORS.accent}45`,
            }}
          >
            ENTRAR
          </button>
        </div>

        {/* Hamburger button (mobile only) */}
        <button
          className="ic-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            background: "transparent",
            border: `1px solid ${menuOpen ? COLORS.accent : COLORS.border}`,
            borderRadius: 8,
            padding: "8px 10px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            alignItems: "center",
            justifyContent: "center",
            transition: "border-color .2s",
          }}
        >
          {menuOpen ? (
            /* X icon */
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke={COLORS.accent}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          ) : (
            /* Hamburger icon */
            <svg
              width="20"
              height="16"
              viewBox="0 0 20 16"
              fill="none"
              stroke={COLORS.text}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="0" y1="2" x2="20" y2="2" />
              <line x1="0" y1="8" x2="20" y2="8" />
              <line x1="0" y1="14" x2="20" y2="14" />
            </svg>
          )}
        </button>
      </nav>

      {/* ── MOBILE MENU OVERLAY ─────────────────────────────── */}
      <div className={`ic-mobile-menu${menuOpen ? " open" : ""}`}>
        {/* Close on backdrop tap */}
        <div
          style={{ position: "absolute", inset: 0 }}
          onClick={() => setMenuOpen(false)}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <img
            src="/images/logo.jpg"
            alt="Iron Core"
            style={{
              height: 44,
              width: 44,
              borderRadius: 10,
              objectFit: "cover",
              boxShadow: `0 4px 18px ${COLORS.accent}55`,
            }}
          />
          <span
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: 3,
              color: COLORS.text,
            }}
          >
            IRON CORE
          </span>
        </div>

        <div
          style={{
            width: 40,
            height: 2,
            background: `${COLORS.accent}`,
            borderRadius: 2,
            marginBottom: 8,
          }}
        />

        {[
          ["NOSOTROS", "features"],
          ["COACHES", "coaches"],
          ["HORARIO", "horario"],
          ["PLANES", "planes"],
          ["GALERÍA", "galeria"],
        ].map(([lbl, id]) => (
          <button
            key={id}
            onClick={() => {
              scrollTo(id);
              setMenuOpen(false);
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: 4,
              color: COLORS.subtle,
              textTransform: "uppercase",
              padding: "8px 0",
              transition: "color .2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.subtle)}
          >
            {lbl}
          </button>
        ))}

        <button
          className="ic-btn"
          onClick={() => navigate("/login")}
          style={{
            marginTop: 8,
            background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
            color: COLORS.bg,
            border: "none",
            padding: "16px 48px",
            borderRadius: 12,
            fontFamily: "Barlow Condensed, sans-serif",
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: 3,
            boxShadow: `0 8px 30px ${COLORS.accent}50`,
            textTransform: "uppercase",
          }}
        >
          ENTRAR
        </button>
      </div>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section
        id="hero"
        style={{
          position: "relative",
          zIndex: 1,
          height: "100vh",
          minHeight: 600,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        {/* Scan line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.accent}50, transparent)`,
            animation: "ic-scan 5s linear infinite",
            pointerEvents: "none",
          }}
        />

        {/* Ambient glows */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "4%",
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.accent}18, transparent 70%)`,
            filter: "blur(50px)",
            animation: "ic-float 7s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "18%",
            right: "6%",
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.blue}14, transparent 70%)`,
            filter: "blur(70px)",
            animation: "ic-float2 9s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            right: "15%",
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.purple}12, transparent 70%)`,
            filter: "blur(40px)",
            animation: "ic-float 11s ease-in-out infinite reverse",
            pointerEvents: "none",
          }}
        />

        {/* 3D decorative rings */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "8%",
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: `1px solid ${COLORS.accent}25`,
            animation: "ic-float 8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "25%",
            right: "10%",
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: `1px solid ${COLORS.blue}30`,
            animation: "ic-float2 6s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        {/* Content */}
        <div
          style={{
            opacity: heroOpacity,
            transform: `translateY(${heroY}px)`,
            padding: "0 24px",
            maxWidth: 1000,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: `${COLORS.accent}12`,
              border: `1px solid ${COLORS.accent}35`,
              borderRadius: 100,
              padding: "6px 20px",
              marginBottom: 28,
              animation: "ic-slide-up .7s ease both",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: COLORS.accent,
                boxShadow: `0 0 10px ${COLORS.accent}`,
                animation: "ic-glow-pulse 2s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 4,
                color: COLORS.accent,
                textTransform: "uppercase",
              }}
            >
              BIENVENIDO A IRON CORE
            </span>
          </div>

          {/* IRON CORE — título completo (evita que desaparezca "CORE" por clipping del texto en gradiente) */}
          <h1
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "clamp(80px, 16vw, 175px)",
              fontWeight: 800,
              lineHeight: 0.88,
              margin: "0 0 36px",
              letterSpacing: "-3px",
              textTransform: "uppercase",
              color: COLORS.text,
              textShadow: `
              1px 1px 0 ${COLORS.accentDim},
              2px 2px 0 ${COLORS.accentDim}cc,
              4px 4px 0 ${COLORS.accentDim}88,
              6px 6px 0 ${COLORS.accentDim}44,
              8px 8px 30px rgba(0,0,0,.9),
              0 0 80px ${COLORS.accent}25
            `,
              animation: "ic-slide-up .7s .1s ease both",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "baseline",
              gap: "0.18em",
            }}
          >
            <span>IRON</span>
            <span
              style={{
                background: `linear-gradient(135deg, ${COLORS.accent} 0%, #FFE066 45%, ${COLORS.accent} 100%)`,
                backgroundSize: "220% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                animation: "ic-shimmer 3s linear infinite",
              }}
            >
              CORE
            </span>
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "clamp(16px, 2.8vw, 26px)",
              fontWeight: 600,
              letterSpacing: 7,
              color: COLORS.subtle,
              textTransform: "uppercase",
              margin: "0 0 48px",
              animation: "ic-slide-up .7s .3s ease both",
            }}
          >
            FORJA TU MEJOR VERSIÓN
          </p>

          {/* CTA buttons */}
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              animation: "ic-slide-up .7s .4s ease both",
            }}
          >
            <button
              className="ic-btn"
              onClick={() => navigate("/login")}
              style={{
                background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
                color: COLORS.bg,
                border: "none",
                padding: "16px 44px",
                borderRadius: 14,
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: 3,
                textTransform: "uppercase",
                boxShadow: `0 10px 35px ${COLORS.accent}55, 0 0 0 1px ${COLORS.accent}30`,
              }}
            >
              COMENZAR AHORA
            </button>

            <button
              className="ic-outline-btn"
              onClick={() => scrollTo("features")}
              style={{
                background: "transparent",
                color: COLORS.subtle,
                border: `1px solid ${COLORS.border}`,
                padding: "16px 44px",
                borderRadius: 14,
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              CONOCER MÁS
            </button>
          </div>
        </div>

        {/* Scroll arrow */}
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: "50%",
            animation: "ic-bounce-arrow 2.2s ease-in-out infinite",
            pointerEvents: "none",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.accent}
            strokeWidth="1.8"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ── TICKER ─────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: `1px solid ${COLORS.border}`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: `${COLORS.surface}cc`,
          backdropFilter: "blur(10px)",
          overflow: "hidden",
          padding: "14px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 0,
            animation: "ic-ticker 18s linear infinite",
            width: "max-content",
          }}
        >
          {[...Array(3)].map((_, i) => (
            <span
              key={i}
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 5,
                color: COLORS.accent,
                textTransform: "uppercase",
                paddingRight: 0,
                whiteSpace: "nowrap",
              }}
            >
              {
                "IRON CORE  •  FORJA TU CUERPO  •  ENTRENA DURO  •  SÉ MEJOR  •  "
              }
              {
                "IRON CORE  •  FORJA TU CUERPO  •  ENTRENA DURO  •  SÉ MEJOR  •  "
              }
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ──────────────────────────────────────────── */}
      <section
        ref={statsRef}
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 20,
          }}
        >
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="ic-reveal"
              style={{
                textAlign: "center",
                padding: "36px 20px",
                background: `${COLORS.card}cc`,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                backdropFilter: "blur(8px)",
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              <div
                style={{
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: 60,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: COLORS.accent,
                  textShadow: `0 0 35px ${COLORS.accent}45`,
                }}
              >
                {counts[i]}
                {stat.suffix}
              </div>
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  letterSpacing: 2,
                  color: COLORS.muted,
                  textTransform: "uppercase",
                  marginTop: 8,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section
        id="features"
        style={{ position: "relative", zIndex: 1, padding: "100px 48px" }}
        className="ic-section-pad"
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            className="ic-reveal"
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 4,
                color: COLORS.accent,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              POR QUÉ ELEGIRNOS
            </p>
            <h2
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-1px",
                color: COLORS.text,
                margin: 0,
              }}
            >
              LA EXPERIENCIA
              <br />
              IRON CORE
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                className="ic-feat-card ic-reveal"
                onMouseMove={onTiltMove}
                onMouseLeave={onTiltLeave}
                style={{
                  background: `${COLORS.card}dd`,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 22,
                  padding: "40px 36px",
                  position: "relative",
                  overflow: "hidden",
                  transformStyle: "preserve-3d",
                  transitionDelay: `${i * 0.12}s`,
                }}
              >
                <div
                  className="ic-shine"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 22,
                    pointerEvents: "none",
                    transition: "background .3s",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 130,
                    height: 130,
                    background: `radial-gradient(circle at 0% 0%, ${feat.color}22, transparent 70%)`,
                  }}
                />

                <div
                  style={{
                    fontSize: 50,
                    marginBottom: 22,
                    filter: `drop-shadow(0 0 22px ${feat.color}65)`,
                  }}
                >
                  {feat.icon}
                </div>

                <h3
                  style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 28,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: COLORS.text,
                    margin: "0 0 12px",
                  }}
                >
                  {feat.title}
                </h3>

                <p
                  style={{
                    color: COLORS.muted,
                    lineHeight: 1.75,
                    fontSize: 15,
                    margin: 0,
                  }}
                >
                  {feat.desc}
                </p>

                <div
                  style={{
                    marginTop: 28,
                    height: 2,
                    background: `linear-gradient(90deg, ${feat.color}70, transparent)`,
                    borderRadius: 2,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COACHES CAROUSEL ───────────────────────────────── */}
      <section
        id="coaches"
        style={{ position: "relative", zIndex: 1, padding: "100px 48px" }}
        className="ic-section-pad"
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            className="ic-reveal"
            style={{ textAlign: "center", marginBottom: 40 }}
          >
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 4,
                color: COLORS.accent,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              EQUIPO PROFESIONAL
            </p>
            <h2
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-1px",
                color: COLORS.text,
                margin: 0,
              }}
            >
              NUESTROS
              <br />
              COACHES
            </h2>
          </div>

          <div
            className="ic-reveal"
            style={{
              background: `${COLORS.card}dd`,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 24,
              padding: 20,
              display: "grid",
              gridTemplateColumns:
                window.innerWidth < 900 ? "1fr" : "minmax(260px, 420px) 1fr",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 18,
                overflow: "hidden",
                minHeight: 320,
                border: `1px solid ${COLORS.border}`,
                background: `linear-gradient(135deg, ${COLORS.surface}, ${COLORS.card})`,
              }}
            >
              <img
                src={coaches[coachIndex]?.image}
                alt={coaches[coachIndex]?.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(to top, ${COLORS.bg}cc 10%, transparent 60%)`,
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 12,
                  fontFamily: "DM Mono, monospace",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: COLORS.accent,
                  textTransform: "uppercase",
                  background: `${COLORS.bg}aa`,
                  border: `1px solid ${COLORS.border}`,
                  padding: "5px 8px",
                  borderRadius: 8,
                }}
              >
                COACH DESTACADO
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 18,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "clamp(34px, 6vw, 54px)",
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    textTransform: "uppercase",
                    color: COLORS.text,
                    margin: "0 0 6px",
                  }}
                >
                  {coaches[coachIndex]?.name}
                </h3>
                <p
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: COLORS.accent,
                    margin: "0 0 14px",
                  }}
                >
                  {coaches[coachIndex]?.role}
                </p>
                <p
                  style={{
                    color: COLORS.muted,
                    lineHeight: 1.75,
                    fontSize: 15,
                    margin: 0,
                    maxWidth: 620,
                  }}
                >
                  {coaches[coachIndex]?.desc}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {coaches.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCoachIndex(i)}
                      aria-label={`Ir al coach ${i + 1}`}
                      style={{
                        width: i === coachIndex ? 28 : 10,
                        height: 10,
                        borderRadius: 999,
                        border: "none",
                        cursor: "pointer",
                        background:
                          i === coachIndex
                            ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDim})`
                            : `${COLORS.border}`,
                        transition: "all .25s ease",
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="ic-outline-btn"
                    onClick={prevCoach}
                    style={{
                      background: "transparent",
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.text,
                      padding: "10px 16px",
                      borderRadius: 10,
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    ← Anterior
                  </button>
                  <button
                    className="ic-btn"
                    onClick={nextCoach}
                    style={{
                      background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
                      color: COLORS.bg,
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: 10,
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontWeight: 800,
                      fontSize: 14,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      boxShadow: `0 8px 24px ${COLORS.accent}45`,
                    }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────── */}
      <section
        id="galeria"
        style={{ position: "relative", zIndex: 1, padding: "100px 48px" }}
        className="ic-section-pad"
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ic-reveal"
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 4,
                color: COLORS.accent,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              NUESTRAS INSTALACIONES
            </p>
            <h2
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-1px",
                color: COLORS.text,
                margin: 0,
              }}
            >
              DONDE SE FORJAN
              <br />
              LOS CAMPEONES
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {GALLERY.map((img, i) => (
              <div
                key={i}
                className={`ic-gal-item ic-reveal`}
                style={{
                  borderRadius: 18,
                  aspectRatio: "16/10",
                  position: "relative",
                  background: `linear-gradient(135deg, ${COLORS.surface}, ${COLORS.card})`,
                  border: `1px solid ${COLORS.border}`,
                  transitionDelay: `${(i % 3) * 0.1}s`,
                }}
              >
                {/* Placeholder (shown when image is missing) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 18,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: `2px dashed ${COLORS.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      color: COLORS.border,
                    }}
                  >
                    📸
                  </div>
                  <code
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 10,
                      color: COLORS.muted,
                      letterSpacing: 0.5,
                      textAlign: "center",
                      padding: "0 12px",
                    }}
                  >
                    {img.path}
                  </code>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      color: COLORS.subtle,
                    }}
                  >
                    {img.alt}
                  </span>
                </div>

                {/* Image (covers placeholder when present) */}
                <img
                  src={img.src}
                  alt={img.alt}
                  onError={() => setImgErrors((p) => ({ ...p, [i]: true }))}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 18,
                    display: imgErrors[i] ? "none" : "block",
                  }}
                />

                {/* Hover label */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 18,
                    background: `linear-gradient(to top, ${COLORS.bg}cc 0%, transparent 50%)`,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "18px 20px",
                    opacity: imgErrors[i] ? 0 : undefined,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: COLORS.text,
                    }}
                  >
                    {img.alt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ───────────────────────────────────────── */}
      <section
        id="horario"
        style={{ position: "relative", zIndex: 1, padding: "100px 48px" }}
        className="ic-section-pad"
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            className="ic-reveal"
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 4,
                color: COLORS.accent,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              CLASES GRUPALES
            </p>
            <h2
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-1px",
                color: COLORS.text,
                margin: 0,
              }}
            >
              HORARIO
              <br />
              DE CLASES
            </h2>
          </div>

          {/* Table */}
          <div className="ic-reveal" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 4,
                minWidth: 700,
              }}
            >
              <thead>
                <tr>
                  {/* Time column header */}
                  <th
                    style={{
                      width: 130,
                      padding: "14px 12px",
                      background: `${COLORS.card}`,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                    }}
                  />
                  {sched.days.map((day) => (
                    <th
                      key={day}
                      style={{
                        padding: "14px 8px",
                        background: `linear-gradient(135deg, ${COLORS.accent}cc, ${COLORS.accentDim}cc)`,
                        borderRadius: 8,
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontWeight: 800,
                        fontSize: 14,
                        letterSpacing: 2,
                        color: COLORS.bg,
                        textAlign: "center",
                      }}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sched.slots.map((slot, ri) => (
                  <tr key={ri}>
                    {/* Time */}
                    <td
                      style={{
                        padding: "10px 12px",
                        background: `${COLORS.card}`,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        fontFamily: "DM Mono, monospace",
                        fontSize: 11,
                        color: COLORS.muted,
                        textAlign: "center",
                        lineHeight: 1.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {slot.time}
                    </td>

                    {/* Class cells */}
                    {slot.classes.map((cls, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: 4,
                          borderRadius: 8,
                          verticalAlign: "middle",
                        }}
                      >
                        {cls ? (
                          <div
                            style={{
                              background: sched.classColors[cls] ?? COLORS.card,
                              borderRadius: 8,
                              padding: "14px 8px",
                              textAlign: "center",
                              fontFamily: "Barlow Condensed, sans-serif",
                              fontWeight: 700,
                              fontSize: 13,
                              letterSpacing: 1,
                              color: "#fff",
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                              boxShadow: `0 4px 14px ${sched.classColors[cls] ?? "#000"}55`,
                            }}
                          >
                            {cls}
                          </div>
                        ) : (
                          <div
                            style={{
                              background: `${COLORS.surface}55`,
                              border: `1px solid ${COLORS.border}44`,
                              borderRadius: 8,
                              height: 46,
                            }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div
            className="ic-reveal"
            style={{
              marginTop: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            {Object.entries(sched.classColors).map(([name, color]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: `${COLORS.card}`,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 100,
                  padding: "6px 14px",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: 1,
                    color: COLORS.subtle,
                  }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANS ──────────────────────────────────────────── */}
      <section
        id="planes"
        style={{ position: "relative", zIndex: 1, padding: "100px 48px" }}
        className="ic-section-pad"
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            className="ic-reveal"
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                letterSpacing: 4,
                color: COLORS.accent,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              MEMBRESÍAS
            </p>
            <h2
              style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-1px",
                color: COLORS.text,
                margin: 0,
              }}
            >
              ELIGE TU PLAN
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: 24,
              alignItems: "start",
            }}
          >
            {plans.map((plan, i) => (
              <div
                key={i}
                className="ic-plan-card ic-reveal"
                style={{
                  background: plan.destacado
                    ? `linear-gradient(155deg, ${COLORS.card}, ${COLORS.surface})`
                    : `${COLORS.card}cc`,
                  border: `1px solid ${plan.destacado ? plan.color : COLORS.border}`,
                  borderRadius: 24,
                  padding: "40px 32px",
                  position: "relative",
                  overflow: "hidden",
                  transitionDelay: `${i * 0.1}s`,
                  boxShadow: plan.destacado
                    ? `0 0 50px ${plan.color}28`
                    : "none",
                  animation: plan.destacado
                    ? "ic-box-glow 3.5s ease-in-out infinite"
                    : "none",
                }}
              >
                {plan.destacado && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: -32,
                      background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
                      color: COLORS.bg,
                      padding: "4px 44px",
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 2,
                      transform: "rotate(35deg)",
                      boxShadow: `0 4px 16px ${COLORS.accent}55`,
                    }}
                  >
                    POPULAR
                  </div>
                )}

                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      width: 44,
                      height: 3,
                      background: `linear-gradient(90deg,${plan.color},transparent)`,
                      borderRadius: 2,
                      marginBottom: 16,
                    }}
                  />
                  <h3
                    style={{
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 28,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: plan.color,
                      margin: "0 0 10px",
                    }}
                  >
                    {plan.nombre}
                  </h3>
                  <div
                    style={{ display: "flex", alignItems: "baseline", gap: 4 }}
                  >
                    <span
                      style={{
                        color: COLORS.muted,
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontSize: 20,
                      }}
                    >
                      $
                    </span>
                    <span
                      style={{
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontSize: 62,
                        fontWeight: 800,
                        color: COLORS.text,
                        lineHeight: 1,
                      }}
                    >
                      {plan.precio}
                    </span>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>
                      /{plan.periodo ?? "mes"}
                    </span>
                  </div>
                </div>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 32px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {plan.features.map((f, j) => (
                    <li
                      key={j}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: `${plan.color}20`,
                          border: `1px solid ${plan.color}50`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
                        >
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke={plan.color}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <span
                        style={{
                          color: COLORS.subtle,
                          fontSize: 14,
                          lineHeight: 1.4,
                        }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  className="ic-btn"
                  onClick={() => navigate("/login")}
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: plan.destacado
                      ? "none"
                      : `1px solid ${plan.color}50`,
                    background: plan.destacado
                      ? `linear-gradient(135deg,${plan.color},${COLORS.accentDim})`
                      : "transparent",
                    color: plan.destacado ? COLORS.bg : plan.color,
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    boxShadow: plan.destacado
                      ? `0 8px 28px ${plan.color}45`
                      : "none",
                  }}
                >
                  SELECCIONAR PLAN
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "120px 48px",
          textAlign: "center",
          background: `linear-gradient(180deg, transparent, ${COLORS.surface}70, transparent)`,
        }}
      >
        <div className="ic-reveal" style={{ maxWidth: 700, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 10,
              letterSpacing: 4,
              color: COLORS.accent,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            ¿LISTO PARA EMPEZAR?
          </p>
          <h2
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "clamp(56px, 10vw, 110px)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "-3px",
              lineHeight: 0.9,
              color: COLORS.text,
              margin: "0 0 20px",
              textShadow: `0 0 80px ${COLORS.accent}18`,
            }}
          >
            EL HIERRO
            <br />
            TE ESPERA
          </h2>
          <p
            style={{
              color: COLORS.muted,
              fontSize: 16,
              lineHeight: 1.75,
              margin: "0 0 48px",
            }}
          >
            Únete a Iron Core hoy y comienza tu transformación.
            <br />
            Cada rep cuenta. Cada día importa.
          </p>
          <button
            className="ic-btn"
            onClick={() => navigate("/login")}
            style={{
              background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
              color: COLORS.bg,
              border: "none",
              padding: "20px 60px",
              borderRadius: 16,
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: 3,
              textTransform: "uppercase",
              boxShadow: `0 14px 45px ${COLORS.accent}55, 0 0 0 1px ${COLORS.accent}35`,
            }}
          >
            ÚNETE A IRON CORE
          </button>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          padding: "36px 48px",
          borderTop: `1px solid ${COLORS.border}`,
          background: `${COLORS.surface}99`,
          backdropFilter: "blur(12px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accentDim})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 900,
              fontSize: 14,
              color: COLORS.bg,
            }}
          >
            IC
          </div>
          <span
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: 2,
              color: COLORS.text,
            }}
          >
            IRON CORE
          </span>
        </div>
        <span
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 10,
            color: COLORS.muted,
            letterSpacing: 1,
          }}
        >
          © 2026 IRON CORE. TODOS LOS DERECHOS RESERVADOS.
        </span>
        <button
          className="ic-outline-btn"
          onClick={() => navigate("/login")}
          style={{
            background: "transparent",
            border: `1px solid ${COLORS.border}`,
            color: COLORS.muted,
            padding: "8px 22px",
            borderRadius: 8,
            fontFamily: "DM Mono, monospace",
            fontSize: 10,
            letterSpacing: 2,
            cursor: "pointer",
          }}
        >
          ACCEDER →
        </button>
      </footer>
    </div>
  );
}
