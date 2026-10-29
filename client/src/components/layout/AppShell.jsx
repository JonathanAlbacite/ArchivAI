import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu as MenuIcon, Moon, Palette, Sun, X } from "lucide-react";
import logo from "../../assets/logo.png";
import { Avatar, IconButton, Menu } from "../ui";
import { useThemeMode } from "../../lib/themeMode";
import { clearSession, getName, getRole, getToken, homeFor } from "../../lib/session";
import { NAV, ROLE_LABELS, isActivePath } from "./navConfig";
import TeacherChatWidget from "../teacher/TeacherChatWidget";
import MusicToggle from "../MusicToggle";

const CHARACTER_PATH = { STUDENT: "/student/character", TEACHER: "/teacher/character", ADMIN: "/admin/character" };

function Brand({ onNavigate }) {
  const role = getRole();
  return (
    <Link to={homeFor(role)} className="brand" onClick={onNavigate}>
      <span className="brand__mark">
        <img src={logo} alt="" />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="brand__name" style={{ display: "block" }}>
          Archivist's Legacy
        </span>
        <span className="brand__tag">Classroom escape rooms</span>
      </span>
    </Link>
  );
}

function NavSections({ role, pathname, onNavigate }) {
  return (NAV[role] || NAV.STUDENT).map((section) => (
    <div key={section.heading} className="sidebar__section">
      <p className="sidebar__heading">{section.heading}</p>
      <ul className="nav-list" role="list">
        {section.items.map((item) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link to={item.to} className="nav-link" aria-current={active ? "page" : undefined} onClick={onNavigate}>
                <Icon size={20} className="nav-link__icon" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

// Mobile navigation drawer: a modal panel with focus moved in on open,
// Escape to close, and Tab kept inside.
function NavDrawer({ role, pathname, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.querySelector("a, button")?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const trap = (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...panelRef.current.querySelectorAll("a, button")];
    if (e.shiftKey && document.activeElement === nodes[0]) {
      e.preventDefault();
      nodes[nodes.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
      e.preventDefault();
      nodes[0].focus();
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-label="Navigation" onKeyDown={trap}>
        <div className="row row-between row-nowrap">
          <Brand onNavigate={onClose} />
          <IconButton icon={X} label="Close navigation" onClick={onClose} />
        </div>
        <nav className="sidebar__nav" aria-label="Main">
          <NavSections role={role} pathname={pathname} onNavigate={onClose} />
        </nav>
      </div>
    </>
  );
}

// Shared app frame for every signed-in page: sticky sidebar on desktop,
// compact top bar + drawer on mobile, theme toggle and account menu.
// `allow` lists the roles that may open the nested routes (others are sent
// to their own home); `accent` picks the role color for the area (admin
// in Teacher Mode gets the teacher accent); `assistant` mounts the teacher
// AI chat once for the whole area so it survives navigation.
function AppShell({ allow, accent, assistant = false }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mode, toggle } = useThemeMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const token = getToken();
  const role = getRole();
  const name = getName();
  const accentRole = accent || role;

  useEffect(() => {
    document.documentElement.dataset.role = accentRole || "";
    return () => {
      delete document.documentElement.dataset.role;
    };
  }, [accentRole]);

  if (!token) return <Navigate to="/" replace />;
  if (allow && !allow.includes(role)) return <Navigate to={homeFor(role)} replace />;

  const signOut = () => {
    clearSession();
    navigate("/");
  };

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Sidebar">
        <Brand />
        <nav className="sidebar__nav" aria-label="Main">
          <NavSections role={role} pathname={pathname} />
        </nav>
        <div className="sidebar__foot row row-nowrap">
          <Avatar name={name} size={36} />
          <div className="grow">
            <p className="text-sm font-semibold truncate">{name || "Signed in"}</p>
            <p className="text-xs text-muted">{ROLE_LABELS[role] || "Member"}</p>
          </div>
          <IconButton icon={LogOut} label="Sign out" onClick={signOut} />
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <IconButton className="topbar__menu" icon={MenuIcon} label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)} />
          <div className="topbar__brand" style={{ minWidth: 0 }}>
            <Brand />
          </div>
          <span className="topbar__spacer" />
          <MusicToggle />
          <IconButton
            icon={mode === "dark" ? Sun : Moon}
            label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggle}
          />
          <Menu
            label="Account"
            items={[
              { label: "Customize character", icon: Palette, onSelect: () => navigate(CHARACTER_PATH[role] || "/") },
              { label: "Sign out", icon: LogOut, onSelect: signOut, danger: true, separatorBefore: true },
            ]}
            renderTrigger={(props) => (
              <button type="button" className="user-chip" aria-label={`Account menu for ${name || "you"}`} {...props}>
                <Avatar name={name} size={36} />
                <span className="user-chip__text">
                  <span className="user-chip__name truncate" style={{ display: "block" }}>
                    {name || "Signed in"}
                  </span>
                  <span className="user-chip__role">{ROLE_LABELS[role] || "Member"}</span>
                </span>
              </button>
            )}
          />
        </header>

        <main id="main" tabIndex={-1} style={{ outline: "none", flex: 1 }}>
          <Outlet />
        </main>
      </div>

      {drawerOpen && <NavDrawer role={role} pathname={pathname} onClose={closeDrawer} />}
      {assistant && <TeacherChatWidget />}
    </div>
  );
}

export default AppShell;
