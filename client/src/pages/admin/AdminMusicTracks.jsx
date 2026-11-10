import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Music, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
import {
  Alert, Badge, Breadcrumbs, Button, Card, ConfirmDialog, EmptyState, IconButton, LoadingState, Modal, PageHeader, Spinner, TextField,
} from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { toPlayerTrack, useMusic, useSuspendMusic } from "../../lib/music";
import { useToast } from "../../lib/toast";

const MAX_LABEL_LENGTH = 40;
const MAX_FILE_MB = 15;

// Admin: manages the website's background music (see client/src/components/MusicProvider.jsx and
// server/routes/musicTracks.js). The order here is the order the tracks are offered in, and the
// first visible track is the one played before anyone has picked one. A hidden track stays here but
// isn't offered to anyone else. After every change the site's own music list is reloaded too.
//
// The first four tracks are files in client/public/audio/ (they came with the website); tracks added
// here are uploaded to the server. Deleting a track removes an uploaded file, but never one of the
// four files in client/public/audio/.

// "Add a track" dialog: name + .mp3 file, sent together.
function AddTrackModal({ onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFileSelected = (e) => {
    const picked = e.target.files[0];
    e.target.value = ""; // lets the same file be re-selected after a cancel
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith(".mp3")) {
      setServerError("Choose an .mp3 file.");
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      setServerError(`That file is too big. The limit is ${MAX_FILE_MB} MB.`);
      return;
    }
    setServerError("");
    setFile(picked);
    // Suggest a name from the file name, which the admin can change.
    if (!label.trim()) setLabel(picked.name.replace(/\.mp3$/i, "").replace(/[_-]+/g, " ").trim().slice(0, MAX_LABEL_LENGTH));
  };

  const handleCreate = async () => {
    const nextErrors = {};
    if (!label.trim()) nextErrors.label = "Give this track a name.";
    if (!file) nextErrors.file = "Choose an .mp3 file.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setServerError("");
    try {
      const formData = new FormData();
      formData.append("label", label.trim());
      formData.append("file", file);
      const { ok, data } = await api("/admin/music-tracks", { method: "POST", body: formData });
      if (!ok) {
        setServerError(errorMessage(data, "Upload failed."));
        return;
      }
      onCreated(data.label);
    } catch {
      setServerError("Couldn't reach the server. The track wasn't added.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add a track"
      description="Upload an .mp3 file to play as background music."
      size="md"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} onClick={handleCreate} loading={saving}>
            Add track
          </Button>
        </>
      }
    >
      <div className="stack">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <TextField label="Name" required value={label} maxLength={MAX_LABEL_LENGTH} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Calm Library"' error={errors.label} data-autofocus />
        <label className="dropzone" data-busy={saving || undefined}>
          {saving ? <Spinner size={24} /> : <UploadCloud size={28} aria-hidden="true" />}
          <span className="font-semibold break-words">{saving ? "Uploading..." : file ? file.name : "Choose an .mp3 file"}</span>
          <span className="text-xs text-muted">Up to {MAX_FILE_MB} MB. It loops while it plays.</span>
          <input type="file" accept=".mp3,audio/mpeg" onChange={handleFileSelected} disabled={saving} className="sr-only" />
        </label>
        {errors.file && (
          <p className="field__error" role="alert">
            {errors.file}
          </p>
        )}
      </div>
    </Modal>
  );
}

