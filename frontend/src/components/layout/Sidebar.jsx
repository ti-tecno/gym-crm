import { NavLink, useNavigate } from "react-router-dom";
import { COLORS, NAV_ITEMS } from "../../constants/theme.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../ui/Avatar.jsx";
import { initials } from "../../utils/format.js";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div
      style={{
        width: 220,
        background: COLORS.surface,
        borderRight: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100vh",
      }}
    >
      <div
        style={{
          padding: "22px 18px 18px",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: COLORS.accent,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "#000",
            }}
          >
            G
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: COLORS.text,
                lineHeight: 1,
              }}
            >
              IronCore
            </div>
            <div
              style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 1 }}
            >
              GESTIÓN v2.2
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {NAV_ITEMS.filter(
          (item) => !item.adminOnly || user?.rol === "ADMIN",
        ).map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              marginBottom: 2,
              background: isActive ? `${COLORS.accent}18` : "transparent",
              color: isActive ? COLORS.accent : COLORS.muted,
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 15,
              fontWeight: isActive ? 700 : 500,
              transition: "all 0.15s",
              textAlign: "left",
              textDecoration: "none",
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
                {isActive && (
                  <div
                    style={{
                      width: 3,
                      height: 14,
                      background: COLORS.accent,
                      borderRadius: 2,
                      marginLeft: "auto",
                    }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div
        style={{
          padding: "12px 14px",
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Avatar
          initials={initials(user?.nombre || "Usuario")}
          size={30}
          color={COLORS.blue}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: COLORS.text,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user?.nombre || "Usuario"}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>{user?.rol}</div>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{
            background: "transparent",
            color: COLORS.muted,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ⎋
        </button>
      </div>
    </div>
  );
}
