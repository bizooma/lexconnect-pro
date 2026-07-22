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
  type ContactRow,
  type MemberEngagement,
} from "@/lib/org-contacts.functions";

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
          <div className="mt-4 space-y-6 text-sm">
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
        )}
      </SheetContent>
    </Sheet>
  );
}
