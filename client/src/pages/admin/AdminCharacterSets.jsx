import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, Check, Eye, Pencil, Plus, Search, Trash2, UploadCloud, X } from "lucide-react";
import CharacterCustomizer3D from "../../components/CharacterCustomizer3D";
import {
  Alert, Badge, Breadcrumbs, Button, Card, ConfirmDialog, EmptyState, IconButton, LoadingState, Modal, PageHeader, SelectField, Spinner, TextField,
} from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { useToast } from "../../lib/toast";

const SLOT_NAMES = ["Head", "Body", "Arm", "Leg"];
const EMPTY_MAPPING = { Head: "", Body: "", Arm: "", Leg: "" };

// Admin: manages the catalog of character models shown on the website's Customize Character
// scene (see client/src/components/CharacterCustomizer3D.jsx and server/routes/characterSets.js).
// Adding a character here is a two-step upload: pick a .glb, then assign whichever mesh names the
// server found inside it to Head/Body/Arm/Leg - GLBs aren't guaranteed to follow any naming
// convention, so that mapping has to be done by hand rather than guessed. Renaming/reordering an
// existing set, or deleting one, doesn't need the file re-uploaded.
//
// NOT HANDLED HERE - a newly-added set previews correctly on the website, but won't appear in the
// real Unity gameplay build until someone also imports a matching FBX into the Unity project and
// adds it to CharacterPartRegistryAsset by hand (needs the Unity Editor, can't be done from a
// browser upload) - see character-customization project notes.
//
// Each slot's optionId - the string actually sent to Unity/CharacterLoadout for that slot's part -
// is auto-generated server-side to match whatever Unity's own CharacterPartRegistryEditor.cs will
// auto-generate for that slot's Nth option (head001, head002, ...). That only holds if options
// are added in the same order on both sides, so each one can also be edited directly (PATCH
// /admin/character-sets/:id/slots/:slotId) if the two ever drift out of sync.
//
// THE FIRST SET IN THE LIST IS THE BASE LOOK, AUTOMATICALLY - the server gives its slots the "000"
// ids (head000, body000, ...) and numbers the rest 001, 002, ... in list order, so moving a set to
// the top makes it the base. "000" is never something Unity's own registry auto-generates, so
// Unity leaves that part showing the character prefab's own default mesh.

