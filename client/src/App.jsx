import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";

export default function App() {

  const [nav, setNav] = useState("dashboard"); 
  const [clients, setClients] = useState([]); 
  const [activeClientId, setActiveClientId] = useState("");

  const [sessionsByClient, setSessionsByClient] = useState({}); 
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [search, setSearch] = useState("");
  const [newClientName, setNewClientName] = useState("");

  // Add session
  const [transcript, setTranscript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestNote, setLatestNote] = useState(null);

  // Snapshot
  const [snapshot, setSnapshot] = useState(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);

  // Chat
  const [chatDraft, setChatDraft] = useState("");
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [chatByClient, setChatByClient] = useState({}); // { [clientId]: Message[] }
  const chatEndRef = useRef(null);

  // ---------- Derived ----------
  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  const activeSessions = useMemo(() => {
    const list = sessionsByClient[activeClientId] || [];
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [sessionsByClient, activeClientId]);

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return activeSessions;
    const q = search.trim().toLowerCase();
    return activeSessions.filter((s) => {
      const noteText = JSON.stringify(s.note || {}).toLowerCase();
      return (
        String(s.sessionNumber).includes(q) ||
        (s.note?.themes || []).some((t) => String(t).toLowerCase().includes(q)) ||
        noteText.includes(q)
      );
    });
  }, [activeSessions, search]);

  const selectedSession = useMemo(() => {
    const list = sessionsByClient[activeClientId] || [];
    if (!selectedSessionId) return null;
    return list.find((s) => s.id === selectedSessionId) || null;
  }, [sessionsByClient, activeClientId, selectedSessionId]);

  const nextSessionNumber = useMemo(
    () => (sessionsByClient[activeClientId]?.length || 0) + 1,
    [sessionsByClient, activeClientId]
  );

  // Effects 
  useEffect(() => {
    if (!activeClientId) return;
    setSelectedSessionId(null);
    setTranscript("");
    setLatestNote(null);
    regenerateSnapshot();
  }, [activeClientId]);

  useEffect(() => {
    if (nav !== "chat") return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nav, chatByClient, activeClientId]);

  // ---------- Actions ----------
  function createClient() {
    const name = newClientName.trim();
    if (!name) return;

    const exists = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setActiveClientId(exists.id);
      setNewClientName("");
      setNav("dashboard");
      return;
    }

    const id = `c_${Math.random().toString(36).slice(2, 9)}`;
    const client = { id, name, createdAt: new Date().toISOString() };

    setClients((prev) => [client, ...prev]);
    setSessionsByClient((prev) => ({ ...prev, [id]: [] }));
    setChatByClient((prev) => ({
      ...prev,
      [id]: [
        {
          id: `m_${id}_1`,
          role: "assistant",
          content:
            "Hi — I’m your therapist-facing assistant. I can summarize sessions, generate structured notes, and help you review patterns over time. What would you like to explore?",
          at: new Date().toISOString(),
        },
      ],
    }));
    setActiveClientId(id);
    setNewClientName("");
    setNav("dashboard");
  }

  async function generateAndSaveSession() {
    if (!activeClientId || !transcript.trim()) return;

    setIsGenerating(true);
    await sleep(500);

    const note = generateStructuredNoteFromTranscript(transcript, activeClient?.name || "Client");
    const newSession = makeSession(nextSessionNumber, new Date().toISOString(), note);

    setSessionsByClient((prev) => ({
      ...prev,
      [activeClientId]: [...(prev[activeClientId] || []), newSession],
    }));

    setLatestNote(note);
    setTranscript("");
    setNav("sessions");

    await sleep(250);
    await regenerateSnapshot();
    setIsGenerating(false);
  }

  async function regenerateSnapshot() {
    if (!activeClientId) return;
    setIsSnapshotLoading(true);
    await sleep(350);

    const list = sessionsByClient[activeClientId] || [];
    setSnapshot(buildSnapshotFromSessions(list));
    setIsSnapshotLoading(false);
  }

  async function sendChat() {
    const q = chatDraft.trim();
    if (!q || isChatThinking || !activeClientId) return;

    setIsChatThinking(true);

    const userMsg = {
      id: `m_${Math.random().toString(36).slice(2, 9)}`,
      role: "user",
      content: q,
      at: new Date().toISOString(),
    };

    setChatByClient((prev) => ({
      ...prev,
      [activeClientId]: [...(prev[activeClientId] || []), userMsg],
    }));
    setChatDraft("");

    await sleep(450);

    const answer = generateTherapistAnswer(q, sessionsByClient[activeClientId] || [], snapshot);
    const aiMsg = {
      id: `m_${Math.random().toString(36).slice(2, 9)}`,
      role: "assistant",
      content: answer,
      at: new Date().toISOString(),
    };

    setChatByClient((prev) => ({
      ...prev,
      [activeClientId]: [...(prev[activeClientId] || []), aiMsg],
    }));

    setIsChatThinking(false);
  }

  if (clients.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Therapy Assistant</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Create a client to begin documenting sessions and tracking patterns over time.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <UserPlus className="h-4 w-4 text-blue-600" />
                Add your first client
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createClient()}
                  placeholder="e.g., Jordan"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={createClient}
                  disabled={!newClientName.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Create
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Therapist-only demo. No diagnosis or medical advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Sidebar */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            {/* Brand */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight">Therapy Assistant</div>
                  <div className="text-xs text-slate-500">Clean notes • client-aware memory</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sessions, themes…"
                  className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <div className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Therapist-only demo
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Memory per client
                </div>
              </div>
            </Card>

            {/* Clients */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Clients</div>
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                  <Users className="h-3.5 w-3.5" />
                  {clients.length}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {clients
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => {
                    const isActive = c.id === activeClientId;
                    const sessionCount = (sessionsByClient[c.id] || []).length;

                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveClientId(c.id);
                          setNav("dashboard");
                        }}
                        className={[
                          "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition",
                          isActive ? "border border-blue-200 bg-blue-50" : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Created {formatAgo(c.createdAt)} • {sessionCount} sessions
                          </div>
                        </div>

                        <ChevronRight
                          className={[
                            "h-4 w-4 transition",
                            isActive ? "translate-x-0.5 text-blue-600" : "text-slate-400 group-hover:translate-x-0.5",
                          ].join(" ")}
                        />
                      </button>
                    );
                  })}
              </div>

              {/* Add client */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  <div className="text-xs font-medium text-slate-700">Add client</div>
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createClient()}
                    placeholder="e.g., Sam"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    onClick={createClient}
                    disabled={!newClientName.trim()}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    title="Add client"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>

            {/* Navigation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <NavButton icon={Sparkles} label="Dashboard" active={nav === "dashboard"} onClick={() => setNav("dashboard")} />
              <NavButton icon={ClipboardList} label="Sessions" active={nav === "sessions"} onClick={() => setNav("sessions")} />
              <NavButton icon={MessageCircle} label="Chat" active={nav === "chat"} onClick={() => setNav("chat")} />
              <NavButton icon={ShieldCheck} label="Safety" active={nav === "safety"} onClick={() => setNav("safety")} />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="w-full">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  Therapist-only demo • No diagnosis
                </div>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {navLabel(nav)}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Active client: <span className="font-semibold text-slate-900">{activeClient?.name || "—"}</span>
                  <span className="mx-2 text-slate-300">•</span>
                  {activeSessions.length} sessions on record
                </p>
              </div>

              {/* Mobile client selector */}
              <div className="lg:hidden">
                <ClientSelect
                  clients={clients}
                  activeClientId={activeClientId}
                  onChange={(id) => setActiveClientId(id)}
                />
              </div>
            </div>
          </div>

          {nav === "dashboard" && (
            <FadeIn>
              <DashboardView
                client={activeClient}
                sessions={activeSessions}
                snapshot={snapshot}
                isSnapshotLoading={isSnapshotLoading}
                onRefreshSnapshot={regenerateSnapshot}
                transcript={transcript}
                setTranscript={setTranscript}
                isGenerating={isGenerating}
                onGenerate={generateAndSaveSession}
                latestNote={latestNote}
                onGoSessions={() => setNav("sessions")}
                onGoChat={() => setNav("chat")}
              />
            </FadeIn>
          )}

          {nav === "sessions" && (
            <FadeIn>
              <SessionsView
                sessions={filteredSessions}
                activeClient={activeClient}
                selectedSessionId={selectedSessionId}
                onSelectSession={(id) => setSelectedSessionId(id)}
                selectedSession={selectedSession}
                search={search}
                setSearch={setSearch}
                onAddSession={() => setNav("dashboard")}
              />
            </FadeIn>
          )}

          {nav === "chat" && (
            <FadeIn>
              <ChatView
                client={activeClient}
                messages={chatByClient[activeClientId] || []}
                draft={chatDraft}
                setDraft={setChatDraft}
                isThinking={isChatThinking}
                onSend={sendChat}
                snapshot={snapshot}
                endRef={chatEndRef}
              />
            </FadeIn>
          )}

          {nav === "safety" && (
            <FadeIn>
              <SafetyView />
            </FadeIn>
          )}
        </main>
      </div>
    </div>
  );
}

