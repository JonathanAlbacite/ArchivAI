import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Lock, Plus, Rocket, Save, Trash2, Unlock } from "lucide-react";
import { Alert, Badge, Breadcrumbs, Button, Card, ConfirmDialog, EmptyState, IconButton, LoadingState, PageHeader, StatusChip, TextField } from "../../components/ui";
import { getSceneMeta, sceneStyle } from "../../scenes";
import { api, errorMessage } from "../../lib/api";
import { clearSession } from "../../lib/session";
import { useToast } from "../../lib/toast";

const CLUE_TYPES = [
  { value: "NORMAL", label: "Normal", hint: "1 answer" },
  { value: "MULTICHOICE", label: "Multiple choice", hint: "1 correct + 3 decoys" },
  { value: "COMBO", label: "Combo", hint: "several correct answers" },
];
const typeLabel = (value) => CLUE_TYPES.find((t) => t.value === value) || { label: value, hint: "" };

// Admin: designs the ordered sequence of entry-type slots for one vault (scene).
// Draft slots can be freely added/removed/reordered/retyped; publishing locks
// the sequence - to change it again, unpublish first. Whatever's published
// here is exactly the structure campaigns.js requires a teacher's clue set to
// match, in order, for this scene.
// Most additional notes a vault can ask for (the server checks the same limit).
const MAX_STANDALONE_NOTES = 10;

