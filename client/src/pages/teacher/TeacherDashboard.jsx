import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, DoorOpen, MoreVertical, Plus, Sparkles, Trash2, Users } from "lucide-react";
import RoomCard from "../../components/RoomCard";
import { BooksArt } from "../../components/Illustrations";
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Menu,
  Modal,
  PageHeader,
  SelectField,
  SkeletonCards,
  Stat,
  TextAreaField,
  TextField,
} from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { clearSession, getName } from "../../lib/session";
import { useToast } from "../../lib/toast";
import { plural } from "../../lib/format";

// Create a room (POST /api/rooms). Name is required; description optional.
function CreateRoomModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dirty = name.trim() || description.trim();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = () => (dirty && !submitting ? setConfirmDiscard(true) : onClose());

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the room a name, like “Period 3 Biology”.");
      return;
    }
    setError("");
    setServerError("");
    setSubmitting(true);
    try {
      const { ok, data } = await api("/rooms", { method: "POST", body: { name: name.trim(), description: description.trim() } });
      if (!ok) {
        setServerError(errorMessage(data));
        return;
      }
      onCreated(data);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        title="Create a room"
        description="A room is one class. Students join it with its code."
        size="sm"
        onClose={requestClose}
        busy={submitting}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="accent" type="submit" form="create-room-form" loading={submitting} icon={Plus}>
              Create room
            </Button>
          </>
        }
      >
        <form id="create-room-form" className="stack" onSubmit={submit} noValidate>
          {serverError && <Alert tone="danger">{serverError}</Alert>}
          <TextField label="Room name" value={name} onChange={(e) => setName(e.target.value)} error={error} required maxLength={120} data-autofocus />
          <TextAreaField label="Description" optional value={description} onChange={(e) => setDescription(e.target.value)} rows={3} hint="What class or topic is this room for?" />
        </form>
      </Modal>
      {confirmDiscard && (
        <ConfirmDialog title="Discard this room?" confirmLabel="Discard" cancelLabel="Keep editing" onCancel={() => setConfirmDiscard(false)} onConfirm={onClose}>
          <p>What you've typed won't be saved.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// "Create campaign" from the dashboard: campaigns live inside a room, so pick one first.
function PickRoomModal({ rooms, onClose, onPick }) {
  const [roomId, setRoomId] = useState(String(rooms[0]?.id || ""));
  return (
    <Modal
      title="Create a campaign"
      description="Which room is this campaign for?"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => onPick(roomId)} icon={Sparkles}>
            Continue
          </Button>
        </>
      }
    >
      <SelectField label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} data-autofocus>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </SelectField>
    </Modal>
  );
}

function TeacherDashboard() {
  const [rooms, setRooms] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showPickRoom, setShowPickRoom] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // room being confirmed for deletion
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { ok, status, data } = await api("/rooms");
        if (cancelled) return;
        if (!ok) {
          if (status === 401) {
            clearSession();
            navigate("/");
            return;
          }
          setLoadError(errorMessage(data, "Couldn't load your rooms."));
          return;
        }
        setLoadError("");
        setRooms(data);
      } catch {
        if (!cancelled) setLoadError("Couldn't reach the server. Check your connection and try again.");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate, reloadKey]);

  const handleCreated = (room) => {
    setShowCreate(false);
    toast.success(`Share the code ${room.roomCode} with your students.`, { title: `“${room.name}” is ready` });
    setReloadKey((k) => k + 1);
  };

  // Called from the confirmation dialog, not directly from the menu, since this
  // is a destructive, unrecoverable action.
  const handleDeleteRoom = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { ok, data } = await api(`/rooms/${deleteTarget.id}`, { method: "DELETE" });
      if (!ok) {
        setDeleteError(errorMessage(data));
        return;
      }
      toast.success(`“${deleteTarget.name}” was deleted.`);
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch {
      setDeleteError("Couldn't reach the server. Nothing was deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const startCampaign = () => {
    if (!rooms?.length) return;
    if (rooms.length === 1) navigate(`/teacher/room/${rooms[0].id}`, { state: { createCampaign: true } });
    else setShowPickRoom(true);
  };

  const totalStudents = (rooms || []).reduce((sum, r) => sum + (r._count?.students || 0), 0);
  const totalCampaigns = (rooms || []).reduce((sum, r) => sum + (r._count?.campaigns || 0), 0);
  const loading = rooms === null && !loadError;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Teacher"
        title={`Welcome back${getName() ? `, ${getName()}` : ""}`}
        description="Your rooms, campaigns and classes at a glance."
        actions={
          <>
            <Button variant="secondary" icon={Plus} onClick={() => setShowCreate(true)}>
              New room
            </Button>
            <Button
              variant="accent"
              icon={Sparkles}
              onClick={startCampaign}
              disabled={!rooms?.length}
              title={rooms && rooms.length === 0 ? "Create a room first" : undefined}
            >
              Create campaign
            </Button>
          </>
        }
      />

      {loadError && (
        <Alert tone="danger" title="We couldn't load your rooms" action={<Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}>
          {loadError}
        </Alert>
      )}

      <div className="stat-grid" style={{ "--cols": 3 }}>
        <Stat icon={DoorOpen} tone="teacher" label="Rooms" value={loading ? "–" : rooms?.length ?? "–"} />
        <Stat icon={Users} tone="primary" label="Student enrolments" value={loading ? "–" : totalStudents} hint="Across all rooms" />
        <Stat icon={BookOpen} tone="success" label="Campaigns" value={loading ? "–" : totalCampaigns} hint="Drafts and published" />
      </div>

      <section className="section" aria-labelledby="rooms-heading">
        <div className="section__head">
          <h2 id="rooms-heading" className="section__title">
            Your rooms
          </h2>
        </div>

        {loading ? (
          <SkeletonCards count={3} />
        ) : rooms && rooms.length === 0 ? (
          <EmptyState
            art={<BooksArt />}
            title="Create your first room"
            action={
              <Button variant="accent" icon={Plus} onClick={() => setShowCreate(true)}>
                Create a room
              </Button>
            }
          >
            Each room gets a join code for your students. Then add campaigns - escape-room games built from your lessons.
          </EmptyState>
        ) : (
          <div className="grid-cards">
            {(rooms || []).map((room) => (
              <RoomCard
                key={room.id}
                name={room.name}
                code={room.roomCode}
                description={room.description}
                meta={[
                  { icon: Users, label: plural(room._count?.students || 0, "student") },
                  { icon: BookOpen, label: plural(room._count?.campaigns || 0, "campaign") },
                ]}
                to={`/teacher/room/${room.id}`}
                menu={
                  <Menu
                    label={`${room.name} options`}
                    items={[{ label: "Delete room", icon: Trash2, danger: true, onSelect: () => setDeleteTarget(room) }]}
                    renderTrigger={(props) => <IconButton icon={MoreVertical} label={`Options for ${room.name}`} size="sm" {...props} />}
                  />
                }
              />
            ))}
          </div>
        )}
      </section>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {showPickRoom && rooms && (
        <PickRoomModal
          rooms={rooms}
          onClose={() => setShowPickRoom(false)}
          onPick={(id) => navigate(`/teacher/room/${id}`, { state: { createCampaign: true } })}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete “${deleteTarget.name}”?`}
          confirmLabel="Delete room"
          loading={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          onConfirm={handleDeleteRoom}
        >
          <p>
            This permanently deletes the room
            {deleteTarget._count?.campaigns > 0 ? ` and its ${plural(deleteTarget._count.campaigns, "campaign")}` : ""}, along with its
            student list and play history.
          </p>
          <p className="font-semibold">This can't be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default TeacherDashboard;