function DashboardView({
  client,
  sessions,
  snapshot,
  isSnapshotLoading,
  onRefreshSnapshot,
  transcript,
  setTranscript,
  isGenerating,
  onGenerate,
  latestNote,
  onGoSessions,
  onGoChat,
}) {
  const hasSessions = sessions.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Snapshot */}
      <div className="lg:col-span-7">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Client Snapshot</div>
                  <div className="text-xs text-slate-500">
                    Built from saved session notes for <span className="font-semibold text-slate-900">{client?.name}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill icon={CalendarDays} label={`${sessions.length} sessions`} />
                <Pill icon={ShieldCheck} label="No diagnosis • No medical advice" />
              </div>
            </div>

            <button
              onClick={onRefreshSnapshot}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <RefreshCw className={["h-4 w-4", isSnapshotLoading ? "animate-spin" : ""].join(" ")} />
              Refresh
            </button>
          </div>

          <div className="mt-5">
            {isSnapshotLoading ? (
              <SkeletonSnapshot />
            ) : !hasSessions ? (
              <EmptyState
                icon={FileText}
                title="No sessions yet"
                description="Add a session to generate a snapshot and see trends over time."
              />
            ) : (
              <SnapshotCard snapshot={snapshot} />
            )}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="lg:col-span-5">
        <div className="grid gap-6">
          {/* Add session */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
                  <Wand2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Add Session</div>
                  <div className="text-xs text-slate-500">Paste a transcript to generate a structured note</div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={onGoSessions}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  View Sessions
                </button>
                <button
                  onClick={onGoChat}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  Open Chat
                </button>
              </div>
            </div>

            <div className="mt-4">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={7}
                placeholder="Paste transcript here…"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Tip: include changes since last session, coping skills, and follow-ups.
                </div>

                <button
                  onClick={onGenerate}
                  disabled={!transcript.trim() || isGenerating}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate + Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </Card>

          {/* Latest note preview */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Latest Structured Note</div>
                  <div className="text-xs text-slate-500">Formatted and easy to scan</div>
                </div>
              </div>

              {latestNote ? (
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                  Updated
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                  <FileText className="h-3.5 w-3.5" />
                  None yet
                </div>
              )}
            </div>

            <div className="mt-4">
              {!latestNote ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No note generated yet"
                  description="Generate a session note to preview it here."
                />
              ) : (
                <NoteCard note={latestNote} compact />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SessionsView({
  sessions,
  activeClient,
  selectedSessionId,
  onSelectSession,
  selectedSession,
  search,
  setSearch,
  onAddSession,
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* List */}
      <div className="lg:col-span-5">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Sessions</div>
              <div className="text-xs text-slate-500">
                Browse notes for <span className="font-semibold text-slate-900">{activeClient?.name}</span>
              </div>
            </div>

            <button
              onClick={onAddSession}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add session
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by themes, content, session #…"
              className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No matching sessions"
                description="Try another search term or add a new session."
              />
            ) : (
              sessions.map((s) => (
                <SessionListItem
                  key={s.id}
                  session={s}
                  isActive={s.id === selectedSessionId}
                  onClick={() => onSelectSession(s.id)}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Detail */}
      <div className="lg:col-span-7">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Session Detail</div>
              <div className="text-xs text-slate-500">
                Clean structured layout • consistent sections • readable at a glance
              </div>
            </div>
          </div>

          <div className="mt-5">
            {!selectedSession ? (
              <EmptyState
                icon={ChevronDown}
                title="Select a session"
                description="Choose a session from the list to view its structured note."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold">Session #{selectedSession.sessionNumber}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600">{formatDate(selectedSession.createdAt)}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <Users className="h-4 w-4 text-blue-600" />
                    {activeClient?.name}
                  </div>
                </div>

                <NoteCard note={selectedSession.note} />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ChatView({ client, messages, draft, setDraft, isThinking, onSend, snapshot, endRef }) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: context */}
      <div className="lg:col-span-4">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
              <MessageCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Therapist Chat</div>
              <div className="text-xs text-slate-500">Ask about patterns and follow-ups</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700">Active client</div>
            <div className="mt-1 text-lg font-semibold">{client?.name || "—"}</div>
            <div className="mt-2 text-xs text-slate-600">
              Responses should be grounded in saved session notes + snapshot overview.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill icon={ShieldCheck} label="No diagnosis" />
              <Pill icon={ClipboardList} label="Session notes" />
              <Pill icon={Activity} label={`Snapshot: ${snapshot?.confidence || "—"}`} />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-700">Suggested prompts</div>
            <div className="mt-2 space-y-2">
              {[
                "What themes keep recurring across sessions?",
                "What follow-ups should I prioritize next session?",
                "Summarize progress in 3 bullet points.",
                "Any coping strategies that seem to help most?",
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft(p)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Right: chat */}
      <Card className="lg:col-span-8 flex h-[70vh] flex-col p-0">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Conversation</div>
            <div className="text-xs text-slate-500">Clean message bubbles and calm spacing</div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}

          {isThinking && (
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-slate-100" />
              <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  Thinking…
                </span>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder="Ask a question about the client’s sessions…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={onSend}
              disabled={!draft.trim() || isThinking}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            Tip: ask for themes, changes since last session, follow-ups, and next-session focus.
          </div>
        </div>
      </Card>
    </div>
  );
}

function SafetyView() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Safety & Boundaries</div>
              <div className="text-xs text-slate-500">Responsible, therapist-facing behavior</div>
            </div>
          </div>

          <div className="mt-5 space-y-4 text-sm text-slate-700">
            <Callout
              title="No diagnosis"
              icon={ShieldCheck}
              body="This demo does not diagnose or provide medical advice. It summarizes and organizes session information for therapist workflow support."
            />
            <Callout
              title="Grounded in session notes"
              icon={ClipboardList}
              body="Chat responses should reflect saved session notes and snapshots. If information isn’t present, the assistant should say so."
            />
          </div>
        </Card>
      </div>


    </div>
  );
}


function Card({ className = "", children }) {
  return <div className={["rounded-2xl border border-slate-200 bg-white shadow-sm", className].join(" ")}>{children}</div>;
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
        active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className={["grid h-9 w-9 place-items-center rounded-xl transition", active ? "bg-white" : "bg-slate-100"].join(" ")}>
        <Icon className={["h-4.5 w-4.5", active ? "text-blue-600" : "text-slate-600"].join(" ")} />
      </div>
      <div className="flex-1">{label}</div>
      <ChevronRight className={["h-4 w-4 transition", active ? "text-blue-600" : "text-slate-400"].join(" ")} />
    </button>
  );
}

function Pill({ icon: Icon, label }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
      <Icon className="h-3.5 w-3.5 text-blue-600" />
      {label}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </div>
  );
}

function SnapshotCard({ snapshot }) {
  if (!snapshot) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-700">Primary themes</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Confidence: <span className="font-semibold text-slate-900">{snapshot.confidence || "—"}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(snapshot.primary_themes || []).length ? (
            snapshot.primary_themes.map((t, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                {t}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MiniSection title="Progress since first" items={snapshot.progress_since_first} />
        <MiniSection title="Current challenges" items={snapshot.current_challenges} />
        <MiniSection title="Coping strategies tried" items={snapshot.coping_strategies_tried} />
        <MiniSection title="Risk flags" items={snapshot.risk_flags} empty="None noted" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold text-slate-700">Suggested next session focus</div>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {(snapshot.suggested_next_focus || []).length ? (
            snapshot.suggested_next_focus.map((x, i) => (
              <li key={i} className="flex gap-2">
                <ArrowRight className="mt-0.5 h-4 w-4 text-blue-600" />
                <span>{x}</span>
              </li>
            ))
          ) : (
            <li className="text-slate-500">—</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function MiniSection({ title, items, empty = "—" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-blue-600" />
        <div className="text-xs font-semibold text-slate-700">{title}</div>
      </div>
      <ul className="mt-2 space-y-2 text-sm text-slate-700">
        {Array.isArray(items) && items.length ? items.map((x, i) => <li key={i}>{x}</li>) : <li className="text-slate-500">{empty}</li>}
      </ul>
    </div>
  );
}

function NoteCard({ note, compact = false }) {
  if (!note) return null;

  const wrapper = compact ? "space-y-3" : "space-y-4";
  const grid = compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2";
  const text = compact ? "text-xs" : "text-sm";

  return (
    <div className={wrapper}>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold text-slate-700">Themes</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(note.themes || []).length ? (
            note.themes.map((t, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                {t}
              </span>
            ))
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </div>
      </div>

      <div className={grid}>
        <NoteSection title="Summary" items={note.summary} textSize={text} />
        <NoteSection title="Emotions observed" items={note.emotions_observed} textSize={text} />
        <NoteSection title="Coping strategies" items={note.coping_strategies} textSize={text} />
        <NoteSection title="Risk flags" items={note.risk_flags} empty="None noted" textSize={text} />
      </div>

      <div className={grid}>
        <NoteSection title="Therapist follow-ups" items={note.therapist_followups} textSize={text} />
        <NoteSection title="Next session focus" items={note.next_session_focus} textSize={text} />
      </div>

      {Array.isArray(note.quotes) && note.quotes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-700">Key quotes</div>
          <ul className={["mt-2 space-y-2 text-slate-700", text].join(" ")}>
            {note.quotes.slice(0, 3).map((q, i) => (
              <li key={i}>
                <span className="text-slate-500">“</span>
                {q}
                <span className="text-slate-500">”</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NoteSection({ title, items, empty = "—", textSize = "text-sm" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-700">{title}</div>
      <ul className={["mt-2 space-y-2 text-slate-700", textSize].join(" ")}>
        {Array.isArray(items) && items.length ? items.map((x, i) => <li key={i}>{x}</li>) : <li className="text-slate-500">{empty}</li>}
      </ul>
    </div>
  );
}

function SessionListItem({ session, isActive, onClick }) {
  const themes = (session.note?.themes || []).slice(0, 3);
  return (
    <button
      onClick={onClick}
      className={[
        "group w-full rounded-xl border px-4 py-3 text-left transition",
        isActive ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Session #{session.sessionNumber}</div>
          <div className="mt-0.5 text-xs text-slate-500">{formatDate(session.createdAt)}</div>
        </div>
        <ChevronRight className={["h-4 w-4 transition", isActive ? "translate-x-0.5 text-blue-600" : "text-slate-400 group-hover:translate-x-0.5"].join(" ")} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {themes.length ? (
          themes.map((t, i) => (
            <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
              {t}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-slate-500">No themes tagged</span>
        )}
      </div>
    </button>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={["flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div
          className={[
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-blue-600 text-white"
              : "border border-slate-200 bg-white text-slate-800",
          ].join(" ")}
        >
          {msg.content}
        </div>
        <div className={["mt-1 text-[11px] text-slate-500", isUser ? "text-right" : "text-left"].join(" ")}>
          {formatTime(msg.at)}
        </div>
      </div>
    </div>
  );
}

function ClientSelect({ clients, activeClientId, onChange }) {
  const active = clients.find((c) => c.id === activeClientId);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center gap-2 px-2 py-1">
        <Users className="h-4 w-4 text-blue-600" />
        <div className="text-xs text-slate-600">Client</div>
      </div>
      <div className="relative">
        <select
          value={activeClientId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="px-3 pt-2 text-xs text-slate-500">Viewing: {active?.name || "—"}</div>
    </div>
  );
}

function Callout({ title, body, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <div className="text-sm font-semibold text-slate-900">{title}</div>
      </div>
      <div className="mt-2 text-sm text-slate-700">{body}</div>
    </div>
  );
}

function SkeletonSnapshot() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      </div>
      <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    </div>
  );
}

function FadeIn({ children }) {
  return <div className="animate-[fadeIn_180ms_ease-out]">{children}</div>;
}


function navLabel(nav) {
  if (nav === "dashboard") return "Dashboard";
  if (nav === "sessions") return "Sessions";
  if (nav === "chat") return "Chat";
  if (nav === "safety") return "Safety";
  return "Dashboard";
}

function makeSession(sessionNumber, createdAt, note) {
  return {
    id: `s_${sessionNumber}_${Math.random().toString(36).slice(2, 7)}`,
    sessionNumber,
    createdAt,
    note,
  };
}

function formatAgo(iso) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const days = Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}


function generateStructuredNoteFromTranscript(transcript, clientName) {
  const t = transcript.toLowerCase();

  const themes = uniq([
    t.includes("sleep") || t.includes("insomnia") ? "Sleep" : null,
    t.includes("work") || t.includes("meeting") ? "Work stress" : null,
    t.includes("anx") || t.includes("panic") ? "Anxiety" : null,
    t.includes("avoid") ? "Avoidance" : null,
    t.includes("relationship") || t.includes("friend") ? "Relationships" : null,
    t.includes("confidence") || t.includes("self") ? "Self-esteem" : null,
  ]).filter(Boolean);

  const emotions = uniq([
    t.includes("anx") ? "Anxious" : null,
    t.includes("sad") ? "Sad" : null,
    t.includes("tired") ? "Fatigued" : null,
    t.includes("guilt") ? "Guilty" : null,
    t.includes("stress") ? "Stressed" : null,
  ]).filter(Boolean);

  const coping = uniq([
    t.includes("journal") ? "Journaling" : null,
    t.includes("breath") ? "Breathing exercises" : null,
    t.includes("walk") || t.includes("exercise") ? "Movement / walking" : null,
    t.includes("routine") ? "Sleep routine" : null,
    t.includes("ground") ? "Grounding technique" : null,
  ]).filter(Boolean);

  const summary = [
    `${clientName} discussed current stressors and emotional state.`,
    themes.includes("Work stress")
      ? "Work demands and meetings were described as a primary trigger."
      : "Triggers were explored with emphasis on patterns across the week.",
    themes.includes("Sleep")
      ? "Sleep disruption and nighttime rumination were noted."
      : "Daily functioning and energy levels were reviewed.",
    coping.length
      ? `Coping strategies were reviewed (${coping.slice(0, 2).join(", ")}).`
      : "Coping strategies were discussed and refined.",
  ];

  const followups = [
    themes.includes("Sleep") ? "Review sleep routine and identify barriers to consistency." : "Clarify top triggers and early warning signs.",
    themes.includes("Avoidance") ? "Plan one small exposure task for an avoided situation." : "Identify one values-aligned action to practice this week.",
    "Track 1–2 moments of heightened emotion and what helped (brief notes).",
  ];

  const nextFocus = [
    themes.includes("Anxiety") ? "Strengthen coping plan for anxiety spikes (pre/during/post)." : "Reinforce skills practice between sessions.",
    themes.includes("Work stress") ? "Prepare for meetings: self-talk + grounding + realistic expectations." : "Prioritize routines that support stability.",
  ];

  const quotes = pickQuotesFromTranscript(transcript);

  return {
    summary: trimList(summary),
    themes: themes.length ? themes : ["Stress management", "General wellbeing"],
    emotions_observed: emotions.length ? emotions : ["Tense", "Overwhelmed"],
    coping_strategies: coping.length ? coping : ["Reflection", "Basic grounding"],
    risk_flags: [],
    therapist_followups: trimList(followups),
    next_session_focus: trimList(nextFocus),
    quotes,
  };
}

function buildSnapshotFromSessions(sessions) {
  if (!sessions || sessions.length === 0) return null;

  const allThemes = sessions.flatMap((s) => s.note?.themes || []);
  const themeCounts = countBy(allThemes);
  const primaryThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);

  const coping = uniq(sessions.flatMap((s) => s.note?.coping_strategies || [])).slice(0, 8);

  const sorted = sessions.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const progress = [
    "Client shows growing awareness of triggers and patterns.",
    coping.length ? `Skill use noted: ${coping.slice(0, 2).join(", ")}.` : "Skill practice is emerging; reinforce consistency.",
  ];

  const challenges = [
    primaryThemes.includes("Sleep") ? "Sleep remains inconsistent and impacted by rumination." : "Energy and stress management remain key areas.",
    primaryThemes.includes("Work stress") ? "Work-related triggers continue to drive anxiety." : "Triggers vary; continue mapping antecedents.",
    primaryThemes.includes("Avoidance") ? "Avoidance behaviors may be maintaining distress." : "Focus on small, values-aligned steps.",
  ].slice(0, 3);

  const riskFlags = uniq(sessions.flatMap((s) => s.note?.risk_flags || []));

  const nextFocus = [
    primaryThemes.includes("Sleep") ? "Create a simple, repeatable sleep wind-down plan." : "Choose one routine to stabilize the week.",
    primaryThemes.includes("Work stress") ? "Build a pre-meeting grounding + self-talk script." : "Plan one coping practice per day.",
    primaryThemes.includes("Avoidance") ? "Define one small exposure task and debrief next session." : "Strengthen follow-through and reinforcement.",
  ].slice(0, 4);

  const confidence = sessions.length >= 3 ? "high" : sessions.length === 2 ? "medium" : "low";

  return {
    primary_themes: primaryThemes.length ? primaryThemes : ["General wellbeing"],
    progress_since_first: [
      `From Session #${first?.sessionNumber ?? 1} → #${last?.sessionNumber ?? sessions.length}: improved articulation of stressors.`,
      ...progress.slice(0, 3),
    ],
    current_challenges: challenges,
    coping_strategies_tried: coping.length ? coping : ["Reflection", "Grounding"],
    risk_flags: riskFlags.length ? riskFlags : [],
    suggested_next_focus: nextFocus,
    confidence,
  };
}

function generateTherapistAnswer(question, sessions, snapshot) {
  const q = question.toLowerCase();
  const sessionCount = sessions.length;

  const pick = (arr, fallback) => (arr && arr.length ? arr : fallback);

  if (sessionCount === 0) {
    return "Not enough information in saved sessions yet. Add at least one session note to enable pattern-based answers.";
  }

  if (q.includes("themes") || q.includes("recurring")) {
    const themes = pick(snapshot?.primary_themes, sessions.flatMap((s) => s.note?.themes || []));
    const uniqThemes = uniq(themes).slice(0, 6);
    return ["Recurring themes across sessions:", ...uniqThemes.map((t) => `• ${t}`)].join("\n");
  }

  if (q.includes("follow") || q.includes("prioritize") || q.includes("next session")) {
    const next = pick(snapshot?.suggested_next_focus, ["Clarify top triggers", "Reinforce daily coping practice"]);
    return ["Suggested follow-ups for next session:", ...next.slice(0, 4).map((x) => `• ${x}`)].join("\n");
  }

  return [
    "Based on saved session notes, here’s a grounded response:",
    "• Clarify the trigger context (when/where/what thought).",
    "• Identify what maintained the pattern (avoidance, rumination, reassurance-seeking).",
    "• Choose one small between-session practice with an easy success condition.",
  ].join("\n");
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function countBy(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] || 0) + 1;
  return m;
}

function pickQuotesFromTranscript(transcript) {
  const lines = transcript
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = lines
    .filter((l) => l.length >= 18 && l.length <= 90)
    .filter((l) => /i feel|i'm|i am|my|can't|won't|always|never|anx|sleep|work|guilt|avoid/i.test(l));

  return candidates.slice(0, 2).map((l) => l.replace(/^client:\s*/i, "").replace(/^therapist:\s*/i, ""));
}

function trimList(list) {
  return list.filter(Boolean).slice(0, 7);
}
