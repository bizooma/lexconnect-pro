import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  listContacts,
  addContact,
  getContactDetail,
  addContactTag,
  removeContactTag,
  addContactNote,
  addContactInteraction,
  addFollowUp,
  updateFollowUpStatus,
  getMemberEngagement,
  linkOrgContacts,
  importContactsBatch,
  bulkInviteContacts,
  getContactSegments,
  type ContactRow,
  type MemberEngagement,
  type SegmentKey,
} from "@/lib/org-contacts.functions";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/org/clients")({
  component: ClientsPage,
});

const STATUS_LABEL: Record<ContactRow["status"], string> = {
  member: "Member",
  invited: "Invited",
  contact: "Contact",
};

const STATUS_TONE: Record<ContactRow["status"], string> = {
  member: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  invited: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  contact: "bg-muted text-muted-foreground",
};

function ClientsPage() {
  const { currentOrgId, currentOrg, isOrgAdmin, loading } = useCurrentOrg();
  const label = currentOrg?.kind === "firm" ? "Clients" : "Members";
  const singular = currentOrg?.kind === "firm" ? "client" : "member";

  const list = useServerFn(listContacts);
  const create = useServerFn(addContact);
  const linkFn = useServerFn(linkOrgContacts);
  const importFn = useServerFn(importContactsBatch);
  const inviteFn = useServerFn(bulkInviteContacts);
  const segmentsFn = useServerFn(getContactSegments);

  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("__all__");
  const [status, setStatus] = useState<"all" | "member" | "invited" | "contact">("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [segments, setSegments] = useState<Record<SegmentKey, ContactRow[]> | null>(null);
  const [segCounts, setSegCounts] = useState<Record<SegmentKey, number> | null>(null);
  const [activeSegment, setActiveSegment] = useState<SegmentKey | null>(null);

  const refresh = useMemo(
    () => async () => {
      if (!currentOrgId) return;
      setBusy(true);
      try {
        const res = await list({
          data: {
            organizationId: currentOrgId,
            search,
            tag: tag === "__all__" ? "" : tag,
            status,
            page,
          },
        });
        setRows(res.rows);
        setTotal(res.total);
        setPageSize(res.pageSize);
        setTagOptions(res.tagOptions);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load");
      } finally {
        setBusy(false);
      }
    },
    [currentOrgId, list, search, tag, status, page],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fire-and-forget: backfill contact→member links on page load.
  useEffect(() => {
    if (!currentOrgId) return;
    linkFn({ data: { organizationId: currentOrgId } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const loadSegments = useMemo(
    () => async () => {
      if (!currentOrgId) return;
      try {
        const s = await segmentsFn({ data: { organizationId: currentOrgId } });
        setSegments(s.segments);
        setSegCounts(s.counts);
      } catch {
        /* noop */
      }
    },
    [currentOrgId, segmentsFn],
  );

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const visibleRows = activeSegment && segments ? segments[activeSegment] : rows;

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isOrgAdmin) return <Navigate to="/app/dashboard" />;

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">{label}</h1>
          <p className="text-sm text-muted-foreground">
            Track {singular}s, tag and note them, log interactions, and set follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => exportRowsToCsv(visibleRows, label)}>
            {activeSegment ? "Export segment" : "Export CSV"}
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Import from your AMS</Button>
            </DialogTrigger>
            {importOpen && currentOrgId && (
              <ImportContactsDialog
                organizationId={currentOrgId}
                importFn={importFn}
                inviteFn={inviteFn}
                linkFn={linkFn}
                onDone={() => {
                  setImportOpen(false);
                  refresh();
                }}
              />
            )}
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add {singular}</Button>
            </DialogTrigger>
            <AddContactDialog
              onCreated={async (payload) => {
                if (!currentOrgId) return;
                try {
                  await create({ data: { organizationId: currentOrgId, ...payload } });
                  toast.success(`${label.slice(0, -1)} added`);
                  setAddOpen(false);
                  refresh();
                } catch (e: any) {
                  toast.error(e.message ?? "Failed to add");
                }
              }}
            />
          </Dialog>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Input
          value={search}
          onChange={(e) => { setPage(0); setSearch(e.target.value); }}
          placeholder="Search name or email"
          className="w-56"
        />
        <Select
          value={tag}
          onValueChange={(v) => { setPage(0); setTag(v); }}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All tags</SelectItem>
            {tagOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v: any) => { setPage(0); setStatus(v); }}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="contact">Contact</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {busy ? "Loading…" : `${total} total`}
        </span>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {SEGMENT_DEFS.map((s) => {
          const count = segCounts?.[s.key] ?? 0;
          const isActive = activeSegment === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSegment(isActive ? null : s.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent"
              }`}
              title={s.description}
            >
              <span>{s.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
        {activeSegment && (
          <button
            onClick={() => setActiveSegment(null)}
            className="text-xs text-muted-foreground underline"
          >
            Clear segment
          </button>
        )}
      </section>


      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1.5fr_1.5fr_100px_1.5fr_120px] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span>Email</span>
          <span>Status</span>
          <span>Tags</span>
          <span>Last note</span>
        </div>
        {rows.length === 0 && !busy && (
          <p className="p-8 text-center text-sm text-muted-foreground">No {label.toLowerCase()} yet.</p>
        )}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setOpenId(r.id)}
            className="grid w-full grid-cols-[1.5fr_1.5fr_100px_1.5fr_120px] items-center gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-accent/50"
          >
            <span className="truncate font-medium">{r.full_name || "—"}</span>
            <span className="truncate text-muted-foreground">{r.email}</span>
            <span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {r.tags.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : r.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
              ))}
              {r.tags.length > 4 && <span className="text-xs text-muted-foreground">+{r.tags.length - 4}</span>}
            </span>
            <span className="text-xs text-muted-foreground">
              {r.last_note_at ? new Date(r.last_note_at).toLocaleDateString() : "—"}
            </span>
          </button>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {currentOrgId && (
        <ContactDrawer
          organizationId={currentOrgId}
          contactId={openId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function AddContactDialog({
  onCreated,
}: {
  onCreated: (p: { email: string; full_name: string | null; phone: string | null; external_ref: string | null }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [ref, setRef] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>AMS ID (external ref)</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button
          disabled={!email.trim()}
          onClick={() => onCreated({
            email: email.trim(),
            full_name: fullName.trim() || null,
            phone: phone.trim() || null,
            external_ref: ref.trim() || null,
          })}
        >Add</Button>
      </DialogFooter>
    </DialogContent>
  );
}

type Detail = any;


function ContactDrawer({
  organizationId,
  contactId,
  onClose,
  onChanged,
}: {
  organizationId: string;
  contactId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const getDetail = useServerFn(getContactDetail);
  const addTag = useServerFn(addContactTag);
  const rmTag = useServerFn(removeContactTag);
  const addNote = useServerFn(addContactNote);
  const addIx = useServerFn(addContactInteraction);
  const addFu = useServerFn(addFollowUp);
  const setFuStatus = useServerFn(updateFollowUpStatus);

  const [detail, setDetail] = useState<any | null>(null);
  const [newTag, setNewTag] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [ixKind, setIxKind] = useState<"call" | "email" | "meeting" | "event" | "other">("call");
  const [ixNote, setIxNote] = useState("");
  const [ixWhen, setIxWhen] = useState("");
  const [fuTitle, setFuTitle] = useState("");
  const [fuDue, setFuDue] = useState("");
  const [fuAssignee, setFuAssignee] = useState<string>("__unassigned__");
  const [engagement, setEngagement] = useState<MemberEngagement | null>(null);
  const [engLoading, setEngLoading] = useState(false);
  const loadEngagement = useServerFn(getMemberEngagement);

  const load = async () => {
    if (!contactId) return;
    try {
      const d = await getDetail({ data: { organizationId, contactId } });
      setDetail(d);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load contact");
    }
  };

  useEffect(() => {
    if (contactId) load();
    else setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  return (
    <Sheet open={!!contactId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail?.contact?.full_name || detail?.contact?.email || "Contact"}</SheetTitle>
        </SheetHeader>

        {!detail ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Tabs
            defaultValue="details"
            className="mt-4"
            onValueChange={async (v) => {
              if (v !== "engagement" || engagement || engLoading || !detail?.contact?.user_id) return;
              setEngLoading(true);
              try {
                const e = await loadEngagement({ data: { organizationId, contactId: detail.contact.id } });
                setEngagement(e);
              } catch (err: any) {
                toast.error(err.message ?? "Failed to load engagement");
              } finally {
                setEngLoading(false);
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="engagement" disabled={!detail?.contact?.user_id}>
                Engagement
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4 space-y-6 text-sm">
          <div className="space-y-6">

            <section className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="mt-1">{detail.contact.email}</p>
              {detail.contact.phone && <p className="text-muted-foreground">{detail.contact.phone}</p>}
              {detail.contact.external_ref && <p className="text-xs text-muted-foreground">AMS ID: {detail.contact.external_ref}</p>}
            </section>

            {/* TAGS */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={async () => {
                      await rmTag({ data: { organizationId, tagId: t.id } });
                      await load(); onChanged();
                    }}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-destructive/20"
                    title="Remove tag"
                  >{t.tag} ×</button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag"
                  maxLength={40}
                />
                <Button
                  size="sm"
                  disabled={!newTag.trim()}
                  onClick={async () => {
                    try {
                      await addTag({ data: { organizationId, contactId: detail.contact.id, tag: newTag.trim() } });
                      setNewTag("");
                      await load(); onChanged();
                    } catch (e: any) { toast.error(e.message); }
                  }}
                >Add</Button>
              </div>
            </section>

            {/* NOTES */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Notes</h3>
              <div className="space-y-2">
                <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} maxLength={5000} placeholder="Add a note…" />
                <Button size="sm" disabled={!noteBody.trim()} onClick={async () => {
                  try {
                    await addNote({ data: { organizationId, contactId: detail.contact.id, body: noteBody.trim() } });
                    setNoteBody("");
                    await load(); onChanged();
                  } catch (e: any) { toast.error(e.message); }
                }}>Save note</Button>
              </div>
              <ul className="mt-3 space-y-2">
                {detail.notes.map((n: any) => (
                  <li key={n.id} className="rounded-md border border-border bg-card p-2">
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{n.author_name} • {new Date(n.created_at).toLocaleString()}</p>
                  </li>
                ))}
                {detail.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              </ul>
            </section>

            {/* INTERACTIONS */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Interactions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Select value={ixKind} onValueChange={(v: any) => setIxKind(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["call", "email", "meeting", "event", "other"] as const).map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={ixWhen} onChange={(e) => setIxWhen(e.target.value)} />
              </div>
              <Textarea className="mt-2" rows={2} maxLength={5000} placeholder="Notes (optional)" value={ixNote} onChange={(e) => setIxNote(e.target.value)} />
              <Button size="sm" className="mt-2" onClick={async () => {
                try {
                  await addIx({ data: {
                    organizationId, contactId: detail.contact.id,
                    kind: ixKind, note: ixNote.trim() || null,
                    occurred_at: ixWhen ? new Date(ixWhen).toISOString() : undefined,
                  }});
                  setIxNote(""); setIxWhen("");
                  await load(); onChanged();
                } catch (e: any) { toast.error(e.message); }
              }}>Log interaction</Button>
              <ul className="mt-3 space-y-2">
                {detail.interactions.map((i: any) => (
                  <li key={i.id} className="rounded-md border border-border bg-card p-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i.kind}</p>
                    {i.note && <p className="mt-1 whitespace-pre-wrap text-sm">{i.note}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{i.creator_name} • {new Date(i.occurred_at).toLocaleString()}</p>
                  </li>
                ))}
                {detail.interactions.length === 0 && <p className="text-xs text-muted-foreground">No interactions logged.</p>}
              </ul>
            </section>

            {/* FOLLOW-UPS */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Follow-ups</h3>
              <div className="space-y-2">
                <Input placeholder="Title" value={fuTitle} onChange={(e) => setFuTitle(e.target.value)} maxLength={200} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="datetime-local" value={fuDue} onChange={(e) => setFuDue(e.target.value)} />
                  <Select value={fuAssignee} onValueChange={setFuAssignee}>
                    <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {detail.admins.map((a: any) => (
                        <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!fuTitle.trim()} onClick={async () => {
                  try {
                    await addFu({ data: {
                      organizationId, contactId: detail.contact.id,
                      title: fuTitle.trim(),
                      due_at: fuDue ? new Date(fuDue).toISOString() : null,
                      assigned_to: fuAssignee === "__unassigned__" ? null : fuAssignee,
                    }});
                    setFuTitle(""); setFuDue(""); setFuAssignee("__unassigned__");
                    await load(); onChanged();
                  } catch (e: any) { toast.error(e.message); }
                }}>Add follow-up</Button>
              </div>
              <ul className="mt-3 space-y-2">
                {detail.followUps.map((f: any) => (
                  <li key={f.id} className="rounded-md border border-border bg-card p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{f.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {f.due_at ? `Due ${new Date(f.due_at).toLocaleString()}` : "No due date"}
                          {f.assignee_name ? ` • ${f.assignee_name}` : ""}
                          {" • "}{f.status}
                        </p>
                      </div>
                      {f.status === "open" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={async () => {
                            await setFuStatus({ data: { organizationId, followUpId: f.id, status: "done" } });
                            await load();
                          }}>Done</Button>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            await setFuStatus({ data: { organizationId, followUpId: f.id, status: "dismissed" } });
                            await load();
                          }}>Dismiss</Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {detail.followUps.length === 0 && <p className="text-xs text-muted-foreground">No follow-ups yet.</p>}
              </ul>
            </section>
          </div>
            </TabsContent>
            <TabsContent value="engagement" className="mt-4 text-sm">
              {!detail?.contact?.user_id ? (
                <p className="text-muted-foreground">This contact has not been linked to a member account yet.</p>
              ) : engLoading || !engagement ? (
                <p className="text-muted-foreground">Loading engagement…</p>
              ) : (
                <EngagementView data={engagement} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EngagementView({ data }: { data: MemberEngagement }) {
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Last sign-in</p>
        <p className="mt-1">{fmt(data.lastSignInAt)}</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Mentorship</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <Stat label="Active" value={data.mentorship.active} />
          <Stat label="Completed" value={data.mentorship.completed} />
          <Stat label="Last activity" value={fmt(data.mentorship.lastActivityAt)} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Continuing Education — {data.ce.totalCredits} credit{data.ce.totalCredits === 1 ? "" : "s"} earned
        </p>
        {data.ce.enrollments.length === 0 ? (
          <p className="mt-1 text-muted-foreground">No enrollments.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {data.ce.enrollments.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{e.courseTitle}</span>
                <span className="text-xs text-muted-foreground">
                  {e.status}{e.completedAt ? ` • ${new Date(e.completedAt).toLocaleDateString()}` : ""} • {e.creditHours}h
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Q&amp;A</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Stat label="Posts" value={data.qa.posts} />
          <Stat label="Replies" value={data.qa.replies} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Messaging (metadata only)</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Stat label="Conversations" value={data.messaging.conversations} />
          <Stat label="Last activity" value={fmt(data.messaging.lastActivityAt)} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportRowsToCsv(rows: ContactRow[], label: string) {
  const header = [
    "email", "full_name", "phone", "external_ref",
    "status", "tags", "invited_at", "created_at", "last_note_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.email, r.full_name ?? "", r.phone ?? "", r.external_ref ?? "",
      r.status, r.tags.join("; "),
      r.invited_at ?? "", r.created_at, r.last_note_at ?? "",
    ].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV IMPORT DIALOG
// ─────────────────────────────────────────────────────────────────────────────
const IMPORT_MAX_ROWS = 5000;
const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const MAPPING_FIELDS = ["email", "full_name", "phone", "external_ref"] as const;
type MappingField = (typeof MAPPING_FIELDS)[number];

function parseCsv(text: string): string[][] {
  // Minimal RFC-4180-ish parser: quoted cells with "" escape; \n or \r\n rows.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += ch; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function ImportContactsDialog({
  organizationId,
  importFn,
  inviteFn,
  linkFn,
  onDone,
}: {
  organizationId: string;
  importFn: (a: { data: { organizationId: string; rows: Record<string, any>[] } }) => Promise<any>;
  inviteFn: (a: { data: any }) => Promise<any>;
  linkFn: (a: { data: { organizationId: string } }) => Promise<any>;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<MappingField, string>>({
    email: "", full_name: "", phone: "", external_ref: "",
  });
  const [result, setResult] = useState<{ imported: number; skippedDuplicates: number; invalid: number } | null>(null);
  const [invitePrompt, setInvitePrompt] = useState(false);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);

  const onFile = async (file: File) => {
    if (file.size > IMPORT_MAX_BYTES) {
      toast.error("File too large — max 2MB");
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("No rows found in file");
      return;
    }
    if (rows.length - 1 > IMPORT_MAX_ROWS) {
      toast.error(`Too many rows — max ${IMPORT_MAX_ROWS.toLocaleString()}`);
      return;
    }
    const hdrs = rows[0].map((h) => h.trim());
    setHeaders(hdrs);
    setDataRows(rows.slice(1));

    // Autodetect common column names.
    const auto = (names: string[]) =>
      hdrs.find((h) => names.some((n) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === n)) ?? "";
    setMapping({
      email: auto(["email", "emailaddress", "e-mail"]),
      full_name: auto(["fullname", "name", "displayname"]),
      phone: auto(["phone", "phonenumber", "mobile", "cell"]),
      external_ref: auto(["id", "memberid", "externalid", "amsid", "ref"]),
    });
    setStep("map");
  };

  const previewObjects = useMemo(() => {
    if (!mapping.email) return [];
    const idx = (col: string) => (col ? headers.indexOf(col) : -1);
    const eIdx = idx(mapping.email);
    const nIdx = idx(mapping.full_name);
    const pIdx = idx(mapping.phone);
    const rIdx = idx(mapping.external_ref);
    return dataRows.slice(0, 10).map((r) => ({
      email: eIdx >= 0 ? (r[eIdx] ?? "").trim() : "",
      full_name: nIdx >= 0 ? (r[nIdx] ?? "").trim() : "",
      phone: pIdx >= 0 ? (r[pIdx] ?? "").trim() : "",
      external_ref: rIdx >= 0 ? (r[rIdx] ?? "").trim() : "",
    }));
  }, [mapping, headers, dataRows]);

  const runImport = async () => {
    if (!mapping.email) {
      toast.error("Map the email column");
      return;
    }
    setStep("importing");
    const eIdx = headers.indexOf(mapping.email);
    const nIdx = mapping.full_name ? headers.indexOf(mapping.full_name) : -1;
    const pIdx = mapping.phone ? headers.indexOf(mapping.phone) : -1;
    const rIdx = mapping.external_ref ? headers.indexOf(mapping.external_ref) : -1;
    const objects = dataRows.map((r) => ({
      email: eIdx >= 0 ? (r[eIdx] ?? "").trim() : "",
      full_name: nIdx >= 0 ? (r[nIdx] ?? "").trim() || null : null,
      phone: pIdx >= 0 ? (r[pIdx] ?? "").trim() || null : null,
      external_ref: rIdx >= 0 ? (r[rIdx] ?? "").trim() || null : null,
    }));

    let imported = 0, skippedDuplicates = 0, invalid = 0;
    for (let i = 0; i < objects.length; i += 100) {
      const batch = objects.slice(i, i + 100);
      try {
        const r = await importFn({ data: { organizationId, rows: batch } });
        imported += r.imported;
        skippedDuplicates += r.skippedDuplicates;
        invalid += r.invalid;
      } catch (e: any) {
        toast.error(e.message ?? "Batch failed");
      }
    }
    setResult({ imported, skippedDuplicates, invalid });

    // Backfill links after import.
    try { await linkFn({ data: { organizationId } }); } catch { /* noop */ }

    // For the optional invite step, look up the IDs of freshly imported rows by email.
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const emails = Array.from(new Set(objects.map((o) => o.email.toLowerCase()).filter(Boolean)));
      const idAcc: string[] = [];
      for (let i = 0; i < emails.length; i += 200) {
        const chunk = emails.slice(i, i + 200);
        const { data } = await supabase
          .from("org_contacts")
          .select("id,user_id")
          .eq("organization_id", organizationId)
          .in("email", chunk);
        (data ?? []).forEach((r: any) => { if (!r.user_id) idAcc.push(r.id); });
      }
      setImportedIds(idAcc);
    } catch { /* noop */ }

    setStep("done");
  };

  const sendInvites = async () => {
    setInviteBusy(true);
    try {
      const capped = importedIds.slice(0, 200);
      const r = await inviteFn({
        data: {
          organizationId,
          contactIds: capped,
          org_role: "member",
          siteName: document.title || "the organization",
        },
      });
      toast.success(`${r.invited} invite${r.invited === 1 ? "" : "s"} sent • ${r.queued} queued`);
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Invite failed");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Import contacts from your AMS</DialogTitle></DialogHeader>

      {step === "upload" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a CSV export from your association management system.
            Max {IMPORT_MAX_ROWS.toLocaleString()} rows, 2MB. Duplicates by email are skipped.
          </p>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Map your CSV columns. Email is required.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MAPPING_FIELDS.map((f) => (
              <div key={f}>
                <Label className="capitalize">{f.replace("_", " ")}{f === "email" ? " *" : ""}</Label>
                <Select
                  value={mapping[f] || "__none__"}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [f]: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— none —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview (first 10 rows)
            </p>
            <div className="max-h-60 overflow-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    {MAPPING_FIELDS.map((f) => (
                      <th key={f} className="px-2 py-1 text-left font-medium capitalize">{f.replace("_", " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewObjects.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1">{r.email || "—"}</td>
                      <td className="px-2 py-1">{r.full_name || "—"}</td>
                      <td className="px-2 py-1">{r.phone || "—"}</td>
                      <td className="px-2 py-1">{r.external_ref || "—"}</td>
                    </tr>
                  ))}
                  {previewObjects.length === 0 && (
                    <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Map the email column to preview.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dataRows.length.toLocaleString()} total row{dataRows.length === 1 ? "" : "s"} to import.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setStep("upload")}>Back</Button>
            <Button disabled={!mapping.email} onClick={runImport}>Import</Button>
          </DialogFooter>
        </div>
      )}

      {step === "importing" && (
        <p className="p-6 text-center text-sm text-muted-foreground">Importing…</p>
      )}

      {step === "done" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded border border-border p-3">
              <div className="text-lg font-semibold">{result.imported}</div>
              <div className="text-xs text-muted-foreground">Imported</div>
            </div>
            <div className="rounded border border-border p-3">
              <div className="text-lg font-semibold">{result.skippedDuplicates}</div>
              <div className="text-xs text-muted-foreground">Duplicates</div>
            </div>
            <div className="rounded border border-border p-3">
              <div className="text-lg font-semibold">{result.invalid}</div>
              <div className="text-xs text-muted-foreground">Invalid</div>
            </div>
          </div>

          {importedIds.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={invitePrompt}
                  onCheckedChange={(v) => setInvitePrompt(!!v)}
                />
                <span>
                  Send invitation emails to the {Math.min(importedIds.length, 200)} imported contact
                  {importedIds.length === 1 ? "" : "s"} (capped at 200 per run, throttled via the email queue).
                </span>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onDone}>Close</Button>
            {invitePrompt && (
              <Button disabled={inviteBusy || importedIds.length === 0} onClick={sendInvites}>
                {inviteBusy ? "Sending…" : "Send invites"}
              </Button>
            )}
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}