function AdminMusicTracks() {
  const toast = useToast();
  const { refreshTracks } = useMusic();
  // The previews on this page play sound, so the site's own music is paused while the page is open.
  useSuspendMusic();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  // Reloads this page's list and the site's own music list.
  const refresh = () => {
    setReloadKey((k) => k + 1);
    refreshTracks();
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { ok, data } = await api("/admin/music-tracks");
        if (cancelled) return;
        if (!ok) {
          setLoadError(errorMessage(data, "Failed to load the music tracks."));
          return;
        }
        setLoadError("");
        setTracks(Array.isArray(data) ? [...data].sort((a, b) => a.orderNumber - b.orderNumber) : []);
      } catch {
        if (!cancelled) setLoadError("Couldn't reach the server. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Shared request runner for the inline edits: shows the server's message on failure.
  const run = async (request, success) => {
    setSaving(true);
    try {
      const results = await Promise.all([].concat(request()));
      const failed = results.find((r) => !r.ok);
      if (failed) {
        toast.error(errorMessage(failed.data), { title: "Not saved" });
        return false;
      }
      if (success) toast.success(success);
      refresh();
      return true;
    } catch {
      toast.error("Couldn't reach the server.", { title: "Not saved" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id) => {
    if (!editLabel.trim()) return;
    if (await run(() => api(`/admin/music-tracks/${id}`, { method: "PATCH", body: { label: editLabel.trim() } }), "Name saved.")) setEditingId(null);
  };

  const handleToggleHidden = (track) =>
    run(
      () => api(`/admin/music-tracks/${track.id}`, { method: "PATCH", body: { isHidden: !track.isHidden } }),
      track.isHidden ? `“${track.label}” is visible again.` : `“${track.label}” is hidden.`
    );

  // Swaps orderNumber with the adjacent track - the music menu reads that same order.
  const handleMove = (track, direction) => {
    const index = tracks.findIndex((t) => t.id === track.id);
    const other = tracks[index + direction];
    if (!other) return;
    run(() => [
      api(`/admin/music-tracks/${track.id}`, { method: "PATCH", body: { orderNumber: other.orderNumber } }),
      api(`/admin/music-tracks/${other.id}`, { method: "PATCH", body: { orderNumber: track.orderNumber } }),
    ]);
  };

  const handleDelete = async () => {
    setSaving(true);
    setDeleteError("");
    try {
      const { ok, data } = await api(`/admin/music-tracks/${deleteTarget.id}`, { method: "DELETE" });
      if (!ok) {
        setDeleteError(errorMessage(data));
        return;
      }
      toast.success(`“${deleteTarget.label}” was deleted.`);
      setDeleteTarget(null);
      refresh();
    } catch {
      setDeleteError("Couldn't reach the server. Nothing was deleted.");
    } finally {
      setSaving(false);
    }
  };

  // The track played before anyone has picked one: the first that isn't hidden.
  const defaultId = tracks.find((t) => !t.isHidden)?.id;

  return (
    <div className="page page--narrow">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", to: "/admin/dashboard" }, { label: "Background music" }]} />}
        eyebrow="Admin"
        title="Background music"
        description="The tracks people can pick from the music button. The order here is the order they're offered in - the first visible track plays by default."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>
            Add track
          </Button>
        }
      />

      {loadError && (
        <Alert tone="danger" title="Couldn't load the tracks" action={<Button size="sm" onClick={refresh}>Try again</Button>}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading music tracks..." />
      ) : !loadError && tracks.length === 0 ? (
        <EmptyState icon={Music} title="No music tracks" action={<Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add the first track</Button>}>
          Upload an .mp3 file to give the website some background music.
        </EmptyState>
      ) : (
        !loadError && (
          <div className="stack">
            <ol className="stack" role="list" style={{ listStyle: "none" }}>
              {tracks.map((track, i) => (
                <li key={track.id}>
                  <Card className="set-card">
                    <div className="set-card__head">
                      <span className="slot-row__num" aria-hidden="true">
                        {i + 1}
                      </span>
                      {editingId === track.id ? (
                        <form
                          className="row grow row-nowrap"
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRename(track.id);
                          }}
                        >
                          <label className="sr-only" htmlFor={`rename-${track.id}`}>
                            Name for {track.label}
                          </label>
                          <input id={`rename-${track.id}`} className="input grow" value={editLabel} maxLength={MAX_LABEL_LENGTH} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
                          <IconButton icon={Check} label="Save name" type="submit" disabled={saving || !editLabel.trim()} />
                          <IconButton icon={X} label="Cancel renaming" onClick={() => setEditingId(null)} />
                        </form>
                      ) : (
                        <>
                          <h2 className="card__title grow break-words">
                            {track.label}{" "}
                            {track.id === defaultId && <Badge tone="accent" title="Plays first, before anyone has picked a track">Default</Badge>}{" "}
                            {track.isHidden && <Badge title="Not offered to anyone else">Hidden</Badge>}
                          </h2>
                          <div className="row row-nowrap" style={{ "--gap": "2px" }}>
                            <IconButton
                              icon={track.isHidden ? Eye : EyeOff}
                              size="sm"
                              label={track.isHidden ? `Show ${track.label}` : `Hide ${track.label}`}
                              onClick={() => handleToggleHidden(track)}
                              disabled={saving}
                            />
                            <IconButton icon={Pencil} size="sm" label={`Rename ${track.label}`} onClick={() => { setEditingId(track.id); setEditLabel(track.label); }} />
                            <IconButton icon={ArrowUp} size="sm" label={`Move ${track.label} up`} onClick={() => handleMove(track, -1)} disabled={i === 0 || saving} />
                            <IconButton icon={ArrowDown} size="sm" label={`Move ${track.label} down`} onClick={() => handleMove(track, 1)} disabled={i === tracks.length - 1 || saving} />
                            <IconButton icon={Trash2} size="sm" variant="danger-ghost" label={`Delete ${track.label}`} onClick={() => setDeleteTarget(track)} disabled={saving} />
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted">{track.src.startsWith("/uploads/") ? "Uploaded file" : "Built-in file (client/public/audio)"}</p>
                    <audio controls preload="none" src={toPlayerTrack(track).src} style={{ width: "100%" }}>
                      Your browser can't play this preview.
                    </audio>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        )
      )}

      {showAdd && (
        <AddTrackModal
          onClose={() => setShowAdd(false)}
          onCreated={(label) => {
            setShowAdd(false);
            toast.success(`“${label}” was added.`);
            refresh();
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete “${deleteTarget.label}”?`}
          confirmLabel="Delete track"
          loading={saving}
          error={deleteError}
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
          onConfirm={handleDelete}
        >
          <p>
            Anyone who had it selected goes back to the default track.{" "}
            {deleteTarget.src.startsWith("/uploads/")
              ? "The uploaded file is deleted too. This can't be undone."
              : "The file in client/public/audio stays in the project; only the entry is removed. This can't be undone."}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AdminMusicTracks;
