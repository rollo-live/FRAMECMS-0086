import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "review" | "done";
  assignedTo: string | null;
  dueDate: string | null;
  position: number;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clientId: string;
  client?: { name: string };
  tasks?: Task[];
};

const COLUMNS: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "Da fare", color: "#6366f1" },
  { key: "doing", label: "In corso", color: "#f59e0b" },
  { key: "review", label: "Review", color: "#8b5cf6" },
  { key: "done", label: "Completato", color: "#10b981" },
];

export default function ProgettoDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "timeline">("kanban");
  const [newTaskCol, setNewTaskCol] = useState<Task["status"] | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Task["status"] | null>(null);
  const dragTask = useRef<Task | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/projects/${id}`),
      api.get(`/api/tasks?projectId=${id}`),
    ]).then(([pRes, tRes]) => {
      if (pRes.ok) pRes.json().then((d: any) => setProject(d.project ?? d));
      if (tRes.ok) tRes.json().then((d: any) => setTasks(d.tasks ?? d));
      setLoading(false);
    });
  }, [id]);

  const createTask = async (status: Task["status"]) => {
    if (!newTaskTitle.trim()) return;
    const res = await api.post("/api/tasks", {
      projectId: id,
      title: newTaskTitle,
      status,
      position: tasks.filter((t) => t.status === status).length,
    });
    if (res.ok) {
      const d = await res.json();
      setTasks((prev) => [...prev, d.task ?? d]);
    }
    setNewTaskTitle("");
    setNewTaskCol(null);
  };

  const moveTask = async (taskId: string, newStatus: Task["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    await api.patch(`/api/tasks/${taskId}`, { status: newStatus });
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await api.delete(`/api/tasks/${taskId}`);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", color: "var(--text-secondary)" }}>
        Caricamento...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: "2rem", color: "var(--text-secondary)" }}>
        Progetto non trovato.
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link
          to="/progetti"
          style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}
        >
          ← Progetti
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {project.name}
          </h1>
          {project.client && (
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              {project.client.name}
            </span>
          )}
        </div>
        {/* Quick actions */}
        <Link
          to={`/gallery?projectId=${id}`}
          style={{
            padding: "0.5rem 1rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          + Gallery
        </Link>
        <Link
          to={`/video?projectId=${id}`}
          style={{
            padding: "0.5rem 1rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          + Video
        </Link>
        {/* View toggle */}
        <div
          style={{
            display: "flex",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {(["kanban", "timeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "0.5rem 1rem",
                border: "none",
                background: view === v ? "var(--primary)" : "transparent",
                color: view === v ? "#fff" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.875rem",
                textTransform: "capitalize",
              }}
            >
              {v === "kanban" ? "Kanban" : "Timeline"}
            </button>
          ))}
        </div>
      </div>

      {view === "kanban" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {COLUMNS.map((col) => {
            const colTasks = tasks
              .filter((t) => t.status === col.key)
              .sort((a, b) => a.position - b.position);

            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) moveTask(dragging, col.key);
                  setDragging(null);
                  setDragOver(null);
                }}
                style={{
                  background: dragOver === col.key ? "var(--surface-hover)" : "var(--surface)",
                  border: `2px solid ${dragOver === col.key ? col.color : "var(--border)"}`,
                  borderRadius: "12px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  overflow: "hidden",
                  transition: "border-color 0.15s",
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: col.color,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                    {col.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "var(--border)",
                      borderRadius: "9999px",
                      padding: "0 0.4rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* Task list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, overflowY: "auto" }}>
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => {
                        setDragging(task.id);
                        dragTask.current = task;
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDragOver(null);
                      }}
                      style={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        cursor: "grab",
                        opacity: dragging === task.id ? 0.5 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>
                          {task.title}
                        </span>
                        <button
                          onClick={() => deleteTask(task.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            padding: "0 0.25rem",
                          }}
                        >
                          ×
                        </button>
                      </div>
                      {task.description && (
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {task.description}
                        </p>
                      )}
                      {task.dueDate && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "block" }}>
                          📅 {new Date(task.dueDate).toLocaleDateString("it-IT")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add task */}
                {newTaskCol === col.key ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createTask(col.key);
                        if (e.key === "Escape") setNewTaskCol(null);
                      }}
                      placeholder="Titolo task..."
                      style={{
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        background: "var(--bg)",
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                      }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => createTask(col.key)}
                        style={{
                          flex: 1,
                          padding: "0.4rem",
                          background: "var(--primary)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Aggiungi
                      </button>
                      <button
                        onClick={() => setNewTaskCol(null)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          background: "transparent",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewTaskCol(col.key)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      background: "transparent",
                      border: "1px dashed var(--border)",
                      borderRadius: "8px",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    + Aggiungi task
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Timeline view */
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.5rem" }}>
            {tasks.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>Nessun task.</p>
            ) : (
              <div style={{ position: "relative", paddingLeft: "2rem" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    background: "var(--border)",
                  }}
                />
                {tasks
                  .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
                  .map((task) => {
                    const col = COLUMNS.find((c) => c.key === task.status)!;
                    return (
                      <div key={task.id} style={{ position: "relative", marginBottom: "1.5rem" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: "-1.625rem",
                            top: "0.25rem",
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            background: col.color,
                            border: "2px solid var(--bg)",
                          }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{task.title}</span>
                          <span
                            style={{
                              padding: "0.1rem 0.5rem",
                              borderRadius: "9999px",
                              background: col.color + "22",
                              color: col.color,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {col.label}
                          </span>
                          {task.dueDate && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              {new Date(task.dueDate).toLocaleDateString("it-IT")}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            {task.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