// Two-step "add character" dialog: upload + parse the .glb, then map its meshes to slots.
function AddCharacterModal({ onClose, onCreated }) {
  const [uploading, setUploading] = useState(false);
  const [parsedUpload, setParsedUpload] = useState(null); // { glbFilename, nodeNames }
  const [label, setLabel] = useState("");
  const [mapping, setMapping] = useState(EMPTY_MAPPING);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // lets the same file be re-selected after a cancel
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setServerError("Choose a .glb file.");
      return;
    }

    setUploading(true);
    setServerError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { ok, data } = await api("/admin/character-sets/parse-upload", { method: "POST", body: formData });
      if (!ok) {
        setServerError(errorMessage(data, "Upload failed."));
        return;
      }
      setParsedUpload(data);
      setMapping(EMPTY_MAPPING);
    } catch {
      setServerError("Couldn't reach the server. Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    const nextErrors = {};
    if (!label.trim()) nextErrors.label = "Give this character a name.";
    const slots = SLOT_NAMES.filter((slot) => mapping[slot]).map((slot) => ({ slot, meshName: mapping[slot] }));
    if (slots.length === 0) nextErrors.mapping = "Assign at least one mesh to a body part.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setServerError("");
    try {
      const { ok, data } = await api("/admin/character-sets", { method: "POST", body: { label: label.trim(), glbFilename: parsedUpload.glbFilename, slots } });
      if (!ok) {
        setServerError(errorMessage(data));
        return;
      }
      onCreated(label.trim());
    } catch {
      setServerError("Couldn't reach the server. The character wasn't added.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add a character"
      description={parsedUpload ? "Step 2 of 2 - name it and map its meshes" : "Step 1 of 2 - upload the model"}
      size="md"
      onClose={onClose}
      busy={uploading || saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          {parsedUpload && (
            <Button variant="primary" icon={Plus} onClick={handleCreate} loading={saving}>
              Add character
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        {!parsedUpload ? (
          <label className="dropzone" data-busy={uploading || undefined}>
            {uploading ? <Spinner size={24} /> : <UploadCloud size={28} aria-hidden="true" />}
            <span className="font-semibold">{uploading ? "Reading the file..." : "Choose a .glb file"}</span>
            <span className="text-xs text-muted">Every character set must share the same skeleton as the base model.</span>
            <input type="file" accept=".glb" onChange={handleFileSelected} disabled={uploading} className="sr-only" />
          </label>
        ) : (
          <>
            <Alert tone="success">
              Found {parsedUpload.nodeNames.length} named {parsedUpload.nodeNames.length === 1 ? "mesh" : "meshes"} in the file. Assign this character's parts below - leave
              a part empty if the model doesn't provide it.
            </Alert>
            <TextField label="Display name" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Robot"' error={errors.label} data-autofocus />
            <div className="mapping-grid">
              {SLOT_NAMES.map((slot) => (
                <SelectField key={slot} label={slot} value={mapping[slot]} onChange={(e) => setMapping((prev) => ({ ...prev, [slot]: e.target.value }))}>
                  <option value="">— none —</option>
                  {parsedUpload.nodeNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </SelectField>
              ))}
            </div>
            {errors.mapping && (
              <p className="field__error" role="alert">
                {errors.mapping}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// 3D preview of one set on its own, using the same renderer as Customize Character.
function PreviewModal({ set, onClose }) {
  const selections = Object.fromEntries(set.slots.map((s) => [s.slot, s.optionId]));
  return (
    <Modal title={set.label} description="Preview - drag to rotate" size="md" onClose={onClose} closeOnBackdrop>
      <div className="set-preview">
        <CharacterCustomizer3D characterSets={[set]} selections={selections} />
      </div>
    </Modal>
  );
}

function AdminCharacterSets() {
  const toast = useToast();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [previewSet, setPreviewSet] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  // Same editing pattern as editingId/editLabel, but for one slot's optionId at a time - keyed by
  // "<setId>:<slotRowId>" since a set can have up to 4 editable IDs at once.
  const [editingOptionKey, setEditingOptionKey] = useState(null);
  const [editOptionIdValue, setEditOptionIdValue] = useState("");

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { ok, data } = await api("/character-sets");
        if (cancelled) return;
        if (!ok) {
          setLoadError(errorMessage(data, "Failed to load character sets."));
          return;
        }
        setLoadError("");
        setSets(Array.isArray(data) ? [...data].sort((a, b) => a.orderNumber - b.orderNumber) : []);
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
    if (await run(() => api(`/admin/character-sets/${id}`, { method: "PATCH", body: { label: editLabel.trim() } }), "Name saved.")) setEditingId(null);
  };

  // Overrides one slot's optionId directly - see PATCH /admin/character-sets/:id/slots/:slotId's
  // own header for why this exists.
  const handleUpdateOptionId = async (setId, slotRowId) => {
    if (!editOptionIdValue.trim()) return;
    if (await run(() => api(`/admin/character-sets/${setId}/slots/${slotRowId}`, { method: "PATCH", body: { optionId: editOptionIdValue.trim() } }), "Option ID saved."))
      setEditingOptionKey(null);
  };

  // Swaps orderNumber with the adjacent set - the picker reads that same order, so this also
  // controls which character a student sees first.
  const handleMove = (set, direction) => {
    const index = sets.findIndex((s) => s.id === set.id);
    const other = sets[index + direction];
    if (!other) return;
    run(() => [
      api(`/admin/character-sets/${set.id}`, { method: "PATCH", body: { orderNumber: other.orderNumber } }),
      api(`/admin/character-sets/${other.id}`, { method: "PATCH", body: { orderNumber: set.orderNumber } }),
    ]);
  };

  const handleDelete = async () => {
    setSaving(true);
    setDeleteError("");
    try {
      const { ok, data } = await api(`/admin/character-sets/${deleteTarget.id}`, { method: "DELETE" });
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

  const q = query.trim().toLowerCase();
  const visible = sets.map((set, i) => ({ set, i })).filter(({ set }) => !q || set.label.toLowerCase().includes(q) || set.slots.some((s) => s.meshName.toLowerCase().includes(q)));

  return (
    <div className="page page--narrow">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", to: "/admin/dashboard" }, { label: "Character sets" }]} />}
        eyebrow="Admin"
        title="Character sets"
        description="The characters players can pick from. The order here is the order they're offered in - the first set is the default everyone starts with."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>
            Add character
          </Button>
        }
      />

      <Alert tone="info" className="section__alert">
        New sets preview on the website right away. To appear in the Unity game too, a matching model must be added to the Unity project's part registry.
      </Alert>

      {loadError && (
        <Alert tone="danger" title="Couldn't load the catalog" action={<Button size="sm" onClick={refresh}>Try again</Button>}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading character sets..." />
      ) : !loadError && sets.length === 0 ? (
        <EmptyState icon={UploadCloud} title="No character sets yet" action={<Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add the first character</Button>}>
          Upload a .glb model and map its head, body, arms and legs.
        </EmptyState>
      ) : (
        !loadError && (
          <div className="stack">
            <TextField label="Search character sets" icon={Search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or mesh" className="toolbar__search" />
            {visible.length === 0 && <EmptyState plain icon={Search} title="No sets match">Try another name.</EmptyState>}
            <ol className="stack" role="list" style={{ listStyle: "none" }}>
              {visible.map(({ set, i }) => (
                <li key={set.id}>
                  <Card className="set-card">
                    <div className="set-card__head">
                      <span className="slot-row__num" aria-hidden="true">
                        {i + 1}
                      </span>
                      {editingId === set.id ? (
                        <form
                          className="row grow row-nowrap"
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRename(set.id);
                          }}
                        >
                          <label className="sr-only" htmlFor={`rename-${set.id}`}>
                            Name for {set.label}
                          </label>
                          <input id={`rename-${set.id}`} className="input grow" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
                          <IconButton icon={Check} label="Save name" type="submit" disabled={saving || !editLabel.trim()} />
                          <IconButton icon={X} label="Cancel renaming" onClick={() => setEditingId(null)} />
                        </form>
                      ) : (
                        <>
                          <h2 className="card__title grow break-words">
                            {set.label} {i === 0 && <Badge tone="accent" title="First set - sends the 000 ids, so Unity keeps its own default mesh">Base</Badge>}
                          </h2>
                          <div className="row row-nowrap" style={{ "--gap": "2px" }}>
                            <IconButton icon={Eye} size="sm" label={`Preview ${set.label}`} onClick={() => setPreviewSet(set)} />
                            <IconButton icon={Pencil} size="sm" label={`Rename ${set.label}`} onClick={() => { setEditingId(set.id); setEditLabel(set.label); }} />
                            <IconButton icon={ArrowUp} size="sm" label={`Move ${set.label} up`} onClick={() => handleMove(set, -1)} disabled={i === 0 || saving || !!q} />
                            <IconButton icon={ArrowDown} size="sm" label={`Move ${set.label} down`} onClick={() => handleMove(set, 1)} disabled={i === sets.length - 1 || saving || !!q} />
                            <IconButton icon={Trash2} size="sm" variant="danger-ghost" label={`Delete ${set.label}`} onClick={() => setDeleteTarget(set)} disabled={saving} />
                          </div>
                        </>
                      )}
                    </div>

                    <table className="data-table set-card__slots">
                      <caption className="sr-only">Body parts of {set.label}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Part</th>
                          <th scope="col">Mesh in file</th>
                          <th scope="col">Option ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SLOT_NAMES.map((slot) => {
                          const match = set.slots.find((s) => s.slot === slot);
                          // Keyed by set + the slot ROW's own id, so it's unique across every set on the page.
                          const editKey = match ? `${set.id}:${match.id}` : null;
                          return (
                            <tr key={slot}>
                              <td data-primary className="font-semibold">{slot}</td>
                              <td data-label="Mesh" className="mono break-words">{match ? match.meshName : "—"}</td>
                              <td data-label="Option ID">
                                {!match ? (
                                  "—"
                                ) : editingOptionKey === editKey ? (
                                  <form
                                    className="row row-nowrap"
                                    style={{ "--gap": "4px" }}
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      handleUpdateOptionId(set.id, match.id);
                                    }}
                                  >
                                    <label className="sr-only" htmlFor={`opt-${editKey}`}>
                                      Option ID for {set.label} {slot}
                                    </label>
                                    <input id={`opt-${editKey}`} className="input mono" style={{ width: 120, minHeight: 36 }} value={editOptionIdValue} onChange={(e) => setEditOptionIdValue(e.target.value)} autoFocus />
                                    <IconButton icon={Check} size="sm" label="Save option ID" type="submit" disabled={saving} />
                                    <IconButton icon={X} size="sm" label="Cancel" onClick={() => setEditingOptionKey(null)} />
                                  </form>
                                ) : (
                                  <span className="row row-nowrap" style={{ "--gap": "4px" }}>
                                    <span className="mono">{match.optionId}</span>
                                    <IconButton
                                      icon={Pencil}
                                      size="sm"
                                      label={`Edit option ID for ${set.label} ${slot} - must match the ID in Unity's CharacterPartRegistryAsset`}
                                      onClick={() => { setEditingOptionKey(editKey); setEditOptionIdValue(match.optionId); }}
                                    />
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        )
      )}

      {showAdd && (
        <AddCharacterModal
          onClose={() => setShowAdd(false)}
          onCreated={(label) => {
            setShowAdd(false);
            toast.success(`“${label}” was added.`);
            refresh();
          }}
        />
      )}
      {previewSet && <PreviewModal set={previewSet} onClose={() => setPreviewSet(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete “${deleteTarget.label}”?`}
          confirmLabel="Delete set"
          loading={saving}
          error={deleteError}
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
          onConfirm={handleDelete}
        >
          <p>Anyone who had it selected falls back to another option. This can't be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AdminCharacterSets;
