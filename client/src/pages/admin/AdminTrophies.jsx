import { useState, useEffect } from "react";
import { Eye, Trophy, Trash2, UploadCloud, Plus, Replace } from "lucide-react";
import {
  Alert, Badge, Breadcrumbs, Button, Card, ConfirmDialog, EmptyState, LoadingState, Modal, PageHeader, Spinner, TextField,
} from "../../components/ui";
import TrophyViewer from "../../components/TrophyViewer";
import { loadEnvironments, useEnvironments } from "../../scenes";
import { API_URL, api, errorMessage } from "../../lib/api";
import { useToast } from "../../lib/toast";

const MAX_LABEL_LENGTH = 40;
const MAX_FILE_MB = 30;

// Admin: sets the 3D trophy of each Scene (see server/routes/sceneTrophies.js). Every Scene can have
// ONE trophy, a .glb model. The results page shows the trophy of the Scene that was played. Adding a
// trophy to a Scene that has none, replacing it, renaming it and removing it are all done here.
//
// The models are made in Blender and exported as .glb (File > Export > glTF 2.0, format "glTF Binary").
// Keep the textures small: the limit is 30 MB per model.
//
// PREVIEW RESULTS PAGE - each trophy has a "Preview results page" button that opens the page a student
// sees at the end of a campaign, with a made-up run, this trophy and a rank picked by the admin (see
// AdminTrophyPreview.jsx). It is only a preview and changes nothing.

