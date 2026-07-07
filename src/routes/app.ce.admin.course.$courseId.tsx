import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  getCourseAdmin, updateCourse, upsertLesson, deleteLesson, reorderLessons,
  getLessonQuizAdmin, upsertQuizSettings, upsertQuestion, deleteQuestion,
} from "@/lib/ce.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ce/admin/course/$courseId")({
  component: CourseEditor,
});

function CourseEditor() {
  const { courseId } = Route.useParams();
  const load = useServerFn(getCourseAdmin);
  const upd = useServerFn(updateCourse);
  const upLesson = useServerFn(upsertLesson);
  const delLesson = useServerFn(deleteLesson);
  const reorder = useServerFn(reorderLessons);

  const [data, setData] = useState<any>(null);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [quizForLesson, setQuizForLesson] = useState<string | null>(null);

  const reload = () => load({ data: { courseId } }).then(setData);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [courseId]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { course, lessons } = data;

  const saveMeta = async (patch: any) => {
    await upd({ data: { courseId, ...patch } });
    reload();
    toast.success("Saved");
  };

  return (
    <div className="space-y-6">
      <Link to="/app/ce/admin" className="text-xs text-muted-foreground hover:text-foreground">← Courses</Link>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
          <input defaultValue={course.title} onBlur={(e) => e.target.value !== course.title && saveMeta({ title: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
          <textarea defaultValue={course.description ?? ""} rows={3}
            onBlur={(e) => e.target.value !== (course.description ?? "") && saveMeta({ description: e.target.value || null })}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CE hours</label>
            <input type="number" step="0.25" defaultValue={course.credit_hours}
              onBlur={(e) => Number(e.target.value) !== Number(course.credit_hours) && saveMeta({ credit_hours: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
            <select defaultValue={course.status} onChange={(e) => saveMeta({ status: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Self-enroll</label>
            <select defaultValue={String(course.allow_self_enroll)} onChange={(e) => saveMeta({ allow_self_enroll: e.target.value === "true" })}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="false">Assigned only</option>
              <option value="true">Any member can enroll</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-foreground">Lessons</h2>
          <button onClick={() => setEditingLesson({ courseId, display_order: lessons.length })}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            + Add lesson
          </button>
        </div>
        <div className="space-y-2">
          {lessons.map((l: any, i: number) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-0.5">
                <button title="Move up" disabled={i === 0} onClick={async () => {
                  const arr = lessons.map((x: any) => x.id);
                  [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                  await reorder({ data: { courseId, orderedIds: arr } });
                  reload();
                }} className="text-xs disabled:opacity-30">▲</button>
                <button title="Move down" disabled={i === lessons.length - 1} onClick={async () => {
                  const arr = lessons.map((x: any) => x.id);
                  [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                  await reorder({ data: { courseId, orderedIds: arr } });
                  reload();
                }} className="text-xs disabled:opacity-30">▼</button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{i + 1}. {l.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {l.youtube_url}{l.has_quiz && " · has quiz"}{!l.required && " · optional"}
                </p>
              </div>
              <button onClick={() => setQuizForLesson(l.id)}
                className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Quiz</button>
              <button onClick={() => setEditingLesson(l)}
                className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Edit</button>
              <button onClick={async () => {
                if (!confirm("Delete lesson?")) return;
                await delLesson({ data: { lessonId: l.id } });
                reload();
              }} className="rounded-lg border border-border px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
            </div>
          ))}
        </div>
      </div>

      {editingLesson && (
        <LessonModal
          lesson={editingLesson}
          courseId={courseId}
          onClose={() => setEditingLesson(null)}
          onSaved={() => { setEditingLesson(null); reload(); }}
          save={upLesson}
        />
      )}
      {quizForLesson && (
        <QuizModal lessonId={quizForLesson} onClose={() => { setQuizForLesson(null); reload(); }} />
      )}
    </div>
  );
}

function LessonModal({ lesson, courseId, onClose, onSaved, save }: any) {
  const [title, setTitle] = useState(lesson.title ?? "");
  const [description, setDescription] = useState(lesson.description ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(lesson.youtube_url ?? "");
  const [required, setRequired] = useState(lesson.required ?? true);
  const [duration, setDuration] = useState(lesson.duration_seconds ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: {
        lessonId: lesson.id,
        courseId,
        title, description: description || null,
        youtube_url: youtubeUrl,
        required,
        duration_seconds: duration ? Number(duration) : null,
        display_order: lesson.display_order ?? 0,
      }});
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-serif text-lg font-semibold">{lesson.id ? "Edit" : "Add"} lesson</h3>
        <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <textarea placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input placeholder="YouTube URL (optional — add later)" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Required for completion
          </label>
          <input type="number" placeholder="Duration (sec)" value={duration as any} onChange={(e) => setDuration(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
          <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save</button>
        </div>
      </form>
    </div>
  );
}

function QuizModal({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const load = useServerFn(getLessonQuizAdmin);
  const saveSettings = useServerFn(upsertQuizSettings);
  const saveQuestion = useServerFn(upsertQuestion);
  const delQuestion = useServerFn(deleteQuestion);
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const reload = () => load({ data: { lessonId } }).then(setData);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lessonId]);

  if (!data) return null;
  const settings = data.settings ?? { lesson_id: lessonId, passing_score_pct: 80, max_attempts: null, shuffle_questions: false };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">Quiz</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-xl border border-border p-3">
          <div>
            <label className="text-xs text-muted-foreground">Passing %</label>
            <input type="number" min={0} max={100} defaultValue={settings.passing_score_pct}
              onBlur={(e) => saveSettings({ data: {
                lessonId, passing_score_pct: Number(e.target.value),
                max_attempts: settings.max_attempts, shuffle_questions: settings.shuffle_questions,
              }}).then(reload)}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max attempts (blank = unlimited)</label>
            <input type="number" min={1} defaultValue={settings.max_attempts ?? ""}
              onBlur={(e) => saveSettings({ data: {
                lessonId, passing_score_pct: settings.passing_score_pct,
                max_attempts: e.target.value ? Number(e.target.value) : null,
                shuffle_questions: settings.shuffle_questions,
              }}).then(reload)}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Shuffle</label>
            <select defaultValue={String(settings.shuffle_questions)}
              onChange={(e) => saveSettings({ data: {
                lessonId, passing_score_pct: settings.passing_score_pct,
                max_attempts: settings.max_attempts, shuffle_questions: e.target.value === "true",
              }}).then(reload)}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1 text-sm">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Questions ({data.questions.length})</h4>
          <button onClick={() => setEditing({ lesson_id: lessonId, display_order: data.questions.length,
            kind: "multiple_choice", multi_select: false, prompt: "", explanation: "",
            ce_quiz_options: [{ label: "", is_correct: true, display_order: 0 }, { label: "", is_correct: false, display_order: 1 }] })}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">+ Add question</button>
        </div>

        <div className="space-y-2">
          {data.questions.map((q: any, i: number) => (
            <div key={q.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">{i + 1}. {q.prompt}</p>
                <p className="text-xs text-muted-foreground">
                  {q.kind === "true_false" ? "True/False" : q.multi_select ? "Multi-select" : "Single choice"} ·
                  {" "}{q.ce_quiz_options.length} options
                </p>
              </div>
              <button onClick={() => setEditing(q)} className="text-xs text-primary">Edit</button>
              <button onClick={async () => {
                if (!confirm("Delete question?")) return;
                await delQuestion({ data: { questionId: q.id, lessonId } });
                reload();
              }} className="text-xs text-red-600">Delete</button>
            </div>
          ))}
        </div>

        {editing && (
          <QuestionEditor
            question={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }}
            save={saveQuestion}
            lessonId={lessonId}
          />
        )}
      </div>
    </div>
  );
}

function QuestionEditor({ question, onClose, onSaved, save, lessonId }: any) {
  const [prompt, setPrompt] = useState(question.prompt ?? "");
  const [kind, setKind] = useState<"multiple_choice" | "true_false">(question.kind ?? "multiple_choice");
  const [multiSelect, setMultiSelect] = useState(!!question.multi_select);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [options, setOptions] = useState<any[]>(() => {
    if (question.kind === "true_false" || (question.id == null && kind === "true_false")) {
      const existing = question.ce_quiz_options ?? [];
      if (existing.length > 0) return existing.sort((a: any, b: any) => a.display_order - b.display_order);
      return [{ label: "True", is_correct: true, display_order: 0 }, { label: "False", is_correct: false, display_order: 1 }];
    }
    return (question.ce_quiz_options ?? []).slice().sort((a: any, b: any) => a.display_order - b.display_order);
  });
  const [busy, setBusy] = useState(false);

  const setOpt = (i: number, patch: any) => setOptions((o) => o.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const addOpt = () => setOptions((o) => [...o, { label: "", is_correct: false, display_order: o.length }]);
  const removeOpt = (i: number) => setOptions((o) => o.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!options.some((o) => o.is_correct)) { toast.error("Mark at least one correct answer"); return; }
    setBusy(true);
    try {
      await save({ data: {
        questionId: question.id, lessonId,
        prompt, kind, multi_select: kind === "multiple_choice" && multiSelect,
        explanation: explanation || null, display_order: question.display_order ?? 0,
        options: options.map((o, i) => ({ id: o.id, label: o.label, is_correct: !!o.is_correct, display_order: i })),
      }});
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border-2 border-primary bg-background p-4 space-y-3">
      <textarea required placeholder="Question prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
        className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <div className="flex gap-3">
        <select value={kind} onChange={(e) => {
          const k = e.target.value as any;
          setKind(k);
          if (k === "true_false") setOptions([
            { label: "True", is_correct: true, display_order: 0 },
            { label: "False", is_correct: false, display_order: 1 },
          ]);
        }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / False</option>
        </select>
        {kind === "multiple_choice" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={multiSelect} onChange={(e) => setMultiSelect(e.target.checked)} />
            Allow multiple correct answers
          </label>
        )}
      </div>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type={multiSelect ? "checkbox" : "radio"} name="correct"
              checked={!!o.is_correct}
              onChange={(e) => {
                if (multiSelect || kind === "true_false") setOpt(i, { is_correct: e.target.checked });
                else setOptions((prev) => prev.map((x, idx) => ({ ...x, is_correct: idx === i })));
              }} />
            <input required placeholder={`Option ${i + 1}`} value={o.label}
              onChange={(e) => setOpt(i, { label: e.target.value })}
              disabled={kind === "true_false"}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
            {kind === "multiple_choice" && options.length > 2 && (
              <button type="button" onClick={() => removeOpt(i)} className="text-xs text-red-600">✕</button>
            )}
          </div>
        ))}
        {kind === "multiple_choice" && (
          <button type="button" onClick={addOpt} className="text-xs text-primary">+ Add option</button>
        )}
      </div>
      <textarea placeholder="Explanation shown after submit (optional)" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2}
        className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm">Cancel</button>
        <button disabled={busy} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}
