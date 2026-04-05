import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ── Natural Language Date Parser ──
function parseNaturalDate(input, referenceDate = new Date()) {
  if (!input || !input.trim()) return null;
  const s = input.trim().toLowerCase();
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayAbbrevs = ["sun","mon","tue","wed","thu","fri","sat"];
  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const monthAbbrevs = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

  if (s === "today" || s === "now") return new Date(ref);
  if (s === "tomorrow" || s === "tmrw" || s === "tmw") {
    const d = new Date(ref); d.setDate(d.getDate() + 1); return d;
  }
  if (s === "yesterday") {
    const d = new Date(ref); d.setDate(d.getDate() - 1); return d;
  }

  let m = s.match(/^in\s+(\d+)\s+(day|days|d|week|weeks|wk|wks|w|month|months|mo|mos|m)$/);
  if (!m) m = s.match(/^\+(\d+)\s*(d|w|m|wk|wks|mo|mos|days?|weeks?|months?)$/);
  if (m) {
    const n = parseInt(m[1]);
    const unit = m[2][0];
    const d = new Date(ref);
    if (unit === "d") d.setDate(d.getDate() + n);
    else if (unit === "w") d.setDate(d.getDate() + n * 7);
    else if (unit === "m") d.setMonth(d.getMonth() + n);
    return d;
  }

  const nextThis = s.match(/^(next|this)\s+(.+)$/);
  if (nextThis) {
    const modifier = nextThis[1];
    const dayStr = nextThis[2];
    let dayIdx = dayNames.indexOf(dayStr);
    if (dayIdx === -1) dayIdx = dayAbbrevs.indexOf(dayStr);
    if (dayIdx !== -1) {
      const d = new Date(ref);
      const current = d.getDay();
      let diff = dayIdx - current;
      if (modifier === "next") { if (diff <= 0) diff += 7; }
      else { if (diff < 0) diff += 7; }
      d.setDate(d.getDate() + diff);
      return d;
    }
    if (dayStr === "week") {
      const d = new Date(ref);
      const day = d.getDay();
      const daysUntilMon = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + daysUntilMon + (modifier === "next" ? 0 : -7));
      return d;
    }
    if (dayStr === "month") {
      const d = new Date(ref);
      if (modifier === "next") d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d;
    }
  }

  let dayIdx = dayNames.indexOf(s);
  if (dayIdx === -1) dayIdx = dayAbbrevs.indexOf(s);
  if (dayIdx !== -1) {
    const d = new Date(ref);
    const current = d.getDay();
    let diff = dayIdx - current;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  for (let mi = 0; mi < 12; mi++) {
    const patterns = [monthNames[mi], monthAbbrevs[mi]];
    for (const mp of patterns) {
      const re = new RegExp(`^${mp}\\.?\\s+(\\d{1,2})(?:[,\\s]\\s*(\\d{4}))?$`);
      const match = s.match(re);
      if (match) {
        const day = parseInt(match[1]);
        const year = match[2] ? parseInt(match[2]) : ref.getFullYear();
        const d = new Date(year, mi, day);
        if (!match[2] && d < ref) d.setFullYear(d.getFullYear() + 1);
        return d;
      }
    }
  }

  const slashDate = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (slashDate) {
    const month = parseInt(slashDate[1]) - 1;
    const day = parseInt(slashDate[2]);
    let year = slashDate[3] ? parseInt(slashDate[3]) : ref.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day);
      if (!slashDate[3] && d < ref) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }

  if (s === "eom" || s === "end of month") return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  if (s === "eow" || s === "end of week") {
    const d = new Date(ref);
    const day = d.getDay();
    d.setDate(d.getDate() + (day <= 5 ? 5 - day : 5 + 7 - day));
    return d;
  }

  const native = new Date(input.trim());
  if (!isNaN(native.getTime())) { native.setHours(0, 0, 0, 0); return native; }
  return null;
}

