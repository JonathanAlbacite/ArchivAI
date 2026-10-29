import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Compass, DoorOpen, KeyRound, Palette, Trophy } from "lucide-react";
import RoomCard from "../../components/RoomCard";
import { SceneBadge } from "../../components/SceneIcon";
import { BooksArt } from "../../components/Illustrations";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Confetti,
  EmptyState,
  HelpTip,
  Modal,
  PageHeader,
  RankMedal,
  SkeletonCards,
  Stat,
  TextField,
  XPBar,
} from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { useStudentOverview } from "../../lib/studentProgress";
import { levelInfo, totalXp, SCORING } from "../../lib/gamification";
// BADGES - ON HOLD (not agreed yet). To turn back on, uncomment the lines marked "BADGES" in this
// file (and add Award, Sparkles to the lucide import), plus BadgeShelf.jsx, BADGES in
// lib/gamification.js and the badge styles in styles/pages.css.
// import BadgeShelf from "../../components/student/BadgeShelf";
// import { deriveStats, earnedBadges } from "../../lib/gamification";
import { clearSession, getName, getUserId } from "../../lib/session";
import { useToast } from "../../lib/toast";
import { formatDuration } from "../../lib/format";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const levelKey = () => `archivai_seen_level_${getUserId() ?? "anon"}`;

function JoinRoomModal({ onClose, onJoined }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    // Codes are always 8 uppercase letters/digits (server/lib/rooms.js).
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) {
      setError("Enter the room code your teacher gave you.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { ok, data } = await api("/rooms/join", { method: "POST", body: { roomCode } });
      if (!ok) {
        setError(data.message === "Room not found" ? "No room has that code. Check it with your teacher." : errorMessage(data));
        return;
      }
      onJoined(data.room);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Join a room"
      description="Enter the code your teacher shared with the class."
      size="sm"
      onClose={onClose}
      busy={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form="join-room-form" loading={submitting} icon={KeyRound}>
            Join room
          </Button>
        </>
      }
    >
      <form id="join-room-form" onSubmit={submit} noValidate>
        <TextField
          label="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          error={error}
          hint="8 letters and numbers, e.g. K4T9QZ2M"
          maxLength={8}
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="code-input"
          data-autofocus
        />
      </form>
    </Modal>
  );
}

function StudentDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [showJoin, setShowJoin] = useState(false);
  const overview = useStudentOverview(reloadKey);
  const name = getName();

  useEffect(() => {
    if (overview.unauthorized) {
      clearSession();
      navigate("/");
    }
  }, [overview.unauthorized, navigate]);

  const { rooms } = overview;
  const ready = overview.status === "ready";

  // Only campaigns with a finished run count toward XP, once each.
  const runs = useMemo(
    () => rooms.flatMap((r) => (r.campaigns || []).filter((c) => c.run).map((c) => ({ ...c.run, roomId: r.id, scene: c.scene, title: c.title }))),
    [rooms]
  );
  const xp = totalXp(runs);
  // BADGES: const stats = deriveStats(runs, rooms.length);
  // BADGES: const earned = new Set(earnedBadges(stats).map((b) => b.id));
  const level = levelInfo(xp);
  const recent = [...runs].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 4);

  // A short celebration the first time a new level is seen in this browser.
  const [seenLevel] = useState(() => {
    try {
      return Number(localStorage.getItem(levelKey())) || 0;
    } catch {
      return 0;
    }
  });
  const leveledUp = ready && seenLevel > 0 && level.level > seenLevel;
  const announced = useRef(false);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(levelKey(), String(level.level));
    } catch {
      // storage blocked - no celebration memory, nothing else breaks
    }
    if (leveledUp && !announced.current) {
      announced.current = true;
      toast.success(`You reached level ${level.level}.`, { title: "Level up!" });
    }
  }, [ready, level.level, leveledUp, toast]);

  const handleJoined = (room) => {
    setShowJoin(false);
    toast.success(room?.name ? `You joined ${room.name}.` : "You joined the room.", { title: "Room joined" });
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Student"
        title={`${greeting()}, ${name || "there"}`}
        description="Your rooms, campaigns and progress."
        actions={
          <>
            <Button variant="secondary" icon={Palette} to="/student/character">
              My character
            </Button>
            <Button variant="accent" icon={KeyRound} onClick={() => setShowJoin(true)}>
              Join room
            </Button>
          </>
        }
      />

      {overview.status === "error" && !overview.unauthorized && (
        <Alert tone="danger" title="We couldn't load your adventure" action={<Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}>
          {overview.error}
        </Alert>
      )}

      {/* Progress hero */}
      <Card className="hero-card">
        {leveledUp && <Confetti />}
        <div className="hero-card__who">
          <Avatar name={name} size={64} />
          <div className="grow">
            <div className="row" style={{ "--gap": "8px" }}>
              <h2 className="hero-card__title">Your progress</h2>
              <Badge tone="xp">Preview</Badge>
              <HelpTip
                label="How XP works"
                text={`Preview rules: each campaign you finish is worth ${SCORING.campaignComplete} XP, plus a rank bonus (A +${SCORING.rankBonus.A}, B +${SCORING.rankBonus.B}, C +${SCORING.rankBonus.C}, D +${SCORING.rankBonus.D}) from your latest run. Each campaign counts once.`}
              />
            </div>
            {ready ? (
              <XPBar {...level} />
            ) : (
              <div className="skeleton" style={{ height: 44, marginTop: 8 }} aria-hidden="true" />
            )}
          </div>
        </div>
        <div className="stat-grid" style={{ "--cols": 2 }}>
          <Stat icon={CheckCircle2} tone="success" label="Campaigns completed" value={ready ? runs.length : "–"} />
          <Stat icon={DoorOpen} tone="primary" label="Rooms joined" value={ready ? rooms.length : "–"} />
          {/* BADGES (set --cols back to 3): <Stat icon={Award} tone="gold" label="Badges earned" value={ready ? `${earned.size}/5` : "–"} /> */}
        </div>
      </Card>

      <section className="section" aria-labelledby="rooms-heading">
        <div className="section__head">
          <h2 id="rooms-heading" className="section__title">
            My rooms
          </h2>
        </div>

        {overview.status === "loading" ? (
          <SkeletonCards count={3} />
        ) : ready && rooms.length === 0 ? (
          <EmptyState
            art={<BooksArt />}
            title="No rooms yet"
            action={
              <Button variant="accent" icon={KeyRound} onClick={() => setShowJoin(true)}>
                Join your first room
              </Button>
            }
          >
            Ask your teacher for a room code, then join to see its campaigns.
          </EmptyState>
        ) : (
          <div className="grid-cards">
            {rooms.map((room) => {
              const campaigns = room.campaigns;
              const done = campaigns ? campaigns.filter((c) => c.state === "completed").length : 0;
              return (
                <RoomCard
                  key={room.id}
                  name={room.name}
                  subtitle={room.teacher?.name ? `with ${room.teacher.name}` : undefined}
                  description={room.description}
                  meta={campaigns ? [{ icon: Compass, label: `${campaigns.length} ${campaigns.length === 1 ? "campaign" : "campaigns"} available` }] : []}
                  progress={campaigns && campaigns.length > 0 ? { done, total: campaigns.length, label: `${done} of ${campaigns.length} completed` } : undefined}
                  to={`/student/room/${room.id}`}
                  actionLabel="Enter room"
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="recent-heading">
        <div className="section__head">
          <h2 id="recent-heading" className="section__title">
            Recently completed
          </h2>
        </div>
        {!ready ? (
          <div className="skeleton" style={{ height: 160 }} aria-hidden="true" />
        ) : recent.length === 0 ? (
          <EmptyState icon={Trophy} title="No completed campaigns yet" plain>
            Finish a campaign and your rank and time will show up here.
          </EmptyState>
        ) : (
          <Card flush>
            <ul className="list" role="list">
              {recent.map((run) => (
                <li key={run.campaignId} className="list__item">
                  <RankMedal rank={run.rank} size={44} />
                  <div className="grow">
                    <p className="font-semibold truncate">{run.title || run.campaignTitle}</p>
                    <div className="row" style={{ "--gap": "8px", marginTop: 4 }}>
                      <SceneBadge scene={run.scene} />
                      <span className="text-xs text-muted row" style={{ "--gap": "4px" }}>
                        <Clock size={13} aria-hidden="true" /> {formatDuration(run.totalTime)}
                      </span>
                    </div>
                  </div>
                  <Link to={`/results/${run.campaignId}`} state={{ roomId: run.roomId }} className="btn btn--ghost btn--sm">
                    Results<span className="sr-only"> for {run.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* BADGES: put this back beside "Recently completed" inside <div className="split section">.
      <section aria-labelledby="badges-heading">
        <div className="section__head">
          <h2 id="badges-heading" className="section__title row" style={{ "--gap": "8px" }}>
            <Sparkles size={20} aria-hidden="true" style={{ color: "var(--color-gold)" }} /> Badges
          </h2>
          <Badge tone="xp">Preview</Badge>
        </div>
        <BadgeShelf earnedIds={earned} />
      </section>
      */}

      {showJoin && <JoinRoomModal onClose={() => setShowJoin(false)} onJoined={handleJoined} />}
    </div>
  );
}

export default StudentDashboard;
