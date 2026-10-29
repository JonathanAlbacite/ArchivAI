// BADGES - ON HOLD. The badge system hasn't been agreed yet, so this component
// is commented out and not used anywhere. To turn it back on, uncomment this
// file, the BADGES block in lib/gamification.js, the badge styles at the end of
// styles/pages.css and the marked lines in pages/student/StudentDashboard.jsx.

/*
import { Crown, DoorOpen, Footprints, Library, Lock, Sprout } from "lucide-react";
import { BADGES } from "../../lib/gamification";

const ICONS = { Footprints, Library, DoorOpen, Crown, Sprout };

// The badge collection: earned badges in color, the rest shown as locked
// goals with their requirement, so nobody is left guessing how to earn one.
function BadgeShelf({ earnedIds }) {
  return (
    <ul className="badge-shelf" role="list">
      {BADGES.map((b) => {
        const earned = earnedIds.has(b.id);
        const Icon = ICONS[b.icon] || Footprints;
        return (
          <li key={b.id} className="badge-tile" data-earned={earned}>
            <span className="badge-tile__icon" aria-hidden="true">
              {earned ? <Icon size={24} /> : <Lock size={20} />}
            </span>
            <span className="badge-tile__name">{b.name}</span>
            <span className="badge-tile__desc">{b.description}</span>
            <span className="sr-only">{earned ? "Earned" : "Not earned yet"}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default BadgeShelf;
*/