// "Add / replace the trophy" dialog for one Scene: an optional name and the .glb file. When the Scene
// already has a trophy, leaving the file empty only renames it.
function TrophyModal({ scene, trophy, onClose, onSaved }) {
  const replacing = Boolean(trophy);
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState(trophy?.label || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFileSelected = (e) => {
    const picked = e.target.files[0];
    e.target.value = ""; // lets the same file be re-selected after a cancel
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith(".glb")) {
      setError("Choose a .glb file.");
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is too big. The limit is ${MAX_FILE_MB} MB.`);
      return;
    }
    setError("");
    setFile(picked);
    // Suggest a name from the file name for a new trophy, which the admin can change.
    if (!label.trim()) setLabel(picked.name.replace(/\.glb$/i, "").replace(/[_-]+/g, " ").trim().slice(0, MAX_LABEL_LENGTH));
  };

  const handleSave = async () => {
    if (!file && !replacing) {
      setError("Choose a .glb file.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("label", label.trim());
      if (file) formData.append("file", file);
      const { ok, data } = await api(`/admin/scene-trophies/${scene.key}`, { method: "PUT", body: formData });
      if (!ok) {
        setError(errorMessage(data, "Upload failed."));
        return;
      }
      onSaved(data);
    } catch {
      setError("Couldn't reach the server. The trophy wasn't saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={replacing ? `Change the ${scene.label} trophy` : `Add a trophy to ${scene.label}`}
      description="Upload the 3D model (.glb) that shows on the results page after this Scene is played."
      size="md"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" icon={replacing ? Replace : Plus} onClick={handleSave} loading={saving}>
            {replacing ? "Save trophy" : "Add trophy"}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error && <Alert tone="danger">{error}</Alert>}
        <TextField
          label="Name"
          optional
          value={label}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`e.g. "${scene.label} trophy"`}
          hint="If left empty, the Scene's name is used."
          data-autofocus
        />
        <label className="dropzone" data-busy={saving || undefined}>
          {saving ? <Spinner size={24} /> : <UploadCloud size={28} aria-hidden="true" />}
          <span className="font-semibold break-words">{saving ? "Uploading..." : file ? file.name : replacing ? "Choose a new .glb file (optional)" : "Choose a .glb file"}</span>
          <span className="text-xs text-muted">Up to {MAX_FILE_MB} MB.{replacing ? " Leave it empty to keep the current model." : ""}</span>
          <input type="file" accept=".glb,model/gltf-binary" onChange={handleFileSelected} disabled={saving} className="sr-only" />
        </label>
      </div>
    </Modal>
  );
}

function AdminTrophies() {
  const toast = useToast();
  const scenes = useEnvironments();

  const [trophies, setTrophies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null); // the Scene whose dialog is open
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadEnvironments(true);
        const { ok, data } = await api("/scene-trophies");
        if (cancelled) return;
        if (!ok) {
          setLoadError(errorMessage(data, "Failed to load the trophies."));
          return;
        }
        setLoadError("");
        setTrophies(Array.isArray(data) ? data : []);
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

  const refresh = () => setReloadKey((k) => k + 1);
  const trophyOf = (scene) => trophies.find((t) => t.sceneKey === scene.key);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const { ok, data } = await api(`/admin/scene-trophies/${deleteTarget.scene.key}`, { method: "DELETE" });
      if (!ok) {
        setDeleteError(errorMessage(data));
        return;
      }
      toast.success(`The ${deleteTarget.scene.label} trophy was removed.`);
      setDeleteTarget(null);
      refresh();
    } catch {
      setDeleteError("Couldn't reach the server. Nothing was removed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", to: "/admin/dashboard" }, { label: "Trophies" }]} />}
        eyebrow="Admin"
        title="Trophies"
        description="Each Scene can have one 3D trophy. It is shown on the results page after a student finishes a campaign set in that Scene."
      />

      {loadError && (
        <Alert tone="danger" title="Couldn't load the trophies" action={<Button size="sm" onClick={refresh}>Try again</Button>}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading trophies..." />
      ) : !loadError && scenes.length === 0 ? (
        <EmptyState icon={Trophy} title="No Scenes yet">
          Add a Scene on the Admin dashboard first, then give it a trophy here.
        </EmptyState>
      ) : (
        !loadError && (
          <ul className="stack" role="list" style={{ listStyle: "none" }}>
            {scenes.map((scene) => {
              const trophy = trophyOf(scene);
              return (
                <li key={scene.key}>
                  <Card className="set-card" style={{ "--scene": scene.color, "--scene-soft": scene.soft }}>
                    <div className="set-card__head">
                      <h2 className="card__title grow row" style={{ "--gap": "6px" }}>
                        <scene.Icon size={18} aria-hidden="true" style={{ color: scene.color }} /> {scene.label}{" "}
                        {trophy ? <Badge tone="success">Has a trophy</Badge> : <Badge>No trophy</Badge>}
                      </h2>
                      <div className="row row-nowrap" style={{ "--gap": "8px" }}>
                        <Button variant={trophy ? "secondary" : "primary"} size="sm" icon={trophy ? Replace : Plus} onClick={() => setEditing(scene)}>
                          {trophy ? "Change" : "Add trophy"}
                          <span className="sr-only"> for {scene.label}</span>
                        </Button>
                        {trophy && (
                          <Button variant="secondary" size="sm" icon={Eye} to={`/admin/trophies/${scene.key}/preview`}>
                            Preview results page
                            <span className="sr-only"> for {scene.label}</span>
                          </Button>
                        )}
                        {trophy && (
                          <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => { setDeleteError(""); setDeleteTarget({ scene, trophy }); }}>
                            Remove
                            <span className="sr-only"> the {scene.label} trophy</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    {trophy ? (
                      <>
                        <p className="text-sm text-muted break-words">{trophy.label}</p>
                        <TrophyViewer key={trophy.src} src={`${API_URL}${trophy.src}`} label={`Preview of the ${scene.label} trophy`} />
                      </>
                    ) : (
                      <p className="text-sm text-muted">No trophy yet. The results page for this Scene shows no trophy until one is added.</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )
      )}

      {editing && (
        <TrophyModal
          scene={editing}
          trophy={trophyOf(editing)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            toast.success(`The ${editing.label} trophy was saved.`);
            setEditing(null);
            refresh();
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={`Remove the ${deleteTarget.scene.label} trophy?`}
          confirmLabel="Remove trophy"
          loading={deleting}
          error={deleteError}
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
          onConfirm={handleDelete}
        >
          <p>The uploaded model is deleted too, and the results page for this Scene shows no trophy. This can't be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AdminTrophies;
