import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { ArrowLeft, Plus, Image, Video, LayoutGrid, Clock, X, Check, ChevronDown, User, Calendar, AlertCircle, Pencil, Trash2 } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "review" | "done";
  priority: "low" | "medium" | "high";
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string | null;
  order: number;
};

type Member = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  clientId: string;
  client?: { name: string };
};

const COLUMNS: { key: Task["status"]; label: string; color: string; bg: string }[] = [
  { key: "todo",   label: "Da fare",    color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  { key: "doing",  label: "In corso",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  { key: "review", label: "Review",     color: "#8b5cf6", bg: "rgba(139,92,246,0.1)"  },
  { key: "done",   label: "Completato", color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
];

const PRIORITY_OPTS = [
  { value: "high",   label: "Alta",   color: "text-red-400"    },
  { value: "medium", label: "Media",  color: "text-yellow-400" },
  { value: "low",    label: "Bassa",  color: "text-[#666]"     },
];

function priorityColor(p: string) {
  return p === "high" ? "text-red-400" : p === "medium" ? "text-yellow-400" : "text-[#555]";
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDateTime(dt: string | null) {
  if (!dt) return null;
  const d = new Date(dt);
  return d.toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(dt: string | null) {
  if (!dt) return null;
  return new Date(dt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function toDateTimeLocal(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MemberAvatar({ member, size = 24 }: { member: Member; size?: number }) {
  if (member.image) {
    return <img src={member.image} alt={member.name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-[#F5A623] flex items-center justify-center text-black font-bold" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {member.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Task Form (create / edit) ───────────────────────────────────────────────
type TaskFormData = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  assigneeId: string;
  dueDate: string; // datetime-local value
};

function TaskModal({
  task,
  members,
  onSave,
  onClose,
  defaultStatus,
}: {
  task?: Task;
  members: Member[];
  onSave: (data: TaskFormData) => void;
  onClose: () => void;
  defaultStatus?: Task["status"];
}) {
  const [form, setForm] = useState<TaskFormData>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "medium",
    assigneeId: task?.assigneeId ?? "",
    dueDate: toDateTimeLocal(task?.dueDate ?? null),
  });

  const isEdit = !!task;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-[#111] border border-[rgba(255,255,255,0.1)] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[#f5f5f5]">{isEdit ? "Modifica task" : "Nuovo task"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Titolo *</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && form.title.trim()) onSave(form); }}
              placeholder="Descrivi il task..."
              className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Descrizione</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Dettagli opzionali..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Priorità</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              >
                {PRIORITY_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Assegna a</label>
              <select
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              >
                <option value="">— Nessuno —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date + time */}
          <div>
            <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">
              Scadenza (data e ora)
            </label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { if (form.title.trim()) onSave(form); }}
              disabled={!form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#F5A623] hover:bg-[#e09615] text-black rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={15} /> {isEdit ? "Salva modifiche" : "Crea task"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-[#666] border border-[rgba(255,255,255,0.08)] rounded-xl hover:text-[#f5f5f5] hover:border-[rgba(255,255,255,0.15)] transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProgettoDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject]   = useState<Project | null>(null);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"kanban" | "timeline">("kanban");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Task["status"] | null>(null);
  const dragTask = useRef<Task | null>(null);

  // Modal state
  const [showCreate, setShowCreate] = useState<Task["status"] | null>(null);
  const [editTask, setEditTask]     = useState<Task | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/projects/${id}`),
      api.get(`/api/projects/${id}/tasks`),
      api.get("/api/team"),
    ]).then(([pRes, tRes, mRes]) => {
      if (pRes.ok) pRes.json().then((d: any) => setProject(d.project ?? d));
      if (tRes.ok) tRes.json().then((d: any) => setTasks(d.tasks ?? d));
      if (mRes.ok) mRes.json().then((d: any) => setMembers(d.members ?? []));
      setLoading(false);
    });
  }, [id]);

  const createTask = async (status: Task["status"], formData: TaskFormData) => {
    const res = await api.post(`/api/projects/${id}/tasks`, {
      title: formData.title,
      description: formData.description || null,
      status,
      priority: formData.priority,
      assigneeId: formData.assigneeId || null,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      order: tasks.filter((t) => t.status === status).length,
    });
    if (res.ok) {
      const d = await res.json();
      setTasks((prev) => [...prev, d.task ?? d]);
    }
    setShowCreate(null);
  };

  const updateTask = async (taskId: string, formData: TaskFormData) => {
    const patch = {
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      assigneeId: formData.assigneeId || null,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...patch } : t));
    await api.put(`/api/projects/${id}/tasks/${taskId}`, patch);
    setEditTask(null);
  };

  const moveTask = async (taskId: string, newStatus: Task["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    await api.put(`/api/projects/${id}/tasks/${taskId}`, { status: newStatus });
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setEditTask(null);
    await api.delete(`/api/projects/${id}/tasks/${taskId}`);
  };

  const getMember = (id: string | null) => id ? members.find((m) => m.id === id) ?? null : null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-8 text-[#a0a0a0] text-sm">Caricamento...</div>
      </DashboardLayout>
    );
  }
  if (!project) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-8 text-[#a0a0a0] text-sm">Progetto non trovato.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-start gap-3 mb-4">
            <Link to="/progetti" className="mt-0.5 p-1.5 rounded-lg text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-[#f5f5f5] truncate">{project.name}</h1>
              {(project as any).client && (
                <p className="text-xs sm:text-sm text-[#a0a0a0] mt-0.5">{(project as any).client.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/gallery?projectId=${id}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#a0a0a0] hover:text-[#f5f5f5] hover:border-[rgba(255,255,255,0.15)] transition-all">
              <Image size={13} /> Gallery
            </Link>
            <Link to={`/video?projectId=${id}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#a0a0a0] hover:text-[#f5f5f5] hover:border-[rgba(255,255,255,0.15)] transition-all">
              <Video size={13} /> Video
            </Link>
            <div className="ml-auto flex bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg overflow-hidden">
              <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all ${view === "kanban" ? "bg-[#F5A623] text-black" : "text-[#a0a0a0] hover:text-[#f5f5f5]"}`}>
                <LayoutGrid size={13} /> Kanban
              </button>
              <button onClick={() => setView("timeline")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all ${view === "timeline" ? "bg-[#F5A623] text-black" : "text-[#a0a0a0] hover:text-[#f5f5f5]"}`}>
                <Clock size={13} /> Timeline
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden">
          {view === "kanban" ? (
            <div className="h-full overflow-x-auto overflow-y-hidden">
              <div className="flex gap-3 p-4 sm:p-6 h-full" style={{ minWidth: `${COLUMNS.length * 290}px` }}>
                {COLUMNS.map((col) => {
                  const colTasks = tasks
                    .filter((t) => t.status === col.key)
                    .sort((a, b) => a.order - b.order);

                  return (
                    <div
                      key={col.key}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                      onDrop={(e) => { e.preventDefault(); if (dragging) moveTask(dragging, col.key); setDragging(null); setDragOver(null); }}
                      className="flex flex-col rounded-xl border-2 transition-all duration-150 overflow-hidden"
                      style={{
                        width: "280px",
                        minWidth: "280px",
                        background: dragOver === col.key ? "#1a1a1a" : "#111",
                        borderColor: dragOver === col.key ? col.color : "rgba(255,255,255,0.07)",
                      }}
                    >
                      {/* Column header */}
                      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                        <span className="text-sm font-semibold text-[#f5f5f5]">{col.label}</span>
                        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>
                          {colTasks.length}
                        </span>
                      </div>

                      {/* Task list */}
                      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                        {colTasks.map((task) => {
                          const assignee = getMember(task.assigneeId);
                          const overdue = isOverdue(task.dueDate) && task.status !== "done";
                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => { setDragging(task.id); dragTask.current = task; }}
                              onDragEnd={() => { setDragging(null); setDragOver(null); }}
                              className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.07)] rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity group"
                              style={{ opacity: dragging === task.id ? 0.4 : 1 }}
                            >
                              {/* Title row */}
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium text-[#f5f5f5] leading-snug flex-1">{task.title}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditTask(task); }}
                                  className="shrink-0 p-0.5 rounded text-[#444] hover:text-[#F5A623] transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Pencil size={12} />
                                </button>
                              </div>

                              {/* Description */}
                              {task.description && (
                                <p className="mt-1.5 text-xs text-[#666] leading-relaxed line-clamp-2">{task.description}</p>
                              )}

                              {/* Footer: priority + due + assignee */}
                              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                                {/* Priority dot */}
                                <span className={`text-[10px] font-semibold ${priorityColor(task.priority)}`}>
                                  {task.priority === "high" ? "● Alta" : task.priority === "medium" ? "● Media" : "● Bassa"}
                                </span>

                                {/* Due date */}
                                {task.dueDate && (
                                  <span className={`flex items-center gap-0.5 text-[10px] ${overdue ? "text-red-400" : "text-[#555]"}`}>
                                    {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                                    {formatDateTime(task.dueDate)}
                                  </span>
                                )}

                                {/* Assignee */}
                                {assignee && (
                                  <span className="ml-auto flex items-center gap-1">
                                    <MemberAvatar member={assignee} size={18} />
                                    <span className="text-[10px] text-[#555] truncate max-w-[60px]">{assignee.name.split(" ")[0]}</span>
                                  </span>
                                )}
                              </div>

                              {/* Created at */}
                              {task.createdAt && (
                                <p className="mt-1.5 text-[10px] text-[#333]">
                                  Creato il {formatDateOnly(task.createdAt)}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {colTasks.length === 0 && (
                          <p className="text-xs text-[#333] text-center py-4">Nessun task</p>
                        )}
                      </div>

                      {/* Add task button */}
                      <div className="p-2.5 border-t border-[rgba(255,255,255,0.06)]">
                        <button
                          onClick={() => setShowCreate(col.key)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[#555] border border-dashed border-[rgba(255,255,255,0.07)] rounded-lg hover:text-[#a0a0a0] hover:border-[rgba(255,255,255,0.15)] transition-all"
                        >
                          <Plus size={13} /> Aggiungi task
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Timeline */
            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-4 sm:p-6">
                {tasks.length === 0 ? (
                  <p className="text-[#555] text-sm text-center py-8">Nessun task ancora.</p>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-[rgba(255,255,255,0.08)]" />
                    {[...tasks]
                      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
                      .map((task) => {
                        const col = COLUMNS.find((c) => c.key === task.status)!;
                        const assignee = getMember(task.assigneeId);
                        const overdue = isOverdue(task.dueDate) && task.status !== "done";
                        return (
                          <div key={task.id} className="relative mb-6 last:mb-0">
                            <div
                              className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a]"
                              style={{ background: col.color }}
                            />
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-[#f5f5f5]">{task.title}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>
                                {col.label}
                              </span>
                              <span className={`text-[10px] font-semibold ${priorityColor(task.priority)}`}>
                                {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Bassa"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {task.createdAt && (
                                <span className="text-xs text-[#444] flex items-center gap-1">
                                  <Clock size={10} /> Creato: {formatDateOnly(task.createdAt)}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-400" : "text-[#555]"}`}>
                                  {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                                  Scadenza: {formatDateTime(task.dueDate)}
                                </span>
                              )}
                              {assignee && (
                                <span className="flex items-center gap-1">
                                  <MemberAvatar member={assignee} size={16} />
                                  <span className="text-xs text-[#555]">{assignee.name}</span>
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-[#666] mt-1">{task.description}</p>
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
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <TaskModal
          members={members}
          defaultStatus={showCreate}
          onSave={(data) => createTask(showCreate, data)}
          onClose={() => setShowCreate(null)}
        />
      )}

      {/* ── Edit modal ── */}
      {editTask && (
        <TaskModal
          task={editTask}
          members={members}
          onSave={(data) => updateTask(editTask.id, data)}
          onClose={() => setEditTask(null)}
        >
          {/* Delete button inside edit modal — passed via extra DOM trick */}
        </TaskModal>
      )}

      {/* ── Delete confirm inside edit — handled via Pencil → modal with delete btn ── */}
      {editTask && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]">
          <button
            onClick={() => { if (confirm("Eliminare questo task?")) deleteTask(editTask.id); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-400 bg-[#1a1a1a] border border-red-400/30 rounded-xl hover:bg-red-400/10 transition-colors shadow-xl"
          >
            <Trash2 size={13} /> Elimina task
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