function AdminVaultEditor() {
  const { scene } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const meta = getSceneMeta(scene);

  const [slots, setSlots] = useState([]);
  // How many additional notes (standalone hints) every campaign in this vault
  // carries. They belong to no question.
  const [noteCount, setNoteCount] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [confirm, setConfirm] = useState(null); // "publish" | "unpublish"

  const snapshot = JSON.stringify({ slots, noteCount });
  const dirty = !loading && !isPublished && snapshot !== savedSnapshot;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { ok, status, data } = await api(`/admin/vault-templates/${scene}`);
        if (cancelled) return;
        if (!ok) {
          if (status === 401 || status === 403) {
            clearSession();
            navigate("/");
            return;
          }
          setLoadError(errorMessage(data));
          return;
        }
        const nextSlots = data.slots.map((s) => ({ type: s.type }));
        const nextCount = data.standaloneNoteCount || 0;
        setSlots(nextSlots);
        setNoteCount(nextCount);
        setIsPublished(data.isPublished);
        setSavedSnapshot(JSON.stringify({ slots: nextSlots, noteCount: nextCount }));
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
  }, [scene, navigate]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const addSlot = () => setSlots((s) => [...s, { type: "NORMAL" }]);
  const removeSlot = (i) => setSlots((s) => s.filter((_, j) => j !== i));
  const setSlotType = (i, type) => setSlots((s) => s.map((slot, j) => (j === i ? { type } : slot)));
  const moveSlot = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    setSlots((s) => {
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const saveDraft = async () => {
    if (slots.length === 0) {
      setSaveError("Add at least one entry slot first.");
      return false;
    }
    setSaving(true);
    setSaveError("");
    try {
      const { ok, data } = await api(`/admin/vault-templates/${scene}`, { method: "PUT", body: { slots, standaloneNoteCount: noteCount } });
      if (!ok) {
        setSaveError(errorMessage(data));
        return false;
      }
      setSavedSnapshot(snapshot);
      return true;
    } catch {
      setSaveError("Couldn't reach the server. Nothing was saved.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (await saveDraft()) toast.success("Draft saved.");
  };

  const handlePublish = async () => {
    setConfirm(null);
    if (!(await saveDraft())) return;
    setSaving(true);
    try {
      const { ok, data } = await api(`/admin/vault-templates/${scene}/publish`, { method: "PATCH" });
      if (!ok) {
        setSaveError(errorMessage(data));
        return;
      }
      setIsPublished(true);
      toast.success(`Teachers can now create ${meta.label} campaigns.`, { title: "Question set published" });
    } catch {
      setSaveError("Couldn't reach the server. The draft is saved but not published.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setConfirm(null);
    setSaving(true);
    setSaveError("");
    try {
      const { ok, data } = await api(`/admin/vault-templates/${scene}/unpublish`, { method: "PATCH" });
      if (!ok) {
        setSaveError(errorMessage(data));
        return;
      }
      setIsPublished(false);
      toast.info("The question set is a draft again - you can edit it now.");
    } catch {
      setSaveError("Couldn't reach the server. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  };

  const changeNoteCount = (value) => {
    const n = parseInt(value, 10);
    setNoteCount(Number.isNaN(n) ? 0 : Math.min(MAX_STANDALONE_NOTES, Math.max(0, n)));
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", to: "/admin/dashboard" }, { label: `${meta.label} question set` }]} />}
        eyebrow="Question set"
        title={
          <span className="row" style={{ "--gap": "10px" }}>
            <meta.Icon size={28} aria-hidden="true" style={{ color: meta.color }} />
            {meta.label}
          </span>
        }
        description="The order and type of entries every teacher's campaign in this scene must follow."
        actions={!loading && !loadError && <StatusChip status={isPublished ? "published" : "draft"} size="lg" />}
      />

      {loadError && (
        <Alert tone="danger" title="Couldn't load this question set" action={<Button size="sm" to="/admin/dashboard">Back</Button>}>
          {loadError}
        </Alert>
      )}
      {loading && <LoadingState label="Loading the question set..." />}
      {saveError && (
        <Alert tone="danger" className="section__alert">
          {saveError}
        </Alert>
      )}

      {!loading && !loadError && (
        <div className="stack stack-lg" style={sceneStyle(scene)}>
          {isPublished && (
            <Alert tone="info" title="Published and locked">
              Teachers are building campaigns from this sequence. Unpublish to edit it - while it's a draft, nobody can create or edit {meta.label} campaigns.
            </Alert>
          )}

          <Card flush>
            <div className="slot-list__head">
              <h2 className="section__title">Entry slots</h2>
              <Badge tone="outline">{slots.length} total</Badge>
            </div>
            {slots.length === 0 ? (
              <EmptyState plain title="No slots yet">
                Add the first entry below. Each slot is one question a teacher will write.
              </EmptyState>
            ) : (
              <ol className="slot-list" role="list">
                {slots.map((s, i) => (
                  <li key={i} className="slot-row">
                    <span className="slot-row__num" aria-hidden="true">
                      {i + 1}
                    </span>
                    {isPublished ? (
                      <span className="grow">
                        <span className="font-semibold">{typeLabel(s.type).label}</span>
                        <span className="text-sm text-muted"> · {typeLabel(s.type).hint}</span>
                      </span>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor={`slot-${i}`}>
                          Entry {i + 1} type
                        </label>
                        <select id={`slot-${i}`} className="input grow" value={s.type} onChange={(e) => setSlotType(i, e.target.value)} disabled={saving}>
                          {CLUE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label} ({t.hint})
                            </option>
                          ))}
                        </select>
                        <div className="row row-nowrap" style={{ "--gap": "2px" }}>
                          <IconButton icon={ArrowUp} size="sm" label={`Move entry ${i + 1} up`} onClick={() => moveSlot(i, -1)} disabled={i === 0 || saving} />
                          <IconButton icon={ArrowDown} size="sm" label={`Move entry ${i + 1} down`} onClick={() => moveSlot(i, 1)} disabled={i === slots.length - 1 || saving} />
                          <IconButton icon={Trash2} size="sm" variant="danger-ghost" label={`Remove entry ${i + 1}`} onClick={() => removeSlot(i)} disabled={saving} />
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {!isPublished && (
              <div className="slot-list__foot">
                <Button variant="ghost" icon={Plus} onClick={addSlot} disabled={saving}>
                  Add entry slot
                </Button>
              </div>
            )}
          </Card>

          <Card>
            {isPublished ? (
              <p className="text-sm">
                <span className="font-semibold">Additional notes:</span> {noteCount}
              </p>
            ) : (
              <TextField
                label="Additional notes"
                type="number"
                min={0}
                max={MAX_STANDALONE_NOTES}
                value={noteCount}
                onChange={(e) => changeNoteCount(e.target.value)}
                hint={`Extra lesson facts that belong to no question, mixed in with the hints so players can't tell which hint goes with which answer. 0 to ${MAX_STANDALONE_NOTES}.`}
                style={{ maxWidth: 120 }}
                disabled={saving}
              />
            )}
          </Card>

          <div className="results-actions" style={{ justifyContent: "flex-end" }}>
            {isPublished ? (
              <Button variant="secondary" icon={Unlock} onClick={() => setConfirm("unpublish")} loading={saving}>
                Unpublish to edit
              </Button>
            ) : (
              <>
                {dirty && <span className="text-sm text-muted" style={{ alignSelf: "center" }}>Unsaved changes</span>}
                <Button variant="secondary" icon={Save} onClick={handleSaveDraft} loading={saving && !confirm} disabled={saving || !dirty}>
                  Save draft
                </Button>
                <Button variant="primary" icon={Rocket} onClick={() => setConfirm("publish")} disabled={saving || slots.length === 0}>
                  Publish
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {confirm === "publish" && (
        <ConfirmDialog title={`Publish the ${meta.label} question set?`} confirmLabel="Publish" tone="primary" onCancel={() => setConfirm(null)} onConfirm={handlePublish}>
          <p>
            New {meta.label} campaigns will need exactly these {slots.length} entries, in this order. The sequence is locked while published.
          </p>
        </ConfirmDialog>
      )}
      {confirm === "unpublish" && (
        <ConfirmDialog title="Unpublish to edit?" confirmLabel="Unpublish" tone="primary" onCancel={() => setConfirm(null)} onConfirm={handleUnpublish}>
          <p>
            <Lock size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> While it's a draft, teachers can't create or save {meta.label}{" "}
            campaigns. Existing campaigns and their play history are not changed.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AdminVaultEditor;
