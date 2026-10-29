import { Moon, Sun } from "lucide-react";
import logo from "../../assets/logo.png";
import { StorybookArt } from "../Illustrations";
import { IconButton } from "../ui";
import { useThemeMode } from "../../lib/themeMode";
import MusicToggle from "../MusicToggle";

// Split sign-in layout: compact form panel + storybook illustration on wide
// screens; single column with a small illustration above the form on phones.
function AuthLayout({ title, subtitle, children, footer }) {
  const { mode, toggle } = useThemeMode();
  return (
    <div className="auth">
      <main className="auth__panel">
        <div className="auth__top">
          <div className="brand">
            <span className="brand__mark">
              <img src={logo} alt="" />
            </span>
            <span>
              <span className="brand__name" style={{ display: "block" }}>
                The Archivist's Legacy
              </span>
              <span className="brand__tag">Classroom escape-room games</span>
            </span>
          </div>
          <div className="row row-nowrap" style={{ "--gap": "4px" }}>
          <MusicToggle />
          <IconButton icon={mode === "dark" ? Sun : Moon} label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle} />
          </div>
        </div>

        <div className="auth__form-wrap">
          <StorybookArt className="auth__mobile-art" />
          <h1>{title}</h1>
          {subtitle && <p className="text-muted" style={{ marginTop: 6 }}>{subtitle}</p>}
          <div style={{ marginTop: 28 }}>{children}</div>
          {footer && <div className="auth__footer">{footer}</div>}
        </div>
      </main>

      <aside className="auth__art" aria-hidden="true">
        <div className="auth__art-inner">
          <StorybookArt className="auth__art-svg" />
          <p className="auth__quote display">Turn your lessons into escape-room games.</p>
          <ul className="auth__points">
            <li>Teachers build campaigns from their lessons</li>
            <li>Students play them in 3D scenes</li>
            <li>Results show time, rank and mistakes</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default AuthLayout;
