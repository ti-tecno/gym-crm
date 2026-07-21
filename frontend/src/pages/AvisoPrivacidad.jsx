import { useEffect } from "react";
import { Link } from "react-router-dom";
import { COLORS } from "../constants/theme.js";

const PURPOSES = [
  "Registro y control de acceso a las instalaciones.",
  "Administración de membresías, pagos y servicios contratados.",
  "Comunicación sobre actividades, promociones y actualizaciones del gimnasio.",
  "Cumplimiento de obligaciones legales y contractuales.",
];

export default function AvisoPrivacidad() {
  useEffect(() => {
    document.title = "Aviso de Privacidad | IronCore";
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(circle at top left, rgba(207, 27, 54, 0.16), transparent 32%),
          radial-gradient(circle at top right, rgba(74, 144, 217, 0.12), transparent 28%),
          linear-gradient(180deg, #090707 0%, #030202 58%, #020101 100%)
        `,
        color: COLORS.text,
        padding: "32px 18px",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: COLORS.text,
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDim})`,
                color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800,
                letterSpacing: 1,
                boxShadow: `0 10px 30px ${COLORS.accent}33`,
              }}
            >
              IC
            </span>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              IronCore Fitness
            </span>
          </Link>

          <Link
            to="/login"
            style={{
              color: COLORS.muted,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            Acceder
          </Link>
        </div>

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,242,242,0.98))",
            color: "#211D1D",
            borderRadius: 28,
            border: "1px solid rgba(207, 27, 54, 0.18)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.36)",
            padding: "34px 22px 26px",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(207, 27, 54, 0.04), transparent 30%, rgba(74, 144, 217, 0.03))",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: COLORS.accentDim,
                  background: "rgba(207, 27, 54, 0.09)",
                  borderRadius: 999,
                  padding: "8px 12px",
                }}
              >
                Aviso de privacidad
              </span>
              <span
                style={{
                  color: "#6A6667",
                  fontSize: 13,
                }}
              >
                Última versión institucional para IronCore Fitness
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(34px, 6vw, 58px)",
                lineHeight: 0.95,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Tratamiento de datos personales
            </h1>

            <p
              style={{
                margin: "14px 0 0",
                fontSize: 16,
                lineHeight: 1.7,
                maxWidth: 780,
                color: "#373233",
              }}
            >
              <strong>IRONCORE FITNESS</strong>, en cumplimiento con la Ley Federal de
              Protección de Datos Personales en Posesión de los Particulares, informa
              que los datos personales proporcionados por el usuario serán tratados de
              forma confidencial, segura y exclusivamente para las finalidades que se
              describen a continuación.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginTop: 24,
              }}
            >
              {PURPOSES.map((item) => (
                <div
                  key={item}
                  style={{
                    background: "#F7F4F4",
                    border: "1px solid rgba(42, 36, 37, 0.1)",
                    borderRadius: 18,
                    padding: "16px 16px 18px",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: COLORS.accent,
                      marginBottom: 12,
                      boxShadow: `0 0 0 6px rgba(207, 27, 54, 0.08)`,
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "#302B2C",
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                marginTop: 18,
              }}
            >
              <div
                style={{
                  background: "#F7F4F4",
                  border: "1px solid rgba(42, 36, 37, 0.1)",
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 8px",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 28,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Derechos ARCO
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "#3B3637",
                    lineHeight: 1.7,
                    fontSize: 15,
                  }}
                >
                  El usuario podrá ejercer en cualquier momento sus derechos de
                  Acceso, Rectificación, Cancelación y Oposición, así como revocar su
                  consentimiento, enviando una solicitud al correo{" "}
                  <strong>gimnasioironcore@gmail.com</strong> o directamente en las
                  instalaciones.
                </p>
              </div>

              <div
                style={{
                  background: `linear-gradient(180deg, rgba(207, 27, 54, 0.12), rgba(207, 27, 54, 0.05))`,
                  border: "1px solid rgba(207, 27, 54, 0.15)",
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 8px",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 28,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Sin transferencias
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "#3B3637",
                    lineHeight: 1.7,
                    fontSize: 15,
                  }}
                >
                  Los datos personales no serán compartidos, transferidos ni
                  divulgados a terceros sin el consentimiento expreso del titular,
                  salvo en los casos legalmente previstos.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 12,
                color: "#6A6667",
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              <strong>Contacto:</strong> gimnasioironcore@gmail.com
              <br />
              <strong>Uso:</strong> registro, membresías, pagos y comunicación
              institucional.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
