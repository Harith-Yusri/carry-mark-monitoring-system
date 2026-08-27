import React, { useState } from "react";
import { Plus, CheckCircle, ChevronRight, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { ACADEMIC_SESSION, lecturerAccount, lecturerSubjectsData } from "../../mock/mockData";

export type LecturerSubject = { code: string; name: string; progSem: number; students: number; lastSync: string | null; status: string };

export const lecturerSubjects: LecturerSubject[] = lecturerSubjectsData;

export function LecturerDashboard({ onSelectSubject }: { onSelectSubject: (subj: LecturerSubject) => void }) {
  const C = useColors();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjects, setSubjects] = useState<LecturerSubject[]>(() => {
    try { return JSON.parse(localStorage.getItem("carrymark_lecturer_subjects_v3") || "null") ?? lecturerSubjects; }
    catch { return lecturerSubjects; }
  });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("1");
  const [formError, setFormError] = useState("");

  const progSems = [...new Set(subjects.map(s => s.progSem))].sort((a, b) => a - b);

  const createSubject = () => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode || !name.trim()) return setFormError("Subject code and name are required.");
    if (subjects.some(subject => subject.code === normalizedCode)) return setFormError("That subject code already exists.");
    const next = [...subjects, { code: normalizedCode, name: name.trim(), progSem: Number(semester), students: 0, lastSync: null, status: "draft" }];
    setSubjects(next);
    localStorage.setItem("carrymark_lecturer_subjects_v3", JSON.stringify(next));
    setCode(""); setName(""); setSemester("1"); setFormError(""); setShowCreateModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 2px" }}>My Subjects</h1>
          <p style={{ fontSize: "12px", color: C.textMuted }}>
            {lecturerAccount.name} ({lecturerAccount.id}) · {ACADEMIC_SESSION} · {subjects.length} subject{subjects.length === 1 ? "" : "s"} across {progSems.length} programme semester{progSems.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ background: C.maroon, color: "#fff", border: "none", borderRadius: "6px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, fontFamily: C.sans, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={15} /> Create New Subject
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {progSems.map(ps => {
          const psSubs = subjects.filter(s => s.progSem === ps);
          return (
            <div key={ps}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "28px", height: "28px", background: C.maroonLight, border: `1px solid ${C.maroon}44`, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: C.mono, fontSize: "12px", fontWeight: 700, color: C.maroon }}>{ps}</span>
                </div>
                <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text }}>Programme Semester {ps}</span>
                <span style={{ fontFamily: C.mono, fontSize: "10px", color: C.textMuted }}>· {psSubs.length} subject{psSubs.length !== 1 ? "s" : ""}</span>
                <div style={{ flex: 1, height: "1px", background: C.border }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
                {psSubs.map(subj => {
                  const isSubmitted = subj.status === "submitted";
                  return (
                    <button
                      key={subj.code}
                      onClick={() => onSelectSubject(subj)}
                      style={{ textAlign: "left", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "18px 20px", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={event => { event.currentTarget.style.borderColor = C.border; event.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <span style={{ fontFamily: C.mono, fontSize: "11px", color: C.maroon, fontWeight: 600 }}>{subj.code}</span>
                          <span style={{ fontFamily: C.mono, fontSize: "9px", background: C.elevated, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: "3px", padding: "1px 5px" }}>SEM {subj.progSem}</span>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", fontFamily: C.mono, padding: "2px 7px", borderRadius: "3px", background: isSubmitted ? C.greenLight : C.amberLight, color: isSubmitted ? C.green : C.amber, border: `1px solid ${isSubmitted ? C.green + "44" : C.amber + "44"}` }}>
                          {isSubmitted && <CheckCircle size={9} />}{isSubmitted ? "FINALISED" : "IN PROGRESS"}
                        </div>
                      </div>
                      <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text, marginBottom: "10px" }}>{subj.name}</div>
                      <div style={{ display: "flex", gap: "14px", marginBottom: "10px", fontSize: "11px", color: C.textMuted }}>
                        <div><span style={{ fontFamily: C.mono, color: C.textSub }}>{subj.students}</span> students</div>
                        <div>Last Sync: <span style={{ fontFamily: C.mono, color: C.textSub }}>{subj.lastSync ?? "Pending"}</span></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: C.maroon, fontSize: "12px", fontWeight: 600 }}>
                        <span>Manage Subject Hub</span><ChevronRight size={14} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", width: "420px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "16px", color: C.text }}>Create New Subject</div>
              <X size={18} color={C.textMuted} style={{ cursor: "pointer" }} onClick={() => setShowCreateModal(false)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>SUBJECT CODE</label>
                <input value={code} onChange={event => setCode(event.target.value)} placeholder="e.g. ITT600" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>SUBJECT NAME</label>
                <input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Cloud Computing & DevOps" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>PROGRAMME SEMESTER</label>
                <select value={semester} onChange={event => setSemester(event.target.value)} style={{ width: "100%", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text }}>
                  {[1,2,3,4,5,6].map(value => <option key={value} value={value}>Semester {value}</option>)}
                </select>
              </div>
              {formError && <div style={{ color: C.red, fontSize: "12px" }}>{formError}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: "8px 14px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "6px", color: C.text, fontSize: "12px", cursor: "pointer" }}>Cancel</button>
              <button onClick={createSubject} style={{ padding: "8px 14px", background: C.maroon, border: "none", borderRadius: "6px", color: "#fff", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>Create Subject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