function formatDate(date) {
  if (!date) return "";
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return `${days[date.getDay()]} ${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatShort(date) {
  if (!date) return "";
  return `${date.getMonth()+1}/${date.getDate()}`;
}

let _id = 0;
const newId = () => `task-${++_id}`;

const INDENT_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"];
const BAR_COLORS = ["#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6"];
const BAR_BG_COLORS = ["#c7d2fe", "#ddd6fe", "#e9d5ff", "#f5d0fe", "#fbcfe8"];

function createTask(name = "", indent = 0) {
  return { id: newId(), name, indent, startRaw: "", dueRaw: "", startDate: null, dueDate: null, progress: 0 };
}

function getChildren(tasks, parentIndex) {
  const parentIndent = tasks[parentIndex].indent;
  const children = [];
  for (let i = parentIndex + 1; i < tasks.length; i++) {
    if (tasks[i].indent <= parentIndent) break;
    children.push(i);
  }
  return children;
}

function hasChildren(tasks, index) {
  if (index >= tasks.length - 1) return false;
  return tasks[index + 1].indent > tasks[index].indent;
}

function getDescendantDateRange(tasks, parentIndex) {
  const children = getChildren(tasks, parentIndex);
  if (children.length === 0) return { min: null, max: null };
  const dates = [];
  const parent = tasks[parentIndex];
  if (parent.startDate) dates.push(parent.startDate);
  if (parent.dueDate) dates.push(parent.dueDate);
  for (const ci of children) {
    if (tasks[ci].startDate) dates.push(tasks[ci].startDate);
    if (tasks[ci].dueDate) dates.push(tasks[ci].dueDate);
  }
  if (dates.length === 0) return { min: null, max: null };
  return {
    min: new Date(Math.min(...dates.map(d => d.getTime()))),
    max: new Date(Math.max(...dates.map(d => d.getTime()))),
  };
}

function getAggregateProgress(tasks, parentIndex) {
  const children = getChildren(tasks, parentIndex);
  if (children.length === 0) return tasks[parentIndex].progress;
  let total = 0;
  for (const ci of children) total += tasks[ci].progress;
  return Math.round(total / children.length);
}

function progressColor(pct) {
  if (pct >= 100) return "#22c55e";
  if (pct >= 60) return "#6366f1";
  if (pct >= 30) return "#a855f7";
  return "#94a3b8";
}

// ── Storage (localStorage) ──
const STORAGE_KEY = "gantt-planner-data";

function serializeTasks(tasks) {
  return tasks.map(t => ({
    id: t.id, name: t.name, indent: t.indent,
    startRaw: t.startRaw, dueRaw: t.dueRaw, progress: t.progress,
    startISO: t.startDate ? t.startDate.toISOString() : null,
    dueISO: t.dueDate ? t.dueDate.toISOString() : null,
  }));
}

function deserializeTasks(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  let maxNum = 0;
  const tasks = data.map(t => {
    const idMatch = t.id && t.id.match(/task-(\d+)/);
    if (idMatch) maxNum = Math.max(maxNum, parseInt(idMatch[1]));
    return {
      id: t.id || newId(), name: t.name || "", indent: t.indent || 0,
      startRaw: t.startRaw || "", dueRaw: t.dueRaw || "", progress: t.progress || 0,
      startDate: t.startISO ? new Date(t.startISO) : parseNaturalDate(t.startRaw),
      dueDate: t.dueISO ? new Date(t.dueISO) : parseNaturalDate(t.dueRaw),
    };
  });
  _id = Math.max(_id, maxNum);
  return tasks;
}

function saveToStorage(tasks, collapsedIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: serializeTasks(tasks),
      collapsed: Array.from(collapsedIds),
      savedAt: new Date().toISOString(),
    }));
  } catch (e) { console.error("Save failed:", e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const tasks = deserializeTasks(data.tasks);
    return tasks ? { tasks, collapsed: new Set(data.collapsed || []) } : null;
  } catch (e) { console.error("Load failed:", e); return null; }
}

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { console.error(e); }
}

// ── Drag helpers ──
function getTaskBlock(tasks, index) {
  const children = getChildren(tasks, index);
  return [index, ...children];
}

export default function GanttPlanner() {
  const [tasks, setTasks] = useState(() => {
    const data = loadFromStorage();
    if (data && data.tasks && data.tasks.length > 0) return data.tasks;
    return [createTask("")];
  });
  const [collapsed, setCollapsed] = useState(() => {
    const data = loadFromStorage();
    return data ? data.collapsed : new Set();
  });
  const [focusInfo, setFocusInfo] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropVisIdx, setDropVisIdx] = useState(null);

  const nameRefs = useRef({});
  const startRefs = useRef({});
  const dueRefs = useRef({});
  const saveTimer = useRef(null);
  const isInitialLoad = useRef(true);

  // Mark initial load complete after first render
  useEffect(() => { isInitialLoad.current = false; }, []);

  // Auto-save
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      saveToStorage(tasks, collapsed);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [tasks, collapsed]);

  // Focus
  useEffect(() => {
    if (focusInfo) {
      const { id, field } = focusInfo;
      const ref = field === "name" ? nameRefs.current[id]
        : field === "start" ? startRefs.current[id] : dueRefs.current[id];
      if (ref) {
        ref.focus();
        if (field === "name" && ref.setSelectionRange)
          ref.setSelectionRange(ref.value.length, ref.value.length);
      }
      setFocusInfo(null);
    }
  }, [focusInfo, tasks]);

  const toggleCollapse = useCallback((taskId) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  const visibleIndices = useMemo(() => {
    const visible = [];
    let skipUntilIndent = null;
    for (let i = 0; i < tasks.length; i++) {
      if (skipUntilIndent !== null) {
        if (tasks[i].indent > skipUntilIndent) continue;
        else skipUntilIndent = null;
      }
      visible.push(i);
      if (collapsed.has(tasks[i].id) && hasChildren(tasks, i))
        skipUntilIndent = tasks[i].indent;
    }
    return visible;
  }, [tasks, collapsed]);

  const updateTask = useCallback((id, field, value) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };
      if (field === "startRaw") updated.startDate = parseNaturalDate(value);
      if (field === "dueRaw") updated.dueDate = parseNaturalDate(value);
      return updated;
    }));
  }, []);

  const setProgress = useCallback((id, value) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, progress: value } : t));
  }, []);

  const addTaskAfter = useCallback((id) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      const currentTask = prev[idx];
      const indent = currentTask?.indent || 0;
      let insertIdx = idx + 1;
      if (currentTask && hasChildren(prev, idx) && !collapsed.has(currentTask.id)) {
        const children = getChildren(prev, idx);
        insertIdx = children[children.length - 1] + 1;
      }
      const task = createTask("", indent);
      const next = [...prev];
      next.splice(insertIdx, 0, task);
      setFocusInfo({ id: task.id, field: "name" });
      return next;
    });
  }, [collapsed]);

  const deleteTask = useCallback((id) => {
    setTasks(prev => {
      if (prev.length <= 1) {
        const t = createTask(""); setFocusInfo({ id: t.id, field: "name" }); return [t];
      }
      const idx = prev.findIndex(t => t.id === id);
      const childIndices = getChildren(prev, idx);
      const toRemove = new Set([idx, ...childIndices]);
      const next = prev.filter((_, i) => !toRemove.has(i));
      if (next.length === 0) {
        const t = createTask(""); setFocusInfo({ id: t.id, field: "name" }); return [t];
      }
      setFocusInfo({ id: next[Math.min(idx, next.length - 1)].id, field: "name" });
      return next;
    });
    setCollapsed(prev => { const nc = new Set(prev); nc.delete(id); return nc; });
  }, []);

  const indentTask = useCallback((id, direction) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, indent: Math.max(0, Math.min(4, t.indent + direction)) } : t
    ));
  }, []);

  const handleClearAll = useCallback(() => {
    clearStorage();
    const t = createTask("");
    setTasks([t]); setCollapsed(new Set());
    setShowClearConfirm(false);
    setFocusInfo({ id: t.id, field: "name" });
  }, []);

  // ── Drag-and-drop ──
  const handleDragStart = useCallback((e, taskId) => {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    const ghost = document.createElement("div");
    ghost.style.opacity = "0";
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragOver = useCallback((e, visIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropVisIdx(e.clientY < midY ? visIdx : visIdx + 1);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragId(null); setDropVisIdx(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (dragId === null || dropVisIdx === null) { handleDragEnd(); return; }

    setTasks(prev => {
      const dragIdx = prev.findIndex(t => t.id === dragId);
      if (dragIdx === -1) return prev;

      const block = getTaskBlock(prev, dragIdx);
      const blockIds = new Set(block.map(i => prev[i].id));

      let targetRealIdx;
      if (dropVisIdx >= visibleIndices.length) targetRealIdx = prev.length;
      else targetRealIdx = visibleIndices[dropVisIdx];

      if (blockIds.has(prev[targetRealIdx]?.id)) return prev;

      const blockItems = block.map(i => prev[i]);
      const remaining = prev.filter((_, i) => !new Set(block).has(i));

      let adjustedTarget = targetRealIdx;
      for (const bi of block) { if (bi < targetRealIdx) adjustedTarget--; }
      adjustedTarget = Math.max(0, Math.min(adjustedTarget, remaining.length));

      const result = [...remaining];
      result.splice(adjustedTarget, 0, ...blockItems);
      return result;
    });

    handleDragEnd();
  }, [dragId, dropVisIdx, visibleIndices, handleDragEnd]);

  const handleKeyDown = useCallback((e, id, field) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTaskAfter(id); }
    if (e.key === "Backspace" && field === "name") {
      const task = tasks.find(t => t.id === id);
      if (task && task.name === "" && tasks.length > 1) { e.preventDefault(); deleteTask(id); }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (field === "name") {
        if (e.shiftKey) indentTask(id, -1);
        else {
          const task = tasks.find(t => t.id === id);
          if (task && task.name === "") indentTask(id, 1);
          else setFocusInfo({ id, field: "start" });
        }
      } else if (field === "start") {
        if (e.shiftKey) setFocusInfo({ id, field: "name" });
        else setFocusInfo({ id, field: "due" });
      } else if (field === "due") {
        if (e.shiftKey) setFocusInfo({ id, field: "start" });
        else {
          const vt = visibleIndices.map(i => tasks[i]);
          const ci = vt.findIndex(t => t.id === id);
          if (ci < vt.length - 1) setFocusInfo({ id: vt[ci + 1].id, field: "name" });
        }
      }
    }
    if (e.key === "ArrowUp" && field === "name") {
      const vt = visibleIndices.map(i => tasks[i]);
      const ci = vt.findIndex(t => t.id === id);
      if (ci > 0) { e.preventDefault(); setFocusInfo({ id: vt[ci - 1].id, field: "name" }); }
    }
    if (e.key === "ArrowDown" && field === "name") {
      const vt = visibleIndices.map(i => tasks[i]);
      const ci = vt.findIndex(t => t.id === id);
      if (ci < vt.length - 1) { e.preventDefault(); setFocusInfo({ id: vt[ci + 1].id, field: "name" }); }
    }
  }, [tasks, visibleIndices, addTaskAfter, deleteTask, indentTask]);

  const { minDate, totalDays } = useMemo(() => {
    const dates = tasks.flatMap(t => [t.startDate, t.dueDate]).filter(Boolean);
    if (dates.length === 0) return { minDate: null, totalDays: 0 };
    let min = new Date(Math.min(...dates.map(d => d.getTime())));
    let max = new Date(Math.max(...dates.map(d => d.getTime())));
    min.setDate(min.getDate() - 1);
    max.setDate(max.getDate() + 2);
    return { minDate: min, totalDays: Math.ceil((max - min) / 864e5) + 1 };
  }, [tasks]);

  const dateLabels = useMemo(() => {
    if (!minDate || totalDays <= 0) return [];
    return Array.from({ length: totalDays + 1 }, (_, i) => {
      const d = new Date(minDate); d.setDate(d.getDate() + i); return d;
    });
  }, [minDate, totalDays]);

  const getBarPosition = (startDate, dueDate) => {
    if (!startDate || !dueDate || !minDate || dueDate < startDate) return null;
    const leftDays = (startDate - minDate) / 864e5;
    const widthDays = (dueDate - startDate) / 864e5 + 1;
    return { left: `${(leftDays / (totalDays + 1)) * 100}%`, width: `${(widthDays / (totalDays + 1)) * 100}%` };
  };

  const hasDates = tasks.some(t => t.startDate && t.dueDate);
  const hasAnyParents = tasks.some((_, i) => hasChildren(tasks, i));
  const ROW_H = 38;

  const draggedBlock = useMemo(() => {
    if (!dragId) return new Set();
    const idx = tasks.findIndex(t => t.id === dragId);
    if (idx === -1) return new Set();
    return new Set(getTaskBlock(tasks, idx).map(i => tasks[i].id));
  }, [dragId, tasks]);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#fafafa", color: "#1a1a2e",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px", borderBottom: "1px solid #e2e2e8",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 16,
        }}>G</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            Gantt Planner
            {saveStatus && (
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10,
                background: saveStatus === "saved" ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)",
                color: saveStatus === "saved" ? "#22c55e" : "#6366f1",
                transition: "all 0.3s ease",
              }}>
                {saveStatus === "saving" ? "Saving..." : "✓ Saved"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
            Auto-saves · plain English dates · drag to reorder · collapse to zoom out
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {hasAnyParents && (<>
            <button onClick={() => {
              const ap = tasks.filter((_, i) => hasChildren(tasks, i)).map(t => t.id);
              setCollapsed(new Set(ap));
            }} style={{
              padding: "5px 10px", fontSize: 11, fontWeight: 600,
              border: "1px solid #d0d0d8", borderRadius: 5,
              background: "transparent", cursor: "pointer", color: "#64748b", fontFamily: "inherit",
            }}>⊟ Collapse</button>
            <button onClick={() => setCollapsed(new Set())} style={{
              padding: "5px 10px", fontSize: 11, fontWeight: 600,
              border: "1px solid #d0d0d8", borderRadius: 5,
              background: "transparent", cursor: "pointer", color: "#64748b", fontFamily: "inherit",
            }}>⊞ Expand</button>
          </>)}
          {!showClearConfirm ? (
            <button onClick={() => setShowClearConfirm(true)} style={{
              padding: "5px 10px", fontSize: 11, fontWeight: 600,
              border: "1px solid #d0d0d8", borderRadius: 5,
              background: "transparent", cursor: "pointer", color: "#94a3b8",
              fontFamily: "inherit", marginLeft: 4,
            }}>Clear All</button>
          ) : (
            <div style={{
              display: "flex", gap: 4, alignItems: "center",
              padding: "3px 8px", borderRadius: 6,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>Sure?</span>
              <button onClick={handleClearAll} style={{
                padding: "3px 8px", fontSize: 11, fontWeight: 700,
                border: "none", borderRadius: 4, background: "#ef4444", color: "#fff",
                cursor: "pointer", fontFamily: "inherit",
              }}>Yes</button>
              <button onClick={() => setShowClearConfirm(false)} style={{
                padding: "3px 8px", fontSize: 11, fontWeight: 600,
                border: "none", borderRadius: 4, background: "transparent",
                color: "#64748b", cursor: "pointer", fontFamily: "inherit",
              }}>No</button>
            </div>
          )}
        </div>
      </div>

      {/* Help bar */}
      <div style={{
        padding: "7px 24px", background: "#f1f0fb",
        borderBottom: "1px solid #e2e2e8",
        fontSize: 11, color: "#64748b",
        display: "flex", gap: 14, flexWrap: "wrap", flexShrink: 0,
      }}>
        <span><b>⠿</b> drag to reorder</span>
        <span><b>Enter</b> new task</span>
        <span><b>Tab</b> next / indent</span>
        <span><b>⇧Tab</b> outdent / prev</span>
        <span><b>▶▼</b> collapse/expand</span>
        <span style={{ borderLeft: "1px solid #d0d0d8", paddingLeft: 14 }}>
          Dates: <em>tomorrow · next fri · in 2 weeks · may 15 · eom · +3d</em>
        </span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Outline */}
        <div style={{
          width: hasDates ? "48%" : "100%", minWidth: 480,
          borderRight: hasDates ? "1px solid #e2e2e8" : "none",
          overflow: "auto", transition: "width 0.3s ease", background: "#fff",
        }}>
          <div style={{ padding: "4px 0" }}>
            <div style={{
              display: "flex", alignItems: "center",
              padding: "8px 12px 6px", fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8",
              borderBottom: "1px solid #e2e2e8",
              position: "sticky", top: 0, background: "#fff", zIndex: 2,
            }}>
              <div style={{ width: 22 }}></div>
              <div style={{ flex: 1, paddingLeft: 4 }}>Task</div>
              <div style={{ width: 110, textAlign: "center" }}>Start</div>
              <div style={{ width: 110, textAlign: "center" }}>Due</div>
              <div style={{ width: 80, textAlign: "center" }}>Progress</div>
              <div style={{ width: 28 }}></div>
            </div>

            {visibleIndices.map((taskIdx, visIdx) => {
              const task = tasks[taskIdx];
              const isParent = hasChildren(tasks, taskIdx);
              const isCollapsed = collapsed.has(task.id);
              const childCount = isParent ? getChildren(tasks, taskIdx).length : 0;
              const displayProgress = isParent ? getAggregateProgress(tasks, taskIdx) : task.progress;
              const pColor = progressColor(displayProgress);
              const isDragging = draggedBlock.has(task.id);
              const showDropAbove = dropVisIdx === visIdx && dragId !== null && !isDragging;
              const showDropBelow = dropVisIdx === visIdx + 1 && visIdx === visibleIndices.length - 1 && dragId !== null && !isDragging;

              return (
                <div key={task.id} style={{ position: "relative" }}>
                  {showDropAbove && (
                    <div style={{
                      position: "absolute", top: -1, left: 12, right: 12,
                      height: 3, background: "#6366f1", borderRadius: 2, zIndex: 10,
                      boxShadow: "0 0 6px rgba(99,102,241,0.4)",
                    }}>
                      <div style={{
                        position: "absolute", left: -3, top: -3,
                        width: 9, height: 9, borderRadius: "50%", background: "#6366f1",
                      }} />
                    </div>
                  )}

                  <div
                    onDragOver={e => handleDragOver(e, visIdx)}
                    onDrop={handleDrop}
                    style={{
                      display: "flex", alignItems: "center", padding: "3px 12px",
                      minHeight: ROW_H,
                      borderBottom: "1px solid #f0f0f5",
                      background: isDragging ? "rgba(99,102,241,0.08)"
                        : isCollapsed && isParent ? "rgba(99,102,241,0.04)"
                        : visIdx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                      opacity: isDragging ? 0.5 : 1,
                      transition: "background 0.15s, opacity 0.15s",
                    }}
                  >
                    {/* Drag handle */}
                    <div
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        width: 18, height: 24,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "grab", flexShrink: 0, marginRight: 4,
                        color: "#bbb", fontSize: 14, letterSpacing: "1px",
                        borderRadius: 3, transition: "color 0.15s, background 0.15s",
                        userSelect: "none",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#6366f1"; e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#bbb"; e.currentTarget.style.background = "transparent"; }}
                      title="Drag to reorder"
                    >⠿</div>

                    <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                      <div style={{
                        width: task.indent * 20, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "flex-end",
                        paddingRight: task.indent > 0 ? 4 : 0,
                      }}>
                        {task.indent > 0 && !isParent && (
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: INDENT_COLORS[Math.min(task.indent - 1, 4)], opacity: 0.5,
                          }} />
                        )}
                      </div>

                      {isParent ? (
                        <button onClick={() => toggleCollapse(task.id)} style={{
                          width: 20, height: 20, border: "none",
                          background: isCollapsed ? INDENT_COLORS[Math.min(task.indent, 4)] : "transparent",
                          color: isCollapsed ? "#fff" : INDENT_COLORS[Math.min(task.indent, 4)],
                          cursor: "pointer", borderRadius: 4,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, flexShrink: 0, marginRight: 4,
                          transition: "all 0.15s", lineHeight: 1, fontFamily: "inherit",
                        }} title={isCollapsed ? `Expand (${childCount} items)` : "Collapse"}>
                          {isCollapsed ? "▶" : "▼"}
                        </button>
                      ) : <div style={{ width: 24, flexShrink: 0 }} />}

                      <input
                        ref={el => nameRefs.current[task.id] = el}
                        value={task.name}
                        onChange={e => updateTask(task.id, "name", e.target.value)}
                        onKeyDown={e => handleKeyDown(e, task.id, "name")}
                        placeholder={task.indent > 0 ? "Subtask..." : "Task name..."}
                        style={{
                          flex: 1, border: "none", outline: "none", padding: "6px 4px",
                          fontSize: 14, fontWeight: isParent ? 600 : (task.indent === 0 ? 500 : 400),
                          background: "transparent", color: "inherit", fontFamily: "inherit",
                        }}
                      />

                      {isParent && isCollapsed && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: INDENT_COLORS[Math.min(task.indent, 4)],
                          background: `${INDENT_COLORS[Math.min(task.indent, 4)]}18`,
                          padding: "1px 6px", borderRadius: 8, marginRight: 4, whiteSpace: "nowrap",
                        }}>{childCount} task{childCount !== 1 ? "s" : ""}</span>
                      )}
                    </div>

                    <div style={{ width: 110, position: "relative" }}>
                      <input
                        ref={el => startRefs.current[task.id] = el}
                        value={task.startRaw}
                        onChange={e => updateTask(task.id, "startRaw", e.target.value)}
                        onKeyDown={e => handleKeyDown(e, task.id, "start")}
                        placeholder="start..."
                        style={{
                          width: "100%", border: "1px solid transparent", borderRadius: 4,
                          outline: "none", padding: "5px 4px", fontSize: 12,
                          background: "transparent",
                          color: task.startDate ? "#1a1a2e" : "#94a3b8",
                          fontFamily: "inherit", textAlign: "center", transition: "border-color 0.15s",
                        }}
                        onFocus={e => e.target.style.borderColor = "#6366f1"}
                        onBlur={e => e.target.style.borderColor = "transparent"}
                      />
                      {task.startDate && (
                        <div style={{
                          position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
                          fontSize: 9, color: "#6366f1", whiteSpace: "nowrap", pointerEvents: "none",
                        }}>{formatDate(task.startDate)}</div>
                      )}
                    </div>

                    <div style={{ width: 110, position: "relative" }}>
                      <input
                        ref={el => dueRefs.current[task.id] = el}
                        value={task.dueRaw}
                        onChange={e => updateTask(task.id, "dueRaw", e.target.value)}
                        onKeyDown={e => handleKeyDown(e, task.id, "due")}
                        placeholder="due..."
                        style={{
                          width: "100%", border: "1px solid transparent", borderRadius: 4,
                          outline: "none", padding: "5px 4px", fontSize: 12,
                          background: "transparent",
                          color: task.dueDate ? "#1a1a2e" : "#94a3b8",
                          fontFamily: "inherit", textAlign: "center", transition: "border-color 0.15s",
                        }}
                        onFocus={e => e.target.style.borderColor = "#a855f7"}
                        onBlur={e => e.target.style.borderColor = "transparent"}
                      />
                      {task.dueDate && (
                        <div style={{
                          position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
                          fontSize: 9, color: "#a855f7", whiteSpace: "nowrap", pointerEvents: "none",
                        }}>{formatDate(task.dueDate)}</div>
                      )}
                    </div>

                    <div style={{
                      width: 80, display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 2, padding: "0 4px",
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: pColor,
                        lineHeight: 1, fontVariantNumeric: "tabular-nums",
                      }}>
                        {displayProgress}%{displayProgress >= 100 && " ✓"}
                      </div>
                      {isParent && !isCollapsed ? (
                        <div style={{
                          width: "100%", height: 6, borderRadius: 3,
                          background: "#e8e8ee", overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${displayProgress}%`, height: "100%",
                            background: pColor, borderRadius: 3, transition: "width 0.2s ease",
                          }} />
                        </div>
                      ) : (
                        <input
                          type="range" min="0" max="100" step="5"
                          value={isParent ? displayProgress : task.progress}
                          onChange={e => { if (!isParent) setProgress(task.id, parseInt(e.target.value)); }}
                          disabled={isParent}
                          style={{
                            width: "100%", height: 6, cursor: isParent ? "default" : "pointer",
                            accentColor: pColor, opacity: isParent ? 0.6 : 1,
                          }}
                        />
                      )}
                    </div>

                    <button onClick={() => deleteTask(task.id)} style={{
                      width: 28, height: 28, border: "none", background: "transparent",
                      color: "#94a3b8", cursor: "pointer", borderRadius: 4,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontFamily: "inherit", opacity: 0.4, transition: "opacity 0.15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
                    >×</button>
                  </div>

                  {showDropBelow && (
                    <div style={{
                      position: "absolute", bottom: -1, left: 12, right: 12,
                      height: 3, background: "#6366f1", borderRadius: 2, zIndex: 10,
                      boxShadow: "0 0 6px rgba(99,102,241,0.4)",
                    }}>
                      <div style={{
                        position: "absolute", left: -3, top: -3,
                        width: 9, height: 9, borderRadius: "50%", background: "#6366f1",
                      }} />
                    </div>
                  )}
                </div>
              );
            })}

            <div
              onDragOver={e => { e.preventDefault(); setDropVisIdx(visibleIndices.length); }}
              onDrop={handleDrop}
              style={{ minHeight: 40 }}
            >
              <button
                onClick={() => addTaskAfter(tasks[tasks.length - 1]?.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  margin: "8px 12px", padding: "6px 12px",
                  border: "1px dashed #d0d0d8", borderRadius: 6,
                  background: "transparent", color: "#64748b",
                  cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#d0d0d8"; e.currentTarget.style.color = "#64748b"; }}
              >+ Add task</button>
            </div>
          </div>
        </div>

        {/* Gantt chart */}
        {hasDates && (
          <div style={{ flex: 1, overflow: "auto", background: "#fafafa" }}>
            <div style={{
              display: "flex", position: "sticky", top: 0, zIndex: 2,
              background: "#fff", borderBottom: "1px solid #e2e2e8",
              minWidth: Math.max(totalDays * 36, 400), height: 35,
            }}>
              {dateLabels.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={i} style={{
                    flex: 1, minWidth: 36, textAlign: "center", fontSize: 10, padding: "4px 0",
                    borderRight: "1px solid #f0f0f5",
                    background: isToday ? "rgba(99,102,241,0.08)" : isWeekend ? "rgba(0,0,0,0.02)" : "transparent",
                    color: isToday ? "#6366f1" : isWeekend ? "#aaa" : "#64748b",
                    fontWeight: isToday ? 700 : 500,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.2,
                  }}>
                    <div>{["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]}</div>
                    <div style={{ fontSize: 11 }}>{formatShort(d)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ minWidth: Math.max(totalDays * 36, 400) }}>
              {visibleIndices.map((taskIdx, visIdx) => {
                const task = tasks[taskIdx];
                const isParent = hasChildren(tasks, taskIdx);
                const isCollapsed = collapsed.has(task.id);
                const displayProgress = isParent ? getAggregateProgress(tasks, taskIdx) : task.progress;
                const isDragging = draggedBlock.has(task.id);

                let bar = null;
                let isSummaryBar = false;
                if (isCollapsed && isParent) {
                  const range = getDescendantDateRange(tasks, taskIdx);
                  if (range.min && range.max) { bar = getBarPosition(range.min, range.max); isSummaryBar = true; }
                }
                if (!bar && task.startDate && task.dueDate) bar = getBarPosition(task.startDate, task.dueDate);

                let parentBracket = null;
                if (isParent && !isCollapsed) {
                  const range = getDescendantDateRange(tasks, taskIdx);
                  if (range.min && range.max) parentBracket = getBarPosition(range.min, range.max);
                }

                const cIdx = Math.min(task.indent, 4);

                return (
                  <div key={task.id} style={{
                    height: ROW_H, position: "relative",
                    borderBottom: "1px solid #f0f0f5",
                    background: isCollapsed && isParent ? "rgba(99,102,241,0.03)"
                      : visIdx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                    opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s",
                  }}>
                    {minDate && (() => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const dd = (today - minDate) / 864e5;
                      if (dd >= 0 && dd <= totalDays)
                        return <div style={{
                          position: "absolute", left: `${(dd/(totalDays+1))*100}%`,
                          top: 0, bottom: 0, width: 2, background: "rgba(99,102,241,0.25)", zIndex: 0,
                        }} />;
                      return null;
                    })()}

                    {parentBracket && !isSummaryBar && (
                      <div style={{
                        position: "absolute", top: 3, height: 4,
                        left: parentBracket.left, width: parentBracket.width,
                        background: INDENT_COLORS[cIdx], borderRadius: "2px 2px 0 0", opacity: 0.35, zIndex: 1,
                      }}>
                        <div style={{ position: "absolute", left: 0, bottom: -4, width: 2, height: 4, background: INDENT_COLORS[cIdx], opacity: 0.6 }} />
                        <div style={{ position: "absolute", right: 0, bottom: -4, width: 2, height: 4, background: INDENT_COLORS[cIdx], opacity: 0.6 }} />
                      </div>
                    )}

                    {bar && isSummaryBar && (
                      <div style={{
                        position: "absolute", top: 7, height: 24,
                        left: bar.left, width: bar.width,
                        background: BAR_BG_COLORS[cIdx],
                        borderRadius: 5, overflow: "hidden",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                        border: `2px solid ${INDENT_COLORS[cIdx]}`, zIndex: 1,
                      }} title={`${task.name} — ${displayProgress}% (${getChildren(tasks, taskIdx).length} tasks)`}>
                        <div style={{
                          position: "absolute", top: 0, left: 0, bottom: 0,
                          width: `${displayProgress}%`,
                          background: `repeating-linear-gradient(135deg,
                            ${INDENT_COLORS[cIdx]}, ${INDENT_COLORS[cIdx]} 4px,
                            ${BAR_COLORS[cIdx]} 4px, ${BAR_COLORS[cIdx]} 8px)`,
                          transition: "width 0.3s ease",
                        }} />
                        <div style={{
                          position: "relative", zIndex: 2,
                          display: "flex", alignItems: "center", height: "100%",
                          paddingLeft: 6, paddingRight: 6, gap: 4,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#fff",
                            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>{task.name}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: "#fff",
                            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                            whiteSpace: "nowrap", flexShrink: 0,
                          }}>{displayProgress}%</span>
                        </div>
                      </div>
                    )}

                    {bar && !isSummaryBar && (
                      <div style={{
                        position: "absolute",
                        top: isParent ? 11 : (task.indent > 0 ? 10 : 8),
                        height: isParent ? 16 : (task.indent > 0 ? 18 : 22),
                        left: bar.left, width: bar.width,
                        background: BAR_BG_COLORS[cIdx],
                        borderRadius: task.indent > 0 ? 4 : 5,
                        overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", zIndex: 1,
                      }} title={`${task.name}: ${formatDate(task.startDate)} → ${formatDate(task.dueDate)} (${displayProgress}%)`}>
                        <div style={{
                          position: "absolute", top: 0, left: 0, bottom: 0,
                          width: `${displayProgress}%`,
                          background: `linear-gradient(135deg, ${BAR_COLORS[cIdx]}, ${BAR_COLORS[Math.min(cIdx+1,4)]})`,
                          transition: "width 0.3s ease", borderRadius: "inherit",
                        }} />
                        <div style={{
                          position: "relative", zIndex: 2,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          height: "100%", paddingLeft: 6, paddingRight: 5,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            color: displayProgress > 40 ? "#fff" : INDENT_COLORS[cIdx],
                            textShadow: displayProgress > 40 ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>{task.name}</span>
                          {displayProgress > 0 && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, flexShrink: 0, marginLeft: 4,
                              color: displayProgress > 60 ? "#fff" : INDENT_COLORS[cIdx],
                              textShadow: displayProgress > 60 ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
                            }}>{displayProgress}%</span>
                          )}
                        </div>
                      </div>
                    )}

                    {!bar && (task.startDate || task.dueDate) && minDate && (() => {
                      const date = task.startDate || task.dueDate;
                      const dd = (date - minDate) / 864e5;
                      return <div style={{
                        position: "absolute", top: 13, left: `calc(${(dd/(totalDays+1))*100}% - 6px)`,
                        width: 12, height: 12, background: BAR_COLORS[cIdx],
                        borderRadius: "50%", border: "2px solid #fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)", zIndex: 1,
                      }} title={`${task.name}: ${formatDate(date)}`} />;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
