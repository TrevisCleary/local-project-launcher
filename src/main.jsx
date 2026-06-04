import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Code2,
  ExternalLink,
  FolderOpen,
  GitBranch,
  GitPullRequestArrow,
  Network,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  Square,
  Terminal,
  X,
} from "lucide-react";
import "./styles.css";

const POLL_MS = 5000;

function App() {
  const [root, setRoot] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ work: true, personal: true });
  const [showPortTree, setShowPortTree] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const data = await response.json();
    setRoot(data.root);
    setProjects(data.projects || []);
    setSelectedId((current) => current || data.projects?.[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadProjects();
    const timer = window.setInterval(loadProjects, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  async function runAction(projectId, action) {
    setBusy(`${projectId}:${action}`);
    try {
      const response = await fetch(`/api/projects/${projectId}/${action}`, { method: "POST" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Action failed.");
      }
      await loadProjects();
    } finally {
      setBusy("");
    }
  }

  async function saveDescription(projectId, description) {
    setBusy(`${projectId}:save`);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Save failed.");
      }
      await loadProjects();
    } finally {
      setBusy("");
    }
  }

  async function openFolder(projectId) {
    await fetch(`/api/projects/${projectId}/open-folder`, { method: "POST" });
  }

  async function registerProject(values) {
    setBusy("register");
    try {
      const response = await fetch("/api/projects/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed.");
      }
      const project = await response.json();
      await loadProjects();
      setSelectedId(project.id);
      setShowRegister(false);
    } finally {
      setBusy("");
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const audienceVisible =
        (filters.work && project.audience === "work") ||
        (filters.personal && project.audience === "personal") ||
        (filters.work && filters.personal && project.audience === "unknown");
      if (!audienceVisible) return false;
      if (!needle) return true;
      return [project.name, project.folderName, project.framework, project.description, project.owner]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [projects, query, filters]);

  const selected = projects.find((project) => project.id === selectedId) || filtered[0];
  const runningCount = projects.filter((project) => project.status === "running").length;
  const serviceCount = projects.reduce((count, project) => count + project.services.length, 0);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/assets/local-launcher-logo.png" alt="" />
          <div className="brand-copy">
            <p className="eyebrow">Localhost launcher</p>
            <h1>Development Projects</h1>
            <div className="root-line">{root || "C:\\Development\\Projects"}</div>
          </div>
        </div>
        <div className="top-actions">
          <Metric label="Projects" value={projects.length} icon={<Code2 size={18} />} />
          <Metric label="Services" value={serviceCount} icon={<Server size={18} />} />
          <Metric label="Running" value={runningCount} icon={<Activity size={18} />} />
          <button className="metric metric-button" onClick={() => setShowPortTree(true)}>
            <Network size={18} />
            <span>
              <strong>Ports</strong>
              <small>Map</small>
            </span>
          </button>
          <button className="metric metric-button" onClick={() => setShowRegister(true)}>
            <Plus size={18} />
            <span>
              <strong>Add</strong>
              <small>Project</small>
            </span>
          </button>
          <button className="icon-button" onClick={loadProjects} aria-label="Refresh projects">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="project-list">
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter projects"
          />
          <div className="filter-row">
            <Toggle label="Work" checked={filters.work} onChange={() => setFilters((current) => ({ ...current, work: !current.work }))} />
            <Toggle label="Personal" checked={filters.personal} onChange={() => setFilters((current) => ({ ...current, personal: !current.personal }))} />
          </div>
          <div className="list-scroll">
            {loading ? (
              <div className="empty">Loading projects...</div>
            ) : (
              filtered.map((project) => (
                <button
                  key={project.id}
                  className={`project-row ${selected?.id === project.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(project.id)}
                >
                  <span className={`status-dot ${project.status}`} />
                  <span className="row-text">
                    <strong>{project.name}</strong>
                    <small>{project.audience} · {project.framework}</small>
                  </span>
                  <span className="port-mini">{portsLabel(project)}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {selected ? (
          <ProjectDetail
            project={selected}
            busy={busy}
            onStart={() => runAction(selected.id, "start")}
            onStop={() => runAction(selected.id, "stop")}
            onRestart={() => runAction(selected.id, "restart")}
            onTakeOver={() => runAction(selected.id, "take-over")}
            onGitSync={() => runAction(selected.id, "git-sync")}
            onSaveDescription={(description) => saveDescription(selected.id, description)}
            onOpenFolder={() => openFolder(selected.id)}
          />
        ) : (
          <section className="detail empty">No project selected.</section>
        )}
      </section>
      {showPortTree ? <PortTreeModal projects={projects} onClose={() => setShowPortTree(false)} /> : null}
      {showRegister ? <RegisterProjectModal busy={busy === "register"} onSubmit={registerProject} onClose={() => setShowRegister(false)} /> : null}
    </main>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      {icon}
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function ProjectDetail({ project, busy, onStart, onStop, onRestart, onTakeOver, onGitSync, onSaveDescription, onOpenFolder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.description);
  const isBusy = busy.startsWith(`${project.id}:`);
  const isRunning = project.status === "running";
  const hasManagedRunning = project.managedRunning || project.services.some((service) => service.managedRunning);
  const canStart = !isBusy && !isRunning && project.services.some((service) => service.available);
  const canUseManagedActions = !isBusy && hasManagedRunning;
  const canTakeOver = !isBusy && isRunning && !hasManagedRunning && project.services.some((service) => service.available && service.portStatus === "open");
  const primary = project.services.find((service) => service.kind === "primary" && service.port);
  const canOpenPrimary = isRunning && primary?.port && (primary?.managedRunning || primary?.portStatus === "open");
  const primaryUrl = canOpenPrimary ? `http://localhost:${primary.port}` : "";

  useEffect(() => {
    setDraft(project.description);
    setEditing(false);
  }, [project.id, project.description]);

  return (
    <section className="detail">
      <div className="detail-head">
        <div className="title-group">
          {project.faviconUrl ? <img className="favicon" src={project.faviconUrl} alt="" /> : <span className="fallback-icon">{project.name.slice(0, 1).toUpperCase()}</span>}
          <div>
            <p className="eyebrow">{project.folderName}</p>
            <h2>{project.name}</h2>
          </div>
        </div>
        <div className="actions">
          {primaryUrl ? (
            <a className="action-button open-app" href={primaryUrl} target="_blank" rel="noreferrer" aria-label={`Open ${project.name}`}>
              <ExternalLink size={16} />
              Open
            </a>
          ) : null}
          <button className="start" disabled={!canStart} onClick={onStart}>
            <Play size={16} />
            Start
          </button>
          {canTakeOver ? (
            <button className="take-over" onClick={onTakeOver}>
              <RotateCw size={16} />
              Take Over
            </button>
          ) : null}
          {hasManagedRunning ? (
            <>
              <button className="restart" disabled={!canUseManagedActions} onClick={onRestart}>
                <RotateCw size={16} />
                Restart
              </button>
              <button className="stop" disabled={!canUseManagedActions} onClick={onStop}>
                <Square size={15} />
                Stop
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="description-row">
        {editing ? (
          <>
            <textarea className="description-input" value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button className="icon-button" onClick={() => onSaveDescription(draft)} aria-label="Save description">
              <Save size={17} />
            </button>
            <button className="icon-button" onClick={() => { setDraft(project.description); setEditing(false); }} aria-label="Cancel edit">
              <X size={17} />
            </button>
          </>
        ) : (
          <>
            <p className="description">{project.description}</p>
            <button className="icon-button" onClick={() => setEditing(true)} aria-label="Edit description">
              <Pencil size={16} />
            </button>
          </>
        )}
      </div>

      <div className="info-grid">
        <Info label="Type" value={project.audience} />
        <Info label="Owner" value={project.owner || "n/a"} />
        <Info label="Framework" value={project.framework} />
        <Info label="Status" value={project.status} tone={project.status} />
      </div>

      <div className="resource-section">
        <div className="section-title compact">
          <FolderOpen size={17} />
          <h3>Locations</h3>
        </div>
        <div className="resource-stack">
          <div className="resource-row">
            <div className="resource-meta">
              <FolderOpen size={16} />
              <span>
                <strong>Local Directory</strong>
                <small>{project.path}</small>
              </span>
            </div>
            <button className="secondary-action" onClick={onOpenFolder}>
              Open Directory
            </button>
          </div>
          <div className="resource-row">
            <div className="resource-meta">
              <GitPullRequestArrow size={16} />
              <span>
                <strong>Repository</strong>
                <small>{project.origin || "No remote detected"}</small>
              </span>
            </div>
            <div className="repo-badges">
              {project.git?.branch ? <span><GitBranch size={13} />{project.git.branch}</span> : null}
              {project.git ? <span className={project.git.dirty ? "warn" : ""}>{project.git.dirty ? "Dirty" : "Clean"}</span> : null}
              {project.git?.lastSync ? <span>Synced {formatTime(project.git.lastSync)}</span> : null}
            </div>
            <button className="secondary-action" disabled={isBusy || !project.origin} onClick={onGitSync}>
              Git Sync
            </button>
          </div>
        </div>
      </div>

      <div className="detail-scroll">
        <div className="section-title">
          <Server size={17} />
          <h3>Services</h3>
        </div>
        <div className="services">
          {project.services.length ? (
            project.services.map((service) => <ServiceRow key={service.id} service={service} />)
          ) : (
            <div className="empty">No runnable application script found.</div>
          )}
        </div>

        <div className="section-title">
          <Activity size={17} />
          <h3>Activity</h3>
        </div>
        <div className="activity-list">
          {project.activity?.length ? (
            project.activity.map((entry) => (
              <div className="activity-row" key={entry.id}>
                <strong>{entry.action}</strong>
                <span>{entry.message}</span>
                <small>{formatTime(entry.at)}</small>
              </div>
            ))
          ) : (
            <div className="empty compact-empty">No launcher activity yet.</div>
          )}
        </div>

        <div className="section-title">
          <Terminal size={17} />
          <h3>Recent output</h3>
        </div>
        <pre className="logs">{project.logs?.length ? project.logs.join("\n") : "No launcher output yet."}</pre>
      </div>
    </section>
  );
}

function PortTreeModal({ projects, onClose }) {
  const entries = projects
    .flatMap((project) =>
      project.services.map((service) => ({
        key: `${project.id}:${service.id}`,
        project,
        service,
        port: service.port,
      })),
    )
    .sort((left, right) => {
      if (!left.port && !right.port) return left.project.name.localeCompare(right.project.name);
      if (!left.port) return 1;
      if (!right.port) return -1;
      return left.port - right.port || left.project.name.localeCompare(right.project.name);
    });
  const portCounts = entries.reduce((counts, entry) => {
    if (!entry.port) return counts;
    counts.set(entry.port, (counts.get(entry.port) || 0) + 1);
    return counts;
  }, new Map());

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal port-modal" role="dialog" aria-modal="true" aria-labelledby="port-tree-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Port tree</p>
            <h2 id="port-tree-title">Project Port Map</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close port map">
            <X size={18} />
          </button>
        </div>
        <div className="port-tree">
          {entries.length ? (
            entries.map(({ key, project, service, port }) => {
              const conflict = port && portCounts.get(port) > 1;
              return (
                <div className={`port-node ${conflict ? "conflict" : ""}`} key={key}>
                  <div className="port-number">{port || "n/a"}</div>
                  <div className="port-copy">
                    <strong>{project.name}</strong>
                    <small>{service.label} · {project.audience} · {service.framework}</small>
                  </div>
                  {service.portConflict ? <span className="collision"><AlertTriangle size={13} />Conflict</span> : null}
                  <span className={`port-state ${service.managedRunning ? "running" : service.portStatus}`}>{service.managedRunning ? "managed" : service.portStatus}</span>
                </div>
              );
            })
          ) : (
            <div className="empty">No service ports discovered.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function RegisterProjectModal({ busy, onSubmit, onClose }) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("personal");
  const [port, setPort] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ports/next?audience=${audience}&kind=primary`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setPort(String(data.port || ""));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [audience]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal register-modal" role="dialog" aria-modal="true" aria-labelledby="register-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Registration</p>
            <h2 id="register-title">Add Project</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close registration">
            <X size={18} />
          </button>
        </div>
        <form
          className="register-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ name, audience, port: Number(port) });
          }}
        >
          <label>
            <span>Project name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            <span>Audience</span>
            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="personal">Personal</option>
              <option value="work">Work</option>
            </select>
          </label>
          <label>
            <span>Assigned port</span>
            <input type="number" value={port} onChange={(event) => setPort(event.target.value)} min="1000" max="65535" required />
          </label>
          <p className="form-note">Creates a minimal runnable project, writes Operations Library handoff docs, starts it, and lets the launcher auto-discover it.</p>
          <div className="form-actions">
            <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
            <button className="secondary-action primary-secondary" type="submit" disabled={busy}>{busy ? "Adding..." : "Add and Start"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Info({ label, value, tone }) {
  return (
    <div className="info">
      <small>{label}</small>
      <strong className={tone ? `tone-${tone}` : ""}>{value}</strong>
    </div>
  );
}

function ServiceRow({ service }) {
  const url = service.port && (service.managedRunning || service.portStatus === "open") ? `http://localhost:${service.port}` : "";
  return (
    <div className={`service-row ${service.available ? "" : "unavailable"}`}>
      <div className="service-main">
        <span className={`status-dot ${service.managedRunning ? "running" : service.portStatus}`} />
        <span>
          <strong>{service.label}</strong>
          <small>{service.framework} · npm run {service.script}</small>
        </span>
      </div>
      <code>{service.command}</code>
      <div className="service-port">
        <span>{service.port || "Port unknown"}</span>
        {service.portConflict ? <span className="collision"><AlertTriangle size={13} />Conflict</span> : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${service.label}`}>
            <ExternalLink size={15} />
          </a>
        ) : null}
      </div>
      {service.note ? <p className="service-note">{service.note}</p> : null}
    </div>
  );
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function portsLabel(project) {
  const ports = project.services.map((service) => service.port).filter(Boolean);
  return ports.length ? ports.join(", ") : "n/a";
}

createRoot(document.getElementById("root")).render(<App />);
