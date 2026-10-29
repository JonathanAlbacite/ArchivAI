import { Compass, DoorOpen, LayoutDashboard, Palette, Users } from "lucide-react";

export const ROLE_LABELS = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  ADMIN: "Administrator",
};

// Sidebar / drawer navigation per signed-in role. `match` lists extra path
// prefixes that should also highlight the item (e.g. a room page belongs
// under Rooms).
export const NAV = {
  STUDENT: [
    {
      heading: "Student",
      items: [
        { to: "/student/dashboard", label: "Dashboard", icon: Compass, match: ["/student/room", "/results"] },
        { to: "/student/character", label: "My Character", icon: Palette },
      ],
    },
  ],
  TEACHER: [
    {
      heading: "Teacher",
      items: [
        { to: "/teacher/dashboard", label: "Rooms", icon: DoorOpen, match: ["/teacher/room", "/results"] },
        { to: "/teacher/character", label: "My Character", icon: Palette },
      ],
    },
  ],
  ADMIN: [
    {
      heading: "Admin",
      items: [
        { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/admin/vault"] },
        { to: "/admin/character-sets", label: "Character Sets", icon: Users },
        { to: "/admin/character", label: "My Character", icon: Palette },
      ],
    },
    {
      heading: "Teacher mode",
      items: [{ to: "/teacher/dashboard", label: "Rooms & Campaigns", icon: DoorOpen, match: ["/teacher/room", "/results"] }],
    },
  ],
};

export const isActivePath = (pathname, item) =>
  pathname === item.to || (item.match || []).some((prefix) => pathname.startsWith(prefix));
