import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, DoorOpen, Layers, Palette, Users } from "lucide-react";
import { SceneArt } from "../../components/Illustrations";
import { Alert, Badge, Button, Card, PageHeader, SkeletonCards, Stat, StatusChip } from "../../components/ui";
import { SCENE_LIST, sceneStyle } from "../../scenes";
import { api, errorMessage } from "../../lib/api";
import { clearSession } from "../../lib/session";
import { plural } from "../../lib/format";

function statusFor(template) {
  if (!template || template.slots.length === 0) return "empty";
  return template.isPublished ? "published" : "draft";
}

// Landing page for the admin account: the three vault question-set templates
// (published / draft / not started) and the character catalog, with links
// into each manager and into Teacher Mode.
function AdminDashboard() {
  const [templates, setTemplates] = useState(null);
  const [sets, setSets] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [tRes, sRes] = await Promise.all([api("/admin/vault-templates"), api("/character-sets")]);
        if (cancelled) return;
        if (tRes.status === 401 || tRes.status === 403) {
          clearSession();
          navigate("/");
          return;
        }
        if (!tRes.ok) throw new Error(errorMessage(tRes.data, "Couldn't load the question sets."));
        setTemplates(Object.fromEntries(tRes.data.map((t) => [t.scene, t])));
        setSets(sRes.ok && Array.isArray(sRes.data) ? [...sRes.data].sort((a, b) => a.orderNumber - b.orderNumber) : []);
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

  const loading = !templates && !error;
  const publishedCount = templates ? SCENE_LIST.filter((s) => statusFor(templates[s.key]) === "published").length : 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Admin dashboard"
        description="Set up each scene's question set and manage the character options."
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
        <Stat icon={CheckCircle2} tone="success" label="Scenes ready for teachers" value={loading ? "–" : `${publishedCount} of ${SCENE_LIST.length}`} />
        <Stat icon={Users} tone="primary" label="Character sets" value={sets ? sets.length : "–"} />
      </div>

      <section className="section" aria-labelledby="vaults-heading">
        <div className="section__head">
          <div>
            <h2 id="vaults-heading" className="section__title row" style={{ "--gap": "8px" }}>
              <Layers size={20} aria-hidden="true" /> Question sets by scene
            </h2>
            <p className="text-sm text-muted">Once published, every campaign in that scene must follow its list of question types.</p>
          </div>
        </div>

        {loading ? (
          <SkeletonCards count={3} height={240} />
        ) : (
          templates && (
            <div className="grid-cards">
              {SCENE_LIST.map((s) => {
                const template = templates[s.key];
                const status = statusFor(template);
                return (
                  <Card key={s.key} hoverable className="vault-card" style={sceneStyle(s.key)} flush>
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
                      <div className="card__footer">
                        <Button variant="soft" block iconRight={ArrowRight} to={`/admin/vault/${s.key}`}>
                          {status === "empty" ? "Design question set" : status === "published" ? "View question set" : "Edit question set"}
                          <span className="sr-only"> for {s.label}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
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
    </div>
  );
}

export default AdminDashboard;
