import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, DoorOpen, Layers, Music, Palette, Pencil, Plus, Trash2, Trophy, Users } from "lucide-react";
import { SceneArt } from "../../components/Illustrations";
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, IconButton, Modal, PageHeader, SkeletonCards, Stat, StatusChip, TextField } from "../../components/ui";
import { ENVIRONMENT_ICONS, setEnvironments, toMeta } from "../../scenes";
import { api, errorMessage } from "../../lib/api";
import { clearSession } from "../../lib/session";
import { plural } from "../../lib/format";
import { useToast } from "../../lib/toast";

function statusFor(template) {
  if (!template || template.slots.length === 0) return "empty";
  return template.isPublished ? "published" : "draft";
}

// The colour the colour picker starts on for an environment that has no colour of its own yet.
const DEFAULT_PICKER_COLOR = "#6b5bd6";

// Add / edit one environment: its name, icon, colour and a short description. The key it is stored
// under is made by the server from the name when it is created and never changes, so renaming is safe.
function EnvironmentModal({ environment, onClose, onSaved }) {
  const editing = Boolean(environment);
  const [label, setLabel] = useState(environment?.label || "");
  const [icon, setIcon] = useState(environment?.iconName || "Sparkles");
  const [useThemeColor, setUseThemeColor] = useState(editing ? !environment.hex : false);
  const [color, setColor] = useState(environment?.hex || DEFAULT_PICKER_COLOR);
  const [blurb, setBlurb] = useState(environment?.blurb || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const preview = toMeta({ key: environment?.key || "", label: label.trim() || "Environment name", icon, color: useThemeColor ? null : color });

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Give the environment a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { label: label.trim(), icon, color: useThemeColor ? "" : color, blurb: blurb.trim() };
      const { ok, data } = await api(editing ? `/admin/environments/${environment.id}` : "/admin/environments", {
        method: editing ? "PUT" : "POST",
        body,
      });
      if (!ok) {
        setError(errorMessage(data));
        return;
      }
      onSaved(data, editing);
    } catch {
      setError("Couldn't reach the server. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${environment.label}` : "Add an environment"}
      description="Teachers pick from these when they create a campaign."
      size="md"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="environment-form" loading={saving}>
            {editing ? "Save changes" : "Add environment"}
          </Button>
        </>
      }
    >
      <form id="environment-form" className="stack stack-md" onSubmit={submit} noValidate>
        <TextField label="Name" required value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} data-autofocus />

        <fieldset className="env-field">
          <legend className="field__label">Icon</legend>
          <div className="env-icon-grid" role="radiogroup" aria-label="Icon">
            {Object.entries(ENVIRONMENT_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={icon === name}
                aria-label={name}
                title={name}
                className="env-icon-option"
                data-selected={icon === name}
                onClick={() => setIcon(name)}
              >
                <Icon size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="env-field">
          <legend className="field__label">Colour</legend>
          <div className="row" style={{ "--gap": "12px" }}>
            <input
              type="color"
              className="env-color-input"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={useThemeColor}
              aria-label="Environment colour"
            />
            <Checkbox label="Use the theme's own colour" checked={useThemeColor} onChange={(e) => setUseThemeColor(e.target.checked)} />
          </div>
        </fieldset>

        <TextField
          label="Description"
          optional
          value={blurb}
          maxLength={120}
          onChange={(e) => setBlurb(e.target.value)}
          hint="One short line shown under the name when a teacher picks the environment."
        />

        <div className="env-preview" style={{ "--scene": preview.color, "--scene-soft": preview.soft }}>
          <span className="text-sm text-muted">Preview</span>
          <Badge tone="neutral" icon={preview.Icon} size="lg" style={{ "--chip-fg": preview.color, "--chip-bg": preview.soft }}>
            {preview.label}
          </Badge>
        </div>

        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

// Landing page for the admin account: the environments (scenes) with their question-set templates
// (published / draft / not started) and the character catalog, with links into each manager and into
// Teacher Mode. The environments are whatever the admin has set up here - add, edit and delete them
// with the buttons on this page.
function AdminDashboard() {
  const [environments, setEnvironmentList] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [sets, setSets] = useState(null);
  const [musicTracks, setMusicTracks] = useState(null);
  const [trophies, setTrophies] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null); // null | "new" | an environment
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [eRes, tRes, sRes, mRes, trRes] = await Promise.all([
          api("/environments"),
          api("/admin/vault-templates"),
          api("/character-sets"),
          api("/admin/music-tracks"),
          api("/scene-trophies"),
        ]);
        if (cancelled) return;
        if (tRes.status === 401 || tRes.status === 403) {
          clearSession();
          navigate("/");
          return;
        }
        if (!eRes.ok) throw new Error(errorMessage(eRes.data, "Couldn't load the environments."));
        if (!tRes.ok) throw new Error(errorMessage(tRes.data, "Couldn't load the question sets."));
        setEnvironments(eRes.data);
        setEnvironmentList(eRes.data.map(toMeta));
        setTemplates(Object.fromEntries(tRes.data.map((t) => [t.scene, t])));
        setSets(sRes.ok && Array.isArray(sRes.data) ? [...sRes.data].sort((a, b) => a.orderNumber - b.orderNumber) : []);
        setMusicTracks(mRes.ok && Array.isArray(mRes.data) ? mRes.data : []);
        setTrophies(trRes.ok && Array.isArray(trRes.data) ? trRes.data : []);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err.message === "Failed to fetch" ? "Couldn't reach the server. Check your connection." : err.message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate, reloadKey]);

  const loading = !(environments && templates) && !error;
  const publishedCount = environments && templates ? environments.filter((s) => statusFor(templates[s.key]) === "published").length : 0;

  const handleSaved = (saved, wasEditing) => {
    setEditing(null);
    toast.success(wasEditing ? `“${saved.label}” was saved.` : `“${saved.label}” was added.`);
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const { ok, data } = await api(`/admin/environments/${deleteTarget.id}`, { method: "DELETE" });
      if (!ok) {
        setDeleteError(errorMessage(data));
        return;
      }
      toast.success(`“${deleteTarget.label}” was deleted.`);
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch {
      setDeleteError("Couldn't reach the server. Nothing was deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Admin dashboard"
        description="Set up the environments, each one's question set, and manage the character options."
        actions={
          <>
            <Button variant="secondary" icon={Palette} to="/admin/character">
              My character
            </Button>
            <Button variant="primary" icon={DoorOpen} to="/teacher/dashboard">
              Teacher mode
            </Button>
          </>
        }
      />

      {error && (
        <Alert tone="danger" title="Something didn't load" action={<Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}>
          {error}
        </Alert>
      )}

      <div className="stat-grid" style={{ "--cols": 2 }}>
        <Stat icon={CheckCircle2} tone="success" label="Environments ready for teachers" value={loading || !environments ? "–" : `${publishedCount} of ${environments.length}`} />
        <Stat icon={Users} tone="primary" label="Character sets" value={sets ? sets.length : "–"} />
      </div>

      <section className="section" aria-labelledby="vaults-heading">
        <div className="section__head">
          <div>
            <h2 id="vaults-heading" className="section__title row" style={{ "--gap": "8px" }}>
              <Layers size={20} aria-hidden="true" /> Question sets by environment
            </h2>
            <p className="text-sm text-muted">Once published, every campaign in that environment must follow its list of question types.</p>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing("new")} disabled={loading}>
            Add environment
          </Button>
        </div>

        {loading ? (
          <SkeletonCards count={2} height={240} />
        ) : (
          environments &&
          templates &&
          (environments.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">No environments yet. Add one so teachers have somewhere to set their campaigns.</p>
            </Card>
          ) : (
            <div className="grid-cards">
              {environments.map((s) => {
                const template = templates[s.key];
                const status = statusFor(template);
                return (
                  <Card key={s.key} hoverable className="vault-card" style={{ "--scene": s.color, "--scene-soft": s.soft }} flush>
                    <div className="vault-card__art" aria-hidden="true">
                      <SceneArt scene={s.key} />
                    </div>
                    <div className="vault-card__body">
                      <div className="row row-between">
                        <h3 className="card__title row" style={{ "--gap": "6px" }}>
                          <s.Icon size={18} aria-hidden="true" style={{ color: s.color }} /> {s.label}
                        </h3>
                        {status === "empty" ? <Badge>Not started</Badge> : <StatusChip status={status} />}
                      </div>
                      <p className="text-sm text-muted">
                        {status === "empty"
                          ? "No question set designed yet."
                          : `${plural(template.slots.length, "entry", "entries")} · ${plural(template.standaloneNoteCount || 0, "additional note")}`}
                      </p>
                      <div className="card__footer row" style={{ "--gap": "8px" }}>
                        <Button variant="soft" block iconRight={ArrowRight} to={`/admin/vault/${s.key}`}>
                          {status === "empty" ? "Design question set" : status === "published" ? "View question set" : "Edit question set"}
                          <span className="sr-only"> for {s.label}</span>
                        </Button>
                        <IconButton icon={Pencil} label={`Edit ${s.label}`} onClick={() => setEditing(s)} />
                        <IconButton
                          icon={Trash2}
                          variant="danger-ghost"
                          label={`Delete ${s.label}`}
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(s);
                          }}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ))
        )}
      </section>

      <section className="section" aria-labelledby="sets-heading">
        <div className="section__head">
          <h2 id="sets-heading" className="section__title row" style={{ "--gap": "8px" }}>
            <Users size={20} aria-hidden="true" /> Character sets
          </h2>
          <Button variant="secondary" size="sm" iconRight={ArrowRight} to="/admin/character-sets">
            Manage
          </Button>
        </div>
        <Card>
          {!sets ? (
            <div className="skeleton" style={{ height: 40 }} aria-hidden="true" />
          ) : sets.length === 0 ? (
            <p className="text-sm text-muted">No character sets yet. Add one so players have something to wear.</p>
          ) : (
            <ul className="row" role="list" style={{ listStyle: "none" }}>
              {sets.map((set, i) => (
                <li key={set.id}>
                  <Badge tone={i === 0 ? "accent" : "outline"} size="lg">
                    {set.label}
                    {i === 0 ? " · base" : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="section" aria-labelledby="music-heading">
        <div className="section__head">
          <h2 id="music-heading" className="section__title row" style={{ "--gap": "8px" }}>
            <Music size={20} aria-hidden="true" /> Background music
          </h2>
          <Button variant="secondary" size="sm" iconRight={ArrowRight} to="/admin/music">
            Manage
          </Button>
        </div>
        <Card>
          {!musicTracks ? (
            <div className="skeleton" style={{ height: 40 }} aria-hidden="true" />
          ) : musicTracks.length === 0 ? (
            <p className="text-sm text-muted">No music tracks yet. Add one so the website has background music.</p>
          ) : (
            <ul className="row" role="list" style={{ listStyle: "none" }}>
              {musicTracks.map((track) => (
                <li key={track.id}>
                  <Badge tone="outline" size="lg">
                    {track.label}
                    {track.isHidden ? " · hidden" : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="section" aria-labelledby="trophies-heading">
        <div className="section__head">
          <h2 id="trophies-heading" className="section__title row" style={{ "--gap": "8px" }}>
            <Trophy size={20} aria-hidden="true" /> Trophies
          </h2>
          <Button variant="secondary" size="sm" iconRight={ArrowRight} to="/admin/trophies">
            Manage
          </Button>
        </div>
        <Card>
          {!trophies || !environments ? (
            <div className="skeleton" style={{ height: 40 }} aria-hidden="true" />
          ) : environments.length === 0 ? (
            <p className="text-sm text-muted">No environments yet. Add one, then give it a trophy.</p>
          ) : (
            <ul className="row" role="list" style={{ listStyle: "none" }}>
              {environments.map((s) => (
                <li key={s.key}>
                  <Badge tone={trophies.some((t) => t.sceneKey === s.key) ? "success" : "outline"} size="lg">
                    {s.label}
                    {trophies.some((t) => t.sceneKey === s.key) ? " · has a trophy" : " · no trophy"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {editing && (
        <EnvironmentModal environment={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.label}?`}
          confirmLabel="Delete environment"
          loading={deleting}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        >
          <p>
            Its question set (draft or published) is deleted with it, and teachers can no longer pick it. This can't be undone. An environment that
            campaigns are still set in can't be deleted.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AdminDashboard;
