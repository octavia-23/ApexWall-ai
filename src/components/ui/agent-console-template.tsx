"use client"

import * as React from "react"

/**
 * Agent Console Template
 *
 * A complete, working front end for an agent that plans its work as a small
 * state machine. You ask for something; the agent writes a machine for it;
 * nothing runs until you approve; then it runs state by state while you watch
 * the transcript, the live state graph and the store it writes to.
 *
 * It is a full app, not a mock: sessions persist to localStorage, hold as
 * many asks as you like, and can be searched, renamed, exported as Markdown
 * and deleted. Machines can be read, edited, downloaded and imported as
 * `.cairn` source. Plug in a `planner` and an `executor` and it drives a real
 * agent; leave them out and a built-in simulation runs the scripted machines.
 *
 * Self-contained: React is the only import. No CSS file, images, fonts or
 * icon package. The crew and every icon are inline SVG.
 */

// #region logic
export type StoreValue = string | number | boolean
export type StoreKind = "agent" | "observed" | "set"

export interface MachineStoreKey {
  key: string
  /** agent: the agent writes it. observed: read off the world, like a test run. set: given up front. */
  kind?: StoreKind
  /** Starting value. Only `set` keys start filled. */
  value?: StoreValue
}

export interface MachineWhen {
  /** Store key to test */
  key: string
  /** State to go to when the key is truthy */
  to: string
}

export interface MachineState {
  /** PascalCase name, unique within the machine */
  id: string
  /** The instruction the agent works from in this state */
  prompt?: string
  /** Store keys this state fills */
  writes?: string[]
  /** Conditional exits, tried in order */
  when?: MachineWhen[]
  /** Where to go when no `when` matches */
  next?: string
  /** A final state ends the run */
  final?: boolean
  /** For final states. Guessed from the name when left out: Abandoned, Failed and Cancelled are failures. */
  outcome?: "success" | "failure"
  /** Simulation only: transcript lines streamed while the state runs. A list of lists gives one list per visit. */
  steps?: string[] | string[][]
  /** Simulation only: what the state writes. A list gives one value per visit. */
  values?: Record<string, StoreValue | StoreValue[]>
}

export interface Machine {
  name: string
  /** The first state is the initial one */
  states: MachineState[]
  store?: MachineStoreKey[]
  /** Visits a state gets before the run is sent to the failure state (default 3) */
  maxVisits?: number
  /** Extra warnings shown next to the authored machine */
  warnings?: string[]
}

export type RunPhase = "deciding" | "authored" | "awaiting" | "running" | "stopped" | "done" | "abandoned" | "declined"

type EventBody =
  | { kind: "note"; text: string }
  | { kind: "authored"; machine: string; warnings: string[] }
  | { kind: "edited"; machine: string; warnings: string[] }
  | { kind: "waiting"; machine: string }
  | { kind: "approved"; machine: string; auto: boolean }
  | { kind: "executing"; machine: string; states: number }
  | { kind: "declined"; machine: string }
  | { kind: "enter"; state: string; visit: number }
  | { kind: "step"; state: string; text: string }
  | { kind: "write"; state: string; key: string; value: StoreValue }
  | { kind: "input"; key: string; value: StoreValue }
  | { kind: "leave"; state: string; to: string; via: string }
  | { kind: "finish"; state: string; outcome: "done" | "abandoned" }
  | { kind: "error"; text: string }
  | { kind: "stopped"; state: string | null }
  | { kind: "resumed"; state: string | null }

/** One line of a run's history. `t` is the wall-clock time it happened, when known. */
export type RunEvent = EventBody & { t?: number }

export interface Run {
  id: string
  /** The session this run (one ask) belongs to */
  session: string
  prompt: string
  machine: Machine
  phase: RunPhase
  /** Phase a stopped run goes back to */
  resume: RunPhase | null
  /** Waiting on the planner to write its machine */
  held: boolean
  events: RunEvent[]
  current: string | null
  visits: Record<string, number>
  store: Record<string, StoreValue>
  /** Simulation only: position inside the current visit (its steps, then its writes, then the exit) */
  cursor: number
  transitions: number
  edge: { from: string; to: string; via: string } | null
}

export interface Session {
  id: string
  /** Empty means "use the first prompt" */
  title: string
  created: number
}

/** What a planner or a state sees of the earlier asks in the same session. */
export interface TurnSummary {
  prompt: string
  machine: string
  phase: RunPhase
  store: Record<string, StoreValue>
}

export interface PlannerContext {
  signal: AbortSignal
  previous: TurnSummary[]
}

/** Writes the machine for a request. May be async: call your model here. */
export type Planner = (prompt: string, ctx: PlannerContext) => Machine | Promise<Machine>

export interface StateContext {
  machine: Machine
  state: MachineState
  /** 1 on the first visit, 2 on the second... */
  visit: number
  /** The request this run is answering */
  prompt: string
  /** The store as this state found it, kept current as you `write` */
  store: Readonly<Record<string, StoreValue>>
  previous: TurnSummary[]
  /** Aborted when the run is stopped or deleted */
  signal: AbortSignal
  /** Stream a line into the transcript */
  log: (line: string) => void
  /** Set a store value. Exits are chosen from the store once the state returns. */
  write: (key: string, value: StoreValue) => void
}

/** Does the work of one state. Resolve to move on, throw to stop the run with an error. */
export type StateExecutor = (ctx: StateContext) => void | Promise<void>

export const EMPTY_MACHINE: Machine = { name: "", states: [] }

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pascal(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""
}

export function singular(word: string): string {
  if (word.length > 4 && /ies$/i.test(word)) return word.slice(0, -3) + "y"
  if (word.length > 3 && /[^s]s$/i.test(word)) return word.slice(0, -1)
  return word
}

const STOP = new Set(
  (
    "a an the and or but of for to in on at by with from into onto over under this that these those it its is are be " +
    "been was were will would should could can may might must i you we they he she me my our your their them us so " +
    "then than as if also just like want need please make sure using use via about after before while when where which " +
    "who what why how all any each every some more most other such only own same too very one two three four five six " +
    "seven eight nine ten first there here do does did done not no yes new way ways thing things kind kinds lot lots " +
    "time times week weeks day days"
  ).split(" "),
)

const FILLER = new Set(
  (
    "allows allow lets let renames rename prove proves passes pass recommend recommends run runs take taken takes keep " +
    "keeps get gets show shows include includes adding support supports represented recording record modifying " +
    "deleting creating viewing against called named"
  ).split(" "),
)

const VERBS = new Map<string, string>()
for (const [verb, words] of [
  ["Build", "build create make write implement scaffold add generate"],
  ["Fix", "fix debug repair patch resolve"],
  ["Research", "research investigate compare explore evaluate find"],
  ["Refactor", "refactor migrate upgrade port rewrite"],
  ["Summarize", "summarise summarize digest condense"],
  ["Draft", "draft plan outline propose"],
  ["Review", "review audit verify check"],
  ["Ship", "deploy ship release publish"],
]) {
  for (const w of words.split(" ")) VERBS.set(w, verb)
}

const SUBJECTS = new Set(
  (
    "cli tool app site website page api script bot dashboard report brief checklist doc readme test suite server " +
    "service database schema migration component library plugin extension game pipeline workflow summary memo " +
    "proposal spec email newsletter deck form widget endpoint job query"
  ).split(" "),
)

/** The three words a machine is named from: a verb, then what it acts on. */
export function nameParts(prompt: string): { verb: string; head: string; tail: string } {
  const tokens = prompt.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []
  let verb = "Run"
  let verbAt = -1
  for (let i = 0; i < tokens.length; i++) {
    const v = VERBS.get(tokens[i].toLowerCase())
    if (v) {
      verb = v
      verbAt = i
      break
    }
  }
  const words = tokens
    .map((t, i) => ({ t, i, low: t.toLowerCase(), acr: /[A-Z]{2,}/.test(t) }))
    .filter((w) => w.i !== verbAt && !STOP.has(w.low) && !FILLER.has(w.low) && (w.t.length > 2 || w.acr))
  const tail = words.find((w) => SUBJECTS.has(singular(w.low))) ?? words[words.length - 1]
  const rest = words.filter((w) => w !== tail)
  const head = (tail && rest.find((w) => w.i === tail.i - 1)) || rest.find((w) => w.acr) || rest[0]
  return { verb, head: head ? singular(head.t) : "", tail: tail ? singular(tail.t) : "Task" }
}

export function machineName(prompt: string): string {
  const p = nameParts(prompt)
  return p.verb + pascal(p.head) + pascal(p.tail)
}

/** The built-in planner: a seven-state machine named after the request, with scripted steps. */
export function planMachine(prompt: string): Machine {
  const { verb, head, tail } = nameParts(prompt)
  const T = pascal(tail) || "Task"
  const name = verb + pascal(head) + T
  const what = (head ? head.toLowerCase() + " " : "") + tail.toLowerCase()
  const file = (head ? head.toLowerCase() + "-" : "") + tail.toLowerCase()
  const brief = prompt.trim().replace(/\s+/g, " ")
  const quoted = "“" + (brief.length > 110 ? brief.slice(0, 108).trimEnd() + "…" : brief) + "”"
  const checks: boolean[] = hashString(brief) % 3 === 0 ? [true] : [false, true]

  if (verb === "Research" || verb === "Summarize" || verb === "Draft" || verb === "Review") {
    const draft = "Draft" + T
    const critique = "Critique" + T
    const revise = "Revise" + T
    const deliver = "Deliver" + T
    return {
      name,
      store: [
        { key: "sources" },
        { key: "draft" },
        { key: "revisionNotes" },
        { key: "meetsBrief", kind: "observed" },
        { key: "audience", kind: "set", value: "whoever asked" },
      ],
      states: [
        {
          id: "GatherSources",
          prompt:
            "Collect what the workspace already knows about " +
            quoted +
            " Record the useful material in sources. Quote it, do not paraphrase it.",
          writes: ["sources"],
          next: draft,
          steps: ["search the workspace for “" + what + "”", "read 9 documents, kept 5", "note two gaps worth flagging"],
          values: { sources: "5 documents: two runbooks, a postmortem, a dashboard export and a thread." },
        },
        {
          id: draft,
          prompt: "Write the " + what + " from sources for the audience. Lead with the answer and keep it to one page.",
          writes: ["draft"],
          next: critique,
          steps: ["outline: answer, evidence, next steps", "write " + file + ".md (480 words)"],
          values: { draft: file + ".md, 480 words in three sections." },
        },
        {
          id: critique,
          prompt:
            "Check the draft against the original request. Set meetsBrief only when every claim traces back to sources and the request is answered in full.",
          writes: ["meetsBrief"],
          when: [{ key: "meetsBrief", to: deliver }],
          next: revise,
          steps: [
            ["trace every claim back to sources", "two claims have no source", "brief not met yet"],
            ["trace every claim back to sources", "every claim has a source", "brief met"],
          ],
          values: { meetsBrief: checks },
        },
        {
          id: revise,
          prompt: "Fix what the critique found and record what changed in revisionNotes. Do not add new material.",
          writes: ["revisionNotes"],
          next: critique,
          steps: ["source one claim, cut the other", "tighten the opening paragraph"],
          values: { revisionNotes: "Sourced the latency claim, cut the unsourced cost estimate." },
        },
        {
          id: deliver,
          prompt: "Hand the " + what + " over where it was asked for, with the source list attached.",
          next: "Done",
          steps: ["attach the source list", "post " + file + ".md to the session"],
        },
        { id: "Done", final: true },
        { id: "Abandoned", final: true, outcome: "failure" },
      ],
    }
  }

  const act = (verb === "Fix" ? "Patch" : verb === "Refactor" ? "Restructure" : verb === "Ship" ? "Prepare" : "Implement") + T
  const verify = "Verify" + T
  const repair = "Repair" + T
  const show = (verb === "Ship" ? "Release" : "Demonstrate") + T
  return {
    name,
    store: [
      { key: "implementationPlan" },
      { key: "repairTarget" },
      { key: "checksPassed", kind: "observed" },
      { key: "scope", kind: "set", value: "this workspace only" },
    ],
    states: [
      {
        id: "InspectWorkspace",
        prompt:
          "Inspect the workspace for anything related to " +
          quoted +
          " Record a concrete plan in implementationPlan: what exists, what changes, and how it will be checked. Do not edit files.",
        writes: ["implementationPlan"],
        next: act,
        steps: ["$ ls -a", ".git  README.md  package.json  src", "read README.md", "nothing named " + what + " yet"],
        values: { implementationPlan: "Add src/" + file + ".ts with its own tests, check with npm test, and touch nothing outside scope." },
      },
      {
        id: act,
        prompt: "Carry out implementationPlan. Keep every change inside scope and leave the checks to verification.",
        next: verify,
        steps: ["write src/" + file + ".ts", "write src/" + file + ".test.ts", "wire it into src/index.ts"],
      },
      {
        id: verify,
        prompt: "Run the checks named in implementationPlan. Set checksPassed only when every one of them passes.",
        writes: ["checksPassed"],
        when: [{ key: "checksPassed", to: show }],
        next: repair,
        steps: [
          ["$ npm test", "4 passed, 1 failed: empty input", "1 of 5 checks failed"],
          ["$ npm test", "5 passed", "5 of 5 checks passed"],
        ],
        values: { checksPassed: checks },
      },
      {
        id: repair,
        prompt: "Read the failing check, record the smallest fix in repairTarget, apply it, and hand back to verification.",
        writes: ["repairTarget"],
        next: verify,
        steps: ["read the failing check", "patch: handle empty input before parsing"],
        values: { repairTarget: "src/" + file + ".ts let empty input reach the parser." },
      },
      {
        id: show,
        prompt: "Show the result working end to end, then write a short note on how to use it.",
        next: "Done",
        steps: ["$ npx " + file + " --help", "write NOTES.md: what changed and how to use it"],
      },
      { id: "Done", final: true },
      { id: "Abandoned", final: true, outcome: "failure" },
    ],
  }
}

export const TODO_PROMPT =
  "I would like you to create a CLI tool that allows for the recording of TODOs and tasks. The tool must support creating, deleting, modifying, and viewing TODOs, with “done” and “not done” statuses represented by a checkbox (checked or unchecked). Finally, use the tool to add tasks and run a simulation by adding the kind of activities a project manager would include."

export const TODO_MACHINE: Machine = {
  name: "BuildTodoCli",
  maxVisits: 3,
  store: [
    { key: "implementationPlan" },
    { key: "repairTarget" },
    { key: "verificationPassed", kind: "observed" },
    { key: "simulationDataDir", kind: "set", value: ".todo-simulation-data" },
  ],
  states: [
    {
      id: "InspectWorkspace",
      prompt:
        "Inspect the project workspace and the existing implementationPlan context. Record a concrete implementation plan in implementationPlan for a command-line TODO tool, including the project language, executable entry point, storage format, and how it will use .todo-simulation-data. Do not edit files.",
      writes: ["implementationPlan"],
      next: "ImplementCli",
      steps: ["$ ls -a", ".git  README.md  package.json", "read package.json: node 20, no dependencies", "no TODO code yet, and .todo-simulation-data is free"],
      values: {
        implementationPlan:
          "Node 20 script at bin/todo.js. One JSON file per list inside simulationDataDir. Commands: add, edit, rm, done, undo, ls.",
      },
    },
    {
      id: "ImplementCli",
      prompt:
        "Build the CLI described in implementationPlan. Support add, edit, rm, done, undo and ls, and render every TODO with a checkbox: [ ] for not done, [x] for done. Keep all data inside simulationDataDir.",
      next: "VerifyCli",
      steps: [
        "write bin/todo.js (142 lines)",
        "write lib/store.js: atomic writes into .todo-simulation-data",
        "$ chmod +x bin/todo.js",
        "add a bin entry for todo to package.json",
      ],
    },
    {
      id: "VerifyCli",
      prompt:
        "Run the CLI end to end against a scratch list: add, edit, mark done, undo, delete and list. Set verificationPassed only if every command exits 0 and the checkboxes render as specified.",
      writes: ["verificationPassed"],
      when: [{ key: "verificationPassed", to: "RunSimulation" }],
      next: "RepairCli",
      steps: [
        ["$ todo add “Smoke test”", "[ ] 1  Smoke test", "$ todo done 1", "TypeError: cannot read properties of undefined (reading “done”)", "1 of 6 checks failed"],
        ["$ todo add “Smoke test”", "[ ] 1  Smoke test", "$ todo done 1", "[x] 1  Smoke test", "$ todo undo 1 && todo rm 1", "6 of 6 checks passed"],
      ],
      values: { verificationPassed: [false, true] },
    },
    {
      id: "RepairCli",
      prompt:
        "Read the failing check, record the smallest fix in repairTarget, apply it, and hand back to verification. Do not touch commands that pass.",
      writes: ["repairTarget"],
      next: "VerifyCli",
      steps: ["read lib/store.js:41", "ids are 1-based on screen but 0-based in the file", "patch: resolve the id before toggling"],
      values: { repairTarget: "lib/store.js:41 looked up a 0-based index with the 1-based id from the screen." },
    },
    {
      id: "RunSimulation",
      prompt:
        "Use the tool the way a project manager would across a week: add the kickoff, stakeholder and delivery tasks, tick off what gets done, edit what changes, and leave the list in a believable state.",
      next: "Done",
      steps: [
        "$ todo add “Draft project charter”",
        "$ todo add “Book kickoff with stakeholders”",
        "$ todo add “Collect requirements from support”",
        "$ todo add “Write risk register”",
        "$ todo add “Set up weekly status email”",
        "$ todo done 1 && todo done 2",
        "$ todo edit 4 “Write risk register (owner: ops)”",
        "$ todo ls",
        "[x] 1  Draft project charter",
        "[x] 2  Book kickoff with stakeholders",
        "[ ] 3  Collect requirements from support",
        "[ ] 4  Write risk register (owner: ops)",
        "[ ] 5  Set up weekly status email",
      ],
    },
    { id: "Done", final: true },
    { id: "Abandoned", final: true, outcome: "failure" },
  ],
}

export function byId(m: Machine, id: string | null): MachineState | undefined {
  return id === null ? undefined : m.states.find((s) => s.id === id)
}

export function targets(s: MachineState): string[] {
  return [...(s.when ?? []).map((w) => w.to), ...(s.next ? [s.next] : [])]
}

export function outcomeOf(s: MachineState): "success" | "failure" {
  return s.outcome ?? (/abandon|fail|error|cancel|abort/i.test(s.id) ? "failure" : "success")
}

export function failureFinal(m: Machine): MachineState | undefined {
  return m.states.find((s) => s.final && outcomeOf(s) === "failure")
}

export function capOf(m: Machine): number {
  return Math.max(1, m.maxVisits ?? 3)
}

/** Every store key, declared or written, with its kind. */
export function storeKeys(m: Machine): { key: string; kind: StoreKind; value?: StoreValue }[] {
  const out: { key: string; kind: StoreKind; value?: StoreValue }[] = []
  const seen = new Set<string>()
  for (const k of m.store ?? []) {
    if (seen.has(k.key)) continue
    seen.add(k.key)
    out.push({ key: k.key, kind: k.kind ?? "agent", value: k.value })
  }
  for (const s of m.states) {
    for (const key of s.writes ?? []) {
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ key, kind: "agent" })
    }
  }
  return out
}

export function initialStore(m: Machine): Record<string, StoreValue> {
  const store: Record<string, StoreValue> = {}
  for (const k of storeKeys(m)) if (k.kind === "set" && k.value !== undefined) store[k.key] = k.value
  return store
}

export function normalizeMachine(m: Machine): Machine {
  const seen = new Set<string>()
  const states: MachineState[] = []
  for (const s of (m && m.states) || []) {
    if (!s || !s.id || seen.has(s.id)) continue
    seen.add(s.id)
    states.push(s)
  }
  return { ...m, name: (m && m.name) || "Machine", states }
}

/** Carries simulation scripts (steps, values) over from an older copy of the machine, by state id. */
export function mergeScripts(next: Machine, prev: Machine): Machine {
  return {
    ...next,
    states: next.states.map((s) => {
      const old = byId(prev, s.id)
      if (!old || s.steps || s.values || (!old.steps && !old.values)) return s
      return { ...s, steps: old.steps, values: old.values }
    }),
  }
}

export function reachable(m: Machine): Set<string> {
  const seen = new Set<string>()
  const queue = m.states.length ? [m.states[0].id] : []
  while (queue.length) {
    const id = queue.shift() as string
    if (seen.has(id)) continue
    seen.add(id)
    const s = byId(m, id)
    if (s && !s.final) for (const t of targets(s)) if (byId(m, t)) queue.push(t)
  }
  return seen
}

/** Edges that close a loop, found by a depth-first walk from the initial state. */
export function backEdges(m: Machine): [string, string][] {
  const out: [string, string][] = []
  const mark = new Map<string, number>()
  const walk = (id: string) => {
    mark.set(id, 1)
    const s = byId(m, id)
    if (s && !s.final) {
      for (const t of targets(s)) {
        if (!byId(m, t)) continue
        if (mark.get(t) === 1) out.push([id, t])
        else if (!mark.has(t)) walk(t)
      }
    }
    mark.set(id, 2)
  }
  if (m.states.length) walk(m.states[0].id)
  return out
}

export function lintMachine(m: Machine): string[] {
  const out = [...(m.warnings ?? [])]
  const fail = failureFinal(m)
  for (const s of m.states) {
    if (s.final) continue
    const ts = targets(s)
    for (const t of ts) if (!byId(m, t)) out.push(s.id + " points at " + t + ", which does not exist.")
    if (!ts.length) out.push(s.id + " has no way out, so the run stops there.")
  }
  if (m.states.length && !m.states.some((s) => s.final)) out.push("There is no final state, so only you can stop this run.")
  for (const [a, b] of backEdges(m)) {
    out.push(
      a + " → " + b + " can loop. Each state gets " + capOf(m) + " visits, then " +
        (fail ? "the run goes to " + fail.id : "the run is abandoned") + ".",
    )
  }
  const seen = reachable(m)
  for (const s of m.states) if (!seen.has(s.id) && s !== fail) out.push(s.id + " is never reached.")
  return out
}

export function truthy(v: StoreValue | undefined): boolean {
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v > 0
  return typeof v === "string" && v !== "" && v !== "false"
}

export function formatValue(v: StoreValue | undefined): string {
  return v === undefined ? "—" : String(v)
}

/** A typed value from text: JSON when it parses as a string, number or boolean, the words as written otherwise. */
export function parseValue(text: string): StoreValue {
  const t = text.trim()
  try {
    const v = JSON.parse(t)
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  } catch {
    /* not JSON: keep the words */
  }
  return t
}

export function stepsFor(s: MachineState, visit: number): string[] {
  const list = s.steps
  if (!list || !list.length) return []
  if (Array.isArray(list[0])) {
    const per = list as string[][]
    return per[Math.min(Math.max(visit, 1), per.length) - 1] ?? []
  }
  return list as string[]
}

export function valueFor(s: MachineState, key: string, visit: number, kind: StoreKind): StoreValue {
  const v = s.values ? s.values[key] : undefined
  if (Array.isArray(v)) return v.length ? v[Math.min(Math.max(visit, 1), v.length) - 1] : kind === "agent" ? "" : true
  if (v !== undefined) return v
  return kind === "agent" ? "Written in " + s.id + "." : true
}

/** Which state comes next, and why. */
export function route(
  m: Machine,
  s: MachineState,
  store: Record<string, StoreValue>,
  visits: Record<string, number>,
): { to: string | null; via: string } {
  let to: string | null = null
  let via = "otherwise"
  for (const w of s.when ?? []) {
    if (truthy(store[w.key])) {
      to = w.to
      via = w.key
      break
    }
  }
  if (!to) to = s.next ?? null
  const fail = failureFinal(m)
  const target = byId(m, to)
  if (!target) return { to: fail ? fail.id : null, via: "dead end" }
  if (!target.final && (visits[target.id] ?? 0) >= capOf(m)) return { to: fail ? fail.id : null, via: "visit cap" }
  return { to: target.id, via }
}

export function createRun(id: string, session: string, prompt: string, machine: Machine, held = false): Run {
  return {
    id,
    session,
    prompt,
    machine,
    phase: "deciding",
    resume: null,
    held,
    events: [{ kind: "note", text: "Deciding whether this task needs a machine" }],
    current: null,
    visits: {},
    store: initialStore(machine),
    cursor: 0,
    transitions: 0,
    edge: null,
  }
}

/** The planner has answered: give the held run its machine. */
export function authorRun(run: Run, machine: Machine): Run {
  return { ...run, machine, held: false, store: initialStore(machine) }
}

export function fail(run: Run, text: string): Run {
  return { ...run, held: false, phase: "abandoned", resume: null, events: [...run.events, { kind: "error", text }] }
}

export function logStep(run: Run, text: string): Run {
  return { ...run, events: [...run.events, { kind: "step", state: run.current ?? "", text }] }
}

export function writeStore(run: Run, key: string, value: StoreValue): Run {
  return { ...run, store: { ...run.store, [key]: value }, events: [...run.events, { kind: "write", state: run.current ?? "", key, value }] }
}

/** A value you typed into the store yourself. */
export function setInput(run: Run, key: string, value: StoreValue): Run {
  return { ...run, store: { ...run.store, [key]: value }, events: [...run.events, { kind: "input", key, value }] }
}

function enter(run: Run, id: string): Run {
  const visits = { ...run.visits, [id]: (run.visits[id] ?? 0) + 1 }
  const events: RunEvent[] = [...run.events, { kind: "enter", state: id, visit: visits[id] }]
  const s = byId(run.machine, id)
  if (s && s.final) {
    const outcome = outcomeOf(s) === "failure" ? "abandoned" : "done"
    return { ...run, visits, current: id, cursor: 0, phase: outcome, events: [...events, { kind: "finish", state: id, outcome }] }
  }
  return { ...run, visits, current: id, cursor: 0, events }
}

/** Leave the current state for whichever one the store points at. */
export function advanceRun(run: Run): Run {
  const s = byId(run.machine, run.current)
  if (!s || s.final) return run
  const r = route(run.machine, s, run.store, run.visits)
  const events: RunEvent[] = [...run.events, { kind: "leave", state: s.id, to: r.to ?? "", via: r.via }]
  if (!r.to) {
    return { ...run, phase: "abandoned", cursor: 0, events: [...events, { kind: "finish", state: s.id, outcome: "abandoned" }] }
  }
  return enter({ ...run, events, transitions: run.transitions + 1, edge: { from: s.id, to: r.to, via: r.via } }, r.to)
}

/** One beat of the simulation. Pure: the same run always produces the same next run. */
export function tick(run: Run): Run {
  if (run.held) return run
  const m = run.machine
  if (run.phase === "deciding") {
    return { ...run, phase: "authored", events: [...run.events, { kind: "authored", machine: m.name, warnings: lintMachine(m) }] }
  }
  if (run.phase === "authored") {
    return { ...run, phase: "awaiting", events: [...run.events, { kind: "waiting", machine: m.name }] }
  }
  if (run.phase !== "running") return run
  const s = byId(m, run.current)
  if (!s || s.final) return run
  const visit = run.visits[s.id] ?? 1
  const steps = stepsFor(s, visit)
  const writes = s.writes ?? []
  const c = run.cursor
  if (c < steps.length) return { ...logStep(run, steps[c]), cursor: c + 1 }
  if (c < steps.length + writes.length) {
    const key = writes[c - steps.length]
    const kind = storeKeys(m).find((k) => k.key === key)?.kind ?? "agent"
    return { ...writeStore(run, key, valueFor(s, key, visit, kind)), cursor: c + 1 }
  }
  return advanceRun(run)
}

export function approve(run: Run, auto = false): Run {
  if (run.phase !== "awaiting") return run
  const first = run.machine.states[0]
  const events: RunEvent[] = [
    ...run.events,
    { kind: "approved", machine: run.machine.name, auto },
    { kind: "executing", machine: run.machine.name, states: run.machine.states.length },
  ]
  if (!first) return { ...run, phase: "done", events }
  return enter({ ...run, phase: "running", events }, first.id)
}

export function decline(run: Run): Run {
  if (run.phase !== "awaiting") return run
  return { ...run, phase: "declined", events: [...run.events, { kind: "declined", machine: run.machine.name }] }
}

export function stop(run: Run): Run {
  if (run.phase !== "deciding" && run.phase !== "authored" && run.phase !== "running") return run
  return { ...run, phase: "stopped", resume: run.phase, events: [...run.events, { kind: "stopped", state: run.current }] }
}

/** You end a stopped run for good: it finishes, abandoned, wherever it was. */
export function endRun(run: Run): Run {
  if (run.phase !== "stopped") return run
  return {
    ...run,
    phase: "abandoned",
    resume: null,
    held: false,
    events: [...run.events, { kind: "finish", state: run.current ?? "", outcome: "abandoned" }],
  }
}

export function resume(run: Run): Run {
  if (run.phase !== "stopped") return run
  return { ...run, phase: run.resume ?? "running", resume: null, events: [...run.events, { kind: "resumed", state: run.current }] }
}

/** Swap in an edited machine before approval, keeping the old simulation scripts. */
export function editMachine(run: Run, next: Machine): Run {
  if (run.phase !== "awaiting") return run
  const machine = mergeScripts(normalizeMachine(next), run.machine)
  return {
    ...run,
    machine,
    store: initialStore(machine),
    events: [...run.events, { kind: "edited", machine: machine.name, warnings: lintMachine(machine) }],
  }
}

export function isBusy(run: Run | null | undefined): boolean {
  return !!run && (run.phase === "deciding" || run.phase === "authored" || run.phase === "running")
}

/** Tick (approving on the way) until `until` holds. */
export function fastForward(run: Run, until: (r: Run) => boolean, limit = 500): Run {
  let r = run
  for (let i = 0; i < limit && !until(r); i++) {
    const n = r.phase === "awaiting" ? approve(r) : tick(r)
    if (n === r) break
    r = n
  }
  return r
}

/** How long, in ms at 1x, before the simulation's next beat. */
export function beatDelay(run: Run): number {
  if (run.phase === "deciding") return 1300
  if (run.phase === "authored") return 900
  if (run.phase !== "running") return 600
  const s = byId(run.machine, run.current)
  if (!s) return 600
  const steps = stepsFor(s, run.visits[s.id] ?? 1)
  const writes = s.writes ?? []
  if (run.cursor === 0) return 1300
  if (run.cursor < steps.length) return 520 + Math.min(steps[run.cursor].length * 9, 520)
  if (run.cursor < steps.length + writes.length) return 750
  return 950
}

export interface SessionSeed {
  id?: string
  title?: string
  prompt: string
  machine?: Machine
  /** Where the session starts. Default: deciding, so it plays from the top. */
  status?: "deciding" | "awaiting" | "running" | "done"
  /** With status running: fast-forward to this state */
  at?: string
}

export function seedRun(id: string, session: string, seed: SessionSeed, plan: (prompt: string) => Machine): Run {
  const run = createRun(id, session, seed.prompt, normalizeMachine(seed.machine ?? plan(seed.prompt)))
  const status = seed.status ?? "deciding"
  if (status === "awaiting") return fastForward(run, (r) => r.phase === "awaiting")
  if (status === "done") return fastForward(run, (r) => r.phase === "done" || r.phase === "abandoned")
  if (status === "running") {
    const started = approve(fastForward(run, (r) => r.phase === "awaiting"))
    const at = seed.at
    return at ? fastForward(started, (r) => (r.current === at && r.cursor === 0) || r.phase !== "running") : started
  }
  return run
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(new Error("aborted"))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error("aborted"))
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    if (signal) signal.addEventListener("abort", onAbort, { once: true })
  })
}

/** Plays a state's scripted steps and values in real time. Use it as an executor, or for the states you have not wired yet. */
export async function simulateState(ctx: StateContext, speed = 1): Promise<void> {
  const k = Math.max(0.05, speed)
  const steps = stepsFor(ctx.state, ctx.visit)
  await wait(1000 / k, ctx.signal)
  for (const line of steps) {
    ctx.log(line)
    await wait((520 + Math.min(line.length * 9, 520)) / k, ctx.signal)
  }
  for (const key of ctx.state.writes ?? []) {
    const kind = storeKeys(ctx.machine).find((x) => x.key === key)?.kind ?? "agent"
    ctx.write(key, valueFor(ctx.state, key, ctx.visit, kind))
    await wait(650 / k, ctx.signal)
  }
}

export interface GraphNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  col: number
  final: boolean
  failure: boolean
}

export interface GraphEdge {
  from: string
  to: string
  kind: "next" | "when" | "cap"
  back: boolean
  d: string
}

export interface GraphLayout {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
}

/** Columns by distance from the initial state, finals last; loops arc underneath. */
export function layoutMachine(
  m: Machine,
  size: { w: number; h: number; gapX: number; gapY: number } = { w: 66, h: 18, gapX: 14, gapY: 10 },
): GraphLayout {
  const { w, h, gapX, gapY } = size
  const padX = 14
  const padY = 10
  const depth = new Map<string, number>()
  const order: string[] = []
  if (m.states.length) {
    depth.set(m.states[0].id, 0)
    order.push(m.states[0].id)
  }
  for (let q = 0; q < order.length; q++) {
    const s = byId(m, order[q])
    if (!s || s.final) continue
    for (const t of targets(s)) {
      if (!depth.has(t) && byId(m, t)) {
        depth.set(t, (depth.get(s.id) ?? 0) + 1)
        order.push(t)
      }
    }
  }
  let last = 0
  for (const s of m.states) if (!s.final && depth.has(s.id)) last = Math.max(last, depth.get(s.id) ?? 0)
  const lost = m.states.filter((s) => !s.final && !depth.has(s.id))
  if (lost.length) last += 1
  for (const s of lost) {
    depth.set(s.id, last)
    order.push(s.id)
  }
  const finalCol = m.states.some((s) => !s.final) ? last + 1 : 0
  for (const s of m.states) {
    if (!s.final) continue
    depth.set(s.id, finalCol)
    if (!order.includes(s.id)) order.push(s.id)
  }
  const cols: string[][] = []
  for (const id of order) {
    const d = depth.get(id) ?? 0
    if (!cols[d]) cols[d] = []
    cols[d].push(id)
  }
  const fails = (id: string) => {
    const s = byId(m, id)
    return s && s.final && outcomeOf(s) === "failure" ? 1 : 0
  }
  if (cols[finalCol]) cols[finalCol].sort((a, b) => fails(a) - fails(b))

  const rows = Math.max(1, ...cols.map((c) => (c ? c.length : 0)))
  const block = rows * h + (rows - 1) * gapY
  const nodes: GraphNode[] = []
  cols.forEach((c, ci) => {
    if (!c) return
    const top = padY + (block - (c.length * h + (c.length - 1) * gapY)) / 2
    c.forEach((id, i) => {
      const s = byId(m, id) as MachineState
      nodes.push({
        id,
        x: padX + ci * (w + gapX),
        y: top + i * (h + gapY),
        w,
        h,
        col: ci,
        final: !!s.final,
        failure: !!s.final && outcomeOf(s) === "failure",
      })
    })
  })

  const at = (id: string) => nodes.find((n) => n.id === id)
  const r1 = (v: number) => Math.round(v * 10) / 10
  const bottom = padY + block
  let deepest = bottom
  const curve = (a: GraphNode, b: GraphNode, dip: number): string => {
    if (b.col > a.col) {
      const x1 = a.x + a.w
      const y1 = a.y + a.h / 2
      const x2 = b.x
      const y2 = b.y + b.h / 2
      const mx = (x1 + x2) / 2
      return "M" + r1(x1) + " " + r1(y1) + "C" + r1(mx) + " " + r1(y1) + " " + r1(mx) + " " + r1(y2) + " " + r1(x2) + " " + r1(y2)
    }
    const x1 = a.x + a.w * 0.4
    const x2 = b.x + b.w * 0.6
    deepest = Math.max(deepest, dip)
    return "M" + r1(x1) + " " + r1(a.y + a.h) + "C" + r1(x1) + " " + r1(dip) + " " + r1(x2) + " " + r1(dip) + " " + r1(x2) + " " + r1(b.y + b.h)
  }

  const edges: GraphEdge[] = []
  let loops = 0
  for (const s of m.states) {
    const a = at(s.id)
    if (!a || s.final) continue
    const outs = [
      ...(s.when ?? []).map((x) => ({ to: x.to, kind: "when" as const })),
      ...(s.next ? [{ to: s.next, kind: "next" as const }] : []),
    ]
    for (const o of outs) {
      const b = at(o.to)
      if (!b) continue
      const back = b.col <= a.col
      const dip = back ? bottom + h * 0.9 + 5 * (loops++ % 3) + 2 * Math.abs(a.col - b.col) : 0
      edges.push({ from: s.id, to: o.to, kind: o.kind, back, d: curve(a, b, dip) })
    }
  }
  const failState = failureFinal(m)
  const fb = failState ? at(failState.id) : undefined
  if (fb) {
    const from = new Set<string>()
    for (const [x, y] of backEdges(m)) {
      from.add(x)
      from.add(y)
    }
    for (const id of from) {
      const a = at(id)
      if (!a || a.col >= fb.col || edges.some((e) => e.from === id && e.to === fb.id)) continue
      edges.push({ from: id, to: fb.id, kind: "cap", back: false, d: curve(a, fb, 0) })
    }
  }
  const cols2 = Math.max(1, cols.length)
  return {
    nodes,
    edges,
    width: padX * 2 + cols2 * w + (cols2 - 1) * gapX,
    height: Math.ceil(Math.max(bottom + padY, deepest + 6)),
  }
}

export function wrapText(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > width) {
      lines.push(line)
      line = word
    } else line = line ? line + " " + word : word
  }
  if (line) lines.push(line)
  return lines
}

/** The machine as a small, readable source file. `parseMachine` reads it back. */
export function machineSource(m: Machine): string {
  const out: string[] = ["machine " + m.name, "  max visits " + capOf(m), ""]
  const keys = storeKeys(m)
  if (keys.length) {
    out.push("store")
    for (const k of keys) {
      out.push("  " + (k.kind + "         ").slice(0, 9) + k.key + (k.value !== undefined ? " = " + JSON.stringify(k.value) : ""))
    }
    out.push("")
  }
  m.states.forEach((s, i) => {
    const kw = s.final ? "final" : i === 0 ? "initial" : "state"
    out.push(kw + " " + s.id + (s.final && outcomeOf(s) === "failure" ? " failure" : ""))
    if (s.writes && s.writes.length) out.push("  writes " + s.writes.join(", "))
    for (const w of s.when ?? []) out.push("  when " + w.key + " -> " + w.to)
    if (s.next) out.push("  otherwise -> " + s.next)
    if (s.prompt) {
      out.push("  prompt")
      for (const l of wrapText(s.prompt, 58)) out.push("    | " + l)
    }
    out.push("")
  })
  return out.join("\n").trimEnd() + "\n"
}

/** Reads machine source back into a machine. Errors carry line numbers; lint warnings are separate. */
export function parseMachine(text: string): { machine: Machine | null; errors: string[] } {
  const errors: string[] = []
  const ident = /^[A-Za-z_]\w*$/
  let name = ""
  let maxVisits: number | undefined
  const store: MachineStoreKey[] = []
  const states: MachineState[] = []
  let section: "top" | "store" | "states" = "top"
  let cur: MachineState | null = null
  let inPrompt = false
  let initial = false
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  for (let i = 0; i < lines.length; i++) {
    const at = "Line " + (i + 1) + ": "
    const raw = lines[i]
    const body = raw.trim()
    if (!body) continue
    if (body.charAt(0) === "|") {
      if (!cur || !inPrompt) errors.push(at + "prompt text belongs under a prompt line.")
      else cur.prompt = (cur.prompt ? cur.prompt + " " : "") + body.slice(1).trim()
      continue
    }
    inPrompt = false
    if (body.charAt(0) === "#") continue
    let m: RegExpMatchArray | null
    if (!/^\s/.test(raw)) {
      if ((m = body.match(/^machine\s+(\S+)$/))) {
        if (!ident.test(m[1])) errors.push(at + "machine names use letters, digits and underscores.")
        name = m[1]
        section = "top"
        cur = null
        continue
      }
      if (body === "store") {
        section = "store"
        cur = null
        continue
      }
      if ((m = body.match(/^(initial|state|final)\s+(\S+)(?:\s+(\S+))?$/))) {
        const kw = m[1]
        const id = m[2]
        const extra = m[3]
        if (!ident.test(id)) {
          errors.push(at + id + " is not a valid state name.")
          cur = null
          continue
        }
        if (states.some((s) => s.id === id)) errors.push(at + id + " is defined twice.")
        const s: MachineState = { id }
        if (kw === "final") {
          s.final = true
          if (extra === "failure" || extra === "success") s.outcome = extra
          else if (extra) errors.push(at + "a final state can only be marked failure or success.")
        } else if (extra) errors.push(at + "only final states take an outcome.")
        if (kw === "initial") {
          if (initial) errors.push(at + "there can only be one initial state.")
          initial = true
          states.unshift(s)
        } else states.push(s)
        cur = s
        section = "states"
        continue
      }
      errors.push(at + "expected machine, store, initial, state or final.")
      continue
    }
    if (section === "top") {
      if ((m = body.match(/^max visits\s+(\d+)$/))) maxVisits = Number(m[1])
      else errors.push(at + "only “max visits N” goes under machine.")
      continue
    }
    if (section === "store") {
      m = body.match(/^(agent|observed|set)\s+(\S+?)(?:\s*=\s*(.+))?$/)
      if (!m || !ident.test(m[2])) {
        errors.push(at + "store lines look like “agent keyName” or “set keyName = value”.")
        continue
      }
      const k: MachineStoreKey = { key: m[2], kind: m[1] as StoreKind }
      if (m[3] !== undefined) k.value = parseValue(m[3])
      store.push(k)
      continue
    }
    if (!cur) continue
    if ((m = body.match(/^writes\s+(.+)$/))) {
      const keys = m[1].split(",").map((s) => s.trim()).filter(Boolean)
      const bad = keys.find((k) => !ident.test(k))
      if (bad) errors.push(at + bad + " is not a valid store key.")
      cur.writes = keys
      continue
    }
    if ((m = body.match(/^when\s+(\S+)\s*->\s*(\S+)$/))) {
      if (!cur.when) cur.when = []
      cur.when.push({ key: m[1], to: m[2] })
      continue
    }
    if ((m = body.match(/^otherwise\s*->\s*(\S+)$/))) {
      cur.next = m[1]
      continue
    }
    if (body === "prompt") {
      inPrompt = true
      cur.prompt = ""
      continue
    }
    errors.push(at + "expected writes, when, otherwise or prompt.")
  }
  for (const s of states) if (!s.prompt) delete s.prompt
  if (!name) errors.unshift("Name the machine on the first line: machine YourMachineName")
  if (!states.length) errors.push("Add at least one state.")
  if (errors.length) return { machine: null, errors }
  const machine: Machine = { name, states }
  if (store.length) machine.store = store
  if (maxVisits !== undefined) machine.maxVisits = maxVisits
  return { machine, errors }
}

/** Text split into plain runs and code chips: anything in backticks, plus every store key named. */
export function splitCode(text: string, keys: string[]): { text: string; code: boolean }[] {
  const out: { text: string; code: boolean }[] = []
  const names = keys.filter((k) => /^[A-Za-z_]\w*$/.test(k)).sort((a, b) => b.length - a.length)
  const re = names.length ? new RegExp("\\b(?:" + names.join("|") + ")\\b", "g") : null
  text.split(/`([^`]+)`/).forEach((part, i) => {
    if (i % 2) {
      out.push({ text: part, code: true })
      return
    }
    let last = 0
    if (re) {
      for (const hit of part.matchAll(re)) {
        const at = hit.index ?? 0
        if (at > last) out.push({ text: part.slice(last, at), code: false })
        out.push({ text: hit[0], code: true })
        last = at + hit[0].length
      }
    }
    if (last < part.length) out.push({ text: part.slice(last), code: false })
  })
  return out
}

export function lineKind(text: string): "cmd" | "check" | "fail" | "pass" | "tool" | "out" {
  if (/^\$ /.test(text)) return "cmd"
  if (/^\[[ xX]\] /.test(text)) return "check"
  if (/\b(error|failed|not met|exit [1-9])\b/i.test(text) || /^\w*Error\b/.test(text)) return "fail"
  if (/\b(passed|met|ok)\b/i.test(text)) return "pass"
  if (/^(read|write|patch|search|note|outline|trace|attach|post|wire|add|source|tighten|scan|count|check|find|list)\b/.test(text)) return "tool"
  return "out"
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "session"
  )
}

/** A session as Markdown: every ask, every state, every store write, and the machines. */
export function transcriptMarkdown(title: string, runs: Run[], ext = ".machine"): string {
  const out: string[] = ["# " + title, ""]
  for (const run of runs) {
    out.push("## You asked", "", "> " + run.prompt.replace(/\n/g, "\n> "), "")
    for (const e of run.events) {
      if (e.kind === "authored") out.push("Machine authored: **" + e.machine + "** (" + e.warnings.length + (e.warnings.length === 1 ? " warning)" : " warnings)"), "")
      else if (e.kind === "edited") out.push("You edited **" + e.machine + "**.", "")
      else if (e.kind === "approved") out.push((e.auto ? "Auto-approved" : "Approved") + " **" + e.machine + "**.", "")
      else if (e.kind === "declined") out.push("Declined **" + e.machine + "**. Nothing ran.", "")
      else if (e.kind === "enter") out.push("### " + e.state + (e.visit > 1 ? " (visit " + e.visit + ")" : ""), "")
      else if (e.kind === "step") out.push("- " + e.text)
      else if (e.kind === "write") out.push("- wrote **" + e.key + "** = " + JSON.stringify(e.value))
      else if (e.kind === "input") out.push("- you set **" + e.key + "** = " + JSON.stringify(e.value))
      else if (e.kind === "leave") out.push("", "→ " + e.to + (e.via === "otherwise" ? "" : " (" + e.via + ")"), "")
      else if (e.kind === "finish") out.push("**" + (e.outcome === "done" ? "Finished" : "Abandoned") + " in " + e.state + ".**", "")
      else if (e.kind === "error") out.push("> Error: " + e.text, "")
      else if (e.kind === "stopped") out.push("_Stopped by you._", "")
      else if (e.kind === "resumed") out.push("_Resumed._", "")
    }
    if (run.machine.states.length) {
      out.push("<details><summary>" + run.machine.name + ext + "</summary>", "", "    " + machineSource(run.machine).trimEnd().split("\n").join("\n    "), "", "</details>", "")
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"
}

export interface Snapshot {
  v: 1
  sessions: Session[]
  runs: Run[]
  active: string | null
  prefs: Record<string, unknown>
}

/** Reads saved state back, dropping anything malformed instead of throwing. */
export function readSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d: any
  try {
    d = JSON.parse(raw)
  } catch {
    return null
  }
  if (!d || d.v !== 1 || !Array.isArray(d.sessions) || !Array.isArray(d.runs)) return null
  const sessions: Session[] = d.sessions
    .filter((s: Session) => s && typeof s.id === "string")
    .map((s: Session) => ({ id: s.id, title: typeof s.title === "string" ? s.title : "", created: Number(s.created) || 0 }))
  const ids = new Set(sessions.map((s) => s.id))
  const runs: Run[] = d.runs
    .filter(
      (r: Run) =>
        r &&
        typeof r.id === "string" &&
        ids.has(r.session) &&
        typeof r.prompt === "string" &&
        r.machine &&
        Array.isArray(r.machine.states) &&
        Array.isArray(r.events) &&
        typeof r.phase === "string",
    )
    .map((r: Run) => ({
      ...r,
      held: !!r.held,
      resume: r.resume ?? null,
      current: r.current ?? null,
      visits: r.visits ?? {},
      store: r.store ?? {},
      cursor: r.cursor ?? 0,
      transitions: r.transitions ?? 0,
      edge: r.edge ?? null,
    }))
  return {
    v: 1,
    sessions,
    runs,
    active: typeof d.active === "string" ? d.active : null,
    prefs: d.prefs && typeof d.prefs === "object" ? d.prefs : {},
  }
}
// #endregion logic

/* ------------------------------------------------------------------------ */
/* Theme                                                                     */
/* ------------------------------------------------------------------------ */

export type AgentConsoleThemeName = "apex" | "night" | "sage" | "paper" | "lilac"

export interface AgentConsolePalette {
  /** The app */
  surface: string
  /** Lifted panels: the store, popovers */
  raised: string
  /** Code chips and pressed controls */
  sunk: string
  /** Graph nodes */
  node: string
  ink: string
  muted: string
  faint: string
  rule: string
  warn: string
  ok: string
  /** The crew's line work */
  crew: string
  crewFill: string
}

export const THEMES: Record<AgentConsoleThemeName, AgentConsolePalette> = {
  apex: {
    surface: "#0c0e12",
    raised: "#13171f",
    sunk: "#1a202c",
    node: "#222a38",
    ink: "#f1f5f9",
    muted: "#94a3b8",
    faint: "#64748b",
    rule: "rgba(241, 245, 249, 0.09)",
    warn: "#d97706",
    ok: "#10b981",
    crew: "#c87038",
    crewFill: "#241812",
  },
  night: {
    surface: "#17211b",
    raised: "#1e2b23",
    sunk: "#2a3a30",
    node: "#34473b",
    ink: "#e2eee5",
    muted: "#a6bcad",
    faint: "#7d9586",
    rule: "rgba(226, 238, 229, 0.12)",
    warn: "#e3b25e",
    ok: "#7fd39a",
    crew: "#aeb2f2",
    crewFill: "#3b406f",
  },
  sage: {
    surface: "#c0d8c8",
    raised: "#cde4d4",
    sunk: "#a9c4b2",
    node: "#93ab9a",
    ink: "#07170c",
    muted: "#3f5747",
    faint: "#5f7868",
    rule: "rgba(7, 23, 12, 0.13)",
    warn: "#8a5711",
    ok: "#1c6a3a",
    crew: "#5b5ea6",
    crewFill: "#aab4cb",
  },
  paper: {
    surface: "#ece5d6",
    raised: "#f5f0e5",
    sunk: "#ddd2bd",
    node: "#c8b998",
    ink: "#1c1812",
    muted: "#554b3c",
    faint: "#7d7260",
    rule: "rgba(28, 24, 18, 0.13)",
    warn: "#9a4a12",
    ok: "#2f6a2f",
    crew: "#b0452e",
    crewFill: "#e6c4ad",
  },
  lilac: {
    surface: "#d5d2ec",
    raised: "#e2e0f4",
    sunk: "#c1bce0",
    node: "#a9a3d0",
    ink: "#13112a",
    muted: "#46426a",
    faint: "#69658d",
    rule: "rgba(19, 17, 42, 0.13)",
    warn: "#8a4f12",
    ok: "#2d6a4a",
    crew: "#2f6b52",
    crewFill: "#b6d3c3",
  },
}

const THEME_NAMES: AgentConsoleThemeName[] = ["apex", "night", "sage", "paper", "lilac"]

/* ------------------------------------------------------------------------ */
/* Styles: every selector is scoped under .act-                              */
/* ------------------------------------------------------------------------ */

export const ACT_CSS = `
.act-root {
  --act-sans: "Inter", "Helvetica Neue", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --act-mono: "JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --act-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --act-sbw: 0px;
  --act-pnw: 0px;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--act-h);
  min-height: var(--act-minh);
  overflow: hidden;
  isolation: isolate;
  background: var(--act-surface);
  color: var(--act-ink);
  font-family: var(--act-sans);
  font-size: 14px;
  line-height: 1.45;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.act-root.act-sb-on { --act-sbw: 252px; }
.act-root.act-pn-on { --act-pnw: 348px; }
.act-root.act-tiny { --act-sbw: 0px; }
.act-root.act-narrow { --act-pnw: 0px; }
.act-root:not(.act-ready), .act-root:not(.act-ready) * { transition: none !important; }
.act-root *, .act-root *::before, .act-root *::after { box-sizing: border-box; }
.act-root :where(button) {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: 0;
  margin: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  cursor: pointer;
}
.act-root :where(button:disabled) { cursor: default; opacity: 0.45; }
.act-root :where(input, textarea) { font: inherit; color: inherit; margin: 0; }
.act-root :where(h2, h3, p, ul, li, dl, dt, dd, pre) { margin: 0; padding: 0; }
.act-root :where(ul) { list-style: none; }
.act-root :where(button, textarea, input, [tabindex]):focus-visible { outline: 2px solid var(--act-ink); outline-offset: 2px; }
.act-svg { display: block; max-width: none; flex: none; overflow: visible; }
.act-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ---- title bar ----------------------------------------------------------- */
.act-bar { position: relative; z-index: 8; flex: none; height: 50px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 12px; }
.act-iconbtn {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--act-ink);
  transition: background-color 0.2s ease, transform 0.3s var(--act-ease);
}
.act-iconbtn:hover { background-color: var(--act-rule); }
.act-brand { display: flex; align-items: center; gap: 9px; min-width: 0; margin-left: 4px; font-family: var(--act-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; white-space: nowrap; }
.act-brand b { font-weight: 800; color: var(--act-ink); }
.act-brand i { font-style: normal; color: var(--act-faint); }
.act-brand span { color: var(--act-muted); overflow: hidden; text-overflow: ellipsis; }
.act-logo { display: grid; place-items: center; width: 24px; height: 24px; color: var(--act-ink); }
.act-grow { flex: 1; min-width: 8px; }
.act-bar-status { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 36%; margin-right: 4px; font-family: var(--act-mono); font-size: 12px; font-weight: 700; white-space: nowrap; }
.act-bar-status span:last-child { overflow: hidden; text-overflow: ellipsis; }
.act-panelbtn { border-radius: 50%; }
.act-panelbtn[aria-pressed="true"] { background: var(--act-ink); color: var(--act-surface); }
.act-panelbtn[aria-pressed="true"]:hover { background: var(--act-ink); transform: scale(1.06); }
.act-tweakbtn[aria-expanded="true"] { background: var(--act-sunk); }

/* ---- workspace pills & actions in bar ------------------------------------ */
.act-bar-center {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 8px;
  background: color-mix(in srgb, var(--act-sunk) 60%, transparent);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--act-rule);
}
.act-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 6px;
  font-family: var(--act-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--act-muted);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.act-pill-btn:hover {
  color: var(--act-ink);
  background: color-mix(in srgb, var(--act-raised) 70%, transparent);
}
.act-pill-btn[data-active="true"] {
  background: var(--act-raised);
  color: var(--act-ink);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.act-bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 6px;
}
.act-action-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-family: var(--act-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--act-ink);
  background: var(--act-sunk);
  border: 1px solid var(--act-rule);
  transition: all 0.15s ease;
}
.act-action-pill:hover {
  background: var(--act-raised);
  border-color: color-mix(in srgb, var(--act-ink) 25%, transparent);
}
.act-custom-workspace {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 20px;
  background: var(--act-surface);
  color: var(--act-ink);
}

/* ---- status marks -------------------------------------------------------- */
.act-spin { display: inline-block; flex: none; width: 11px; height: 11px; border-radius: 50%; border: 1.6px solid currentColor; border-right-color: transparent; animation: act-rot 0.9s linear infinite; }
.act-mark { display: inline-grid; place-items: center; flex: none; width: 11px; height: 11px; }
.act-mark-wait::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--act-warn); animation: act-blink 1.4s ease-in-out infinite; }
.act-mark-idle::before { content: ""; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--act-faint); }
.act-mark-ok { color: var(--act-ok); }
.act-mark-bad { color: var(--act-warn); }

/* ---- body grid ----------------------------------------------------------- */
.act-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--act-sbw) minmax(0, 1fr) var(--act-pnw);
  grid-template-rows: minmax(0, 1fr);
  border-top: 1px solid var(--act-rule);
  transition: grid-template-columns 0.45s var(--act-ease);
}
.act-cap { font-family: var(--act-mono); font-size: 10px; font-weight: 600; line-height: 1.4; letter-spacing: 0.16em; text-transform: uppercase; color: var(--act-muted); }
.act-link { color: var(--act-ink); font-weight: 700; border-radius: 3px; transition: opacity 0.2s ease; }
.act-link:hover { opacity: 0.6; }
.act-mono-b { font-family: var(--act-mono); font-weight: 800; font-size: 12.5px; color: var(--act-ink); }
.act-okc { color: var(--act-ok); }
.act-badc { color: var(--act-warn); }
.act-faintc { color: var(--act-faint); }

/* ---- sidebar ------------------------------------------------------------- */
.act-side { grid-column: 1; grid-row: 1; display: flex; min-width: 0; overflow: hidden; border-right: 1px solid var(--act-rule); }
.act-root:not(.act-sb-on) .act-side { border-right-color: transparent; }
.act-side-in { position: relative; flex: none; width: 252px; display: flex; flex-direction: column; min-height: 0; }
.act-side-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 12px 8px 20px; }
.act-search { display: flex; align-items: center; gap: 8px; margin: 2px 12px 8px; padding: 0 8px 0 10px; height: 34px; border-radius: 9px; background: color-mix(in srgb, var(--act-raised) 70%, transparent); box-shadow: inset 0 0 0 1px var(--act-rule); color: var(--act-faint); }
.act-search:focus-within { box-shadow: inset 0 0 0 1.5px var(--act-ink); color: var(--act-ink); }
.act-search input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent; font-size: 13px; color: var(--act-ink); }
.act-search input::placeholder { color: var(--act-faint); opacity: 1; }
.act-search input:focus-visible { outline: none; }
.act-search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.act-search-x { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; color: var(--act-faint); }
.act-search-x:hover { background: var(--act-rule); color: var(--act-ink); }
.act-kbd { flex: none; padding: 1px 5px; border-radius: 4px; box-shadow: inset 0 0 0 1px var(--act-rule); font-family: var(--act-mono); font-size: 10px; color: var(--act-faint); }
.act-sessions { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--act-rule) transparent; padding-bottom: 8px; }
.act-sess { position: relative; }
.act-sess-btn { display: block; width: 100%; padding: 9px 38px 10px 18px; border-left: 2px solid transparent; transition: background-color 0.2s ease, border-color 0.2s ease; }
.act-sess-btn:hover { background-color: color-mix(in srgb, var(--act-ink) 5%, transparent); }
.act-sess-on .act-sess-btn { border-left-color: var(--act-ink); }
.act-sess-title { display: block; font-size: 12.5px; font-weight: 600; color: var(--act-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-sess-on .act-sess-title { font-weight: 700; }
.act-sess-status { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-family: var(--act-mono); font-size: 11px; font-weight: 700; color: var(--act-ink); white-space: nowrap; overflow: hidden; }
.act-sess-status span:last-child { overflow: hidden; text-overflow: ellipsis; }
.act-sess-more { position: absolute; right: 8px; top: 9px; width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; color: var(--act-faint); opacity: 0; transition: opacity 0.2s ease, background-color 0.2s ease; }
.act-sess:hover .act-sess-more, .act-sess-more:focus-visible, .act-sess-more[aria-expanded="true"] { opacity: 1; }
.act-sess-more:hover, .act-sess-more[aria-expanded="true"] { background: var(--act-rule); color: var(--act-ink); }
.act-rename { padding: 6px 12px 6px 16px; }
.act-rename input { width: 100%; height: 32px; padding: 0 8px; border-radius: 7px; border: 0; outline: none; background: var(--act-raised); box-shadow: inset 0 0 0 1.5px var(--act-ink); font-size: 12.5px; font-weight: 600; }
.act-menu {
  position: absolute;
  right: 8px;
  top: 36px;
  z-index: 12;
  min-width: 176px;
  padding: 5px;
  border-radius: 10px;
  background: var(--act-raised);
  box-shadow: 0 0 0 1px var(--act-rule), 0 18px 40px -16px rgba(0, 0, 0, 0.4);
  animation: act-pop 0.22s var(--act-ease) both;
}
.act-menu button { display: flex; align-items: center; gap: 9px; width: 100%; height: 32px; padding: 0 9px; border-radius: 7px; font-size: 12.5px; color: var(--act-ink); }
.act-menu button:hover, .act-menu button:focus-visible { background: var(--act-rule); outline: none; }
.act-menu .act-menu-bad { color: var(--act-warn); }
.act-empty-list { padding: 10px 20px; font-size: 12.5px; color: var(--act-faint); }

/* ---- the crew ------------------------------------------------------------ */
.act-crew { position: relative; flex: none; display: flex; align-items: flex-end; gap: 6px; padding: 10px 16px 16px; }
.act-fig { display: block; border-radius: 8px; transition: transform 0.3s var(--act-ease); }
.act-fig:hover { transform: translateY(-3px); }
.act-fig .act-svg { width: 40px; height: 64px; }
.act-fig-body { transform-origin: 20px 61px; animation: act-breathe 4.2s ease-in-out infinite; }
.act-fig:nth-of-type(2) .act-fig-body { animation-delay: -1.4s; }
.act-fig:nth-of-type(3) .act-fig-body { animation-delay: -2.8s; }
.act-orb { transition: fill 0.3s ease; }
.act-spark { opacity: 0; transform-origin: 35px 5px; }
.act-mood-authoring .act-orb { animation: act-orb 1.1s ease-in-out infinite; }
.act-mood-authoring .act-spark { animation: act-twinkle 1.1s ease-in-out infinite; }
.act-glyph { transform-origin: 20px 12.5px; }
.act-glyph-pulse { animation: act-glyph 0.9s ease-out; }
.act-mood-waiting .act-glyph { animation: act-blink 1.6s ease-in-out infinite; }
.act-wing-l { transform-origin: 17px 32px; }
.act-wing-r { transform-origin: 23px 32px; }
.act-mood-verifying .act-wing-l { animation: act-flap-l 0.42s ease-in-out infinite alternate; }
.act-mood-verifying .act-wing-r { animation: act-flap-r 0.42s ease-in-out infinite alternate; }
.act-mood-done .act-fig-body { animation: act-hop 0.7s cubic-bezier(0.3, 1.6, 0.5, 1) 2; }
.act-mood-done .act-fig:nth-of-type(2) .act-fig-body { animation-delay: 0.12s; }
.act-mood-done .act-fig:nth-of-type(3) .act-fig-body { animation-delay: 0.24s; }
.act-mood-down .act-fig-body { animation: none; transform: translateY(1px) rotate(-3deg); opacity: 0.78; }
.act-lid { transform-origin: 20px 18.9px; transform: scaleY(0); transition: transform 0.3s ease; }
.act-mood-down .act-lid { transform: scaleY(1); }
.act-say {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc(100% - 4px);
  padding: 9px 11px 10px;
  border-radius: 10px;
  background: var(--act-raised);
  box-shadow: 0 0 0 1px var(--act-rule), 0 12px 28px -14px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  line-height: 1.45;
  animation: act-pop 0.3s var(--act-ease) both;
}
.act-say b { display: block; margin-bottom: 2px; font-family: var(--act-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--act-crew); }
.act-say::after { content: ""; position: absolute; bottom: -5px; left: var(--act-say-x, 30px); width: 10px; height: 10px; background: var(--act-raised); transform: rotate(45deg); box-shadow: 1px 1px 0 var(--act-rule); }

/* ---- main column --------------------------------------------------------- */
.act-main { grid-column: 2; grid-row: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.act-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 22px clamp(18px, 5%, 44px) 28px;
  scrollbar-width: thin;
  scrollbar-color: var(--act-rule) transparent;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px);
  mask-image: linear-gradient(to bottom, transparent 0, #000 22px);
}
.act-scroll:focus { outline: none; }
.act-thread { max-width: 780px; margin: 0 auto; }
.act-turn + .act-turn { margin-top: 34px; padding-top: 26px; border-top: 1px dashed var(--act-rule); }
.act-turn-head { display: flex; align-items: baseline; gap: 12px; }
.act-ask { margin: 8px 0 22px; font-size: 20px; font-weight: 700; line-height: 1.34; letter-spacing: -0.012em; color: var(--act-ink); overflow-wrap: anywhere; white-space: pre-wrap; }
.act-tiny .act-ask { font-size: 17px; }
.act-log { margin: 13px 0; font-size: 12px; line-height: 1.5; color: var(--act-faint); animation: act-in 0.4s ease both; }
.act-log-err { color: var(--act-warn); font-weight: 600; }
.act-kv { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 16px; row-gap: 4px; margin: 13px 0; animation: act-in 0.4s ease both; }
.act-namebtn { border-radius: 3px; text-decoration: underline transparent; text-underline-offset: 3px; transition: text-decoration-color 0.2s ease; }
.act-namebtn:hover { text-decoration-color: currentColor; }
.act-warnbtn { color: var(--act-warn); }
.act-warnbtn:hover { opacity: 0.7; }
.act-warns { margin: -4px 0 14px; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, var(--act-warn) 10%, transparent); font-size: 12.5px; line-height: 1.5; color: var(--act-ink); animation: act-in 0.3s ease both; }
.act-warns li + li { margin-top: 4px; }
.act-warns li::before { content: "!"; display: inline-block; width: 16px; font-family: var(--act-mono); font-weight: 800; color: var(--act-warn); }
.act-dots i { font-style: normal; }
.act-dots-live i { animation: act-blink 1.2s ease-in-out infinite; }
.act-dots-live i:nth-child(2) { animation-delay: 0.2s; }
.act-dots-live i:nth-child(3) { animation-delay: 0.4s; }
.act-hr { height: 1px; margin: 22px 0 16px; background: var(--act-ink); opacity: 0.85; }
.act-state { animation: act-in 0.45s ease both; }
.act-state-name { margin: 6px 0 10px; font-size: 34px; font-weight: 700; line-height: 1.1; letter-spacing: -0.028em; color: var(--act-ink); overflow-wrap: anywhere; }
.act-tiny .act-state-name { font-size: 27px; }
.act-instr { font-size: 14px; line-height: 1.62; color: var(--act-ink); opacity: 0.84; }
.act-instr-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.act-chip { padding: 1px 5px; border-radius: 3px; background: var(--act-sunk); font-family: var(--act-mono); font-size: 0.86em; font-weight: 700; color: var(--act-ink); -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.act-more { display: inline-block; margin-top: 9px; }
.act-steps { display: flex; flex-direction: column; gap: 5px; margin-top: 16px; font-family: var(--act-mono); font-size: 12px; line-height: 1.5; }
.act-step { display: flex; gap: 9px; min-width: 0; color: var(--act-muted); animation: act-in 0.35s ease both; overflow-wrap: anywhere; }
.act-step-cmd { color: var(--act-ink); font-weight: 700; }
.act-step-cmd .act-pr { color: var(--act-faint); font-weight: 400; }
.act-step-tool b { color: var(--act-ink); font-weight: 700; }
.act-step-fail { color: var(--act-warn); font-weight: 700; }
.act-step-pass { color: var(--act-ok); font-weight: 700; }
.act-step-write { color: var(--act-ink); }
.act-step-write em { font-style: normal; color: var(--act-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.act-step-note { font-family: var(--act-sans); color: var(--act-faint); }
.act-glyphs { flex: none; width: 14px; color: var(--act-faint); text-align: center; }
.act-check { display: flex; align-items: center; gap: 9px; padding: 1px 0; color: var(--act-ink); border-radius: 4px; }
.act-box { flex: none; width: 14px; height: 14px; display: grid; place-items: center; border-radius: 3px; border: 1.5px solid var(--act-ink); color: var(--act-surface); transition: background-color 0.2s ease; }
.act-check[aria-checked="true"] .act-box { background: var(--act-ink); }
.act-check[aria-checked="true"] .act-check-t { text-decoration: line-through; text-decoration-thickness: 1px; color: var(--act-faint); }
.act-check-n { color: var(--act-faint); }
.act-working { display: flex; gap: 4px; margin-top: 12px; height: 8px; align-items: center; }
.act-working i { width: 5px; height: 5px; border-radius: 50%; background: var(--act-faint); animation: act-blink 1s ease-in-out infinite; }
.act-working i:nth-child(2) { animation-delay: 0.15s; }
.act-working i:nth-child(3) { animation-delay: 0.3s; }
.act-past { border-top: 1px solid var(--act-rule); animation: act-in 0.4s ease both; }
.act-past-first { margin-top: 18px; }
.act-past-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 2px; font-family: var(--act-mono); font-size: 12px; color: var(--act-ink); }
.act-past-row > b { font-weight: 800; }
.act-past-meta { flex: 1; min-width: 0; color: var(--act-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-past-time { flex: none; color: var(--act-faint); }
.act-past-mark { color: var(--act-ok); }
.act-past-mark.act-badc { color: var(--act-warn); }
.act-past-row .act-chev { color: var(--act-faint); transform: rotate(180deg); transition: transform 0.3s var(--act-ease); }
.act-past-row[aria-expanded="true"] .act-chev { transform: rotate(270deg); }
.act-past .act-steps { margin: 0 0 12px 22px; }
.act-final-sum { font-size: 14px; line-height: 1.6; color: var(--act-ink); opacity: 0.84; max-width: 560px; }
.act-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.act-stat { padding: 7px 11px; border-radius: 8px; background: var(--act-raised); font-family: var(--act-mono); font-size: 11px; color: var(--act-muted); }
.act-stat b { display: block; font-size: 18px; font-weight: 800; color: var(--act-ink); letter-spacing: -0.02em; }
.act-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--act-ink);
  color: var(--act-surface);
  font-family: var(--act-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: transform 0.25s var(--act-ease), opacity 0.2s ease;
}
.act-btn:not(:disabled):hover { transform: translateY(-1px); }
.act-btn:active { transform: none; opacity: 0.85; }
.act-btn-ghost { background: transparent; color: var(--act-ink); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--act-ink) 35%, transparent); }
.act-btn-bad { background: var(--act-warn); color: var(--act-surface); }
.act-empty { padding-top: 6px; animation: act-in 0.4s ease both; }
.act-empty-sub { max-width: 540px; font-size: 14px; line-height: 1.6; color: var(--act-muted); }
.act-sugs { display: flex; flex-direction: column; gap: 8px; margin-top: 22px; max-width: 580px; }
.act-sug { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: color-mix(in srgb, var(--act-raised) 70%, transparent); box-shadow: inset 0 0 0 1px var(--act-rule); font-size: 13px; line-height: 1.45; color: var(--act-ink); transition: background-color 0.2s ease, transform 0.25s var(--act-ease); }
.act-sug span { flex: 1; }
.act-sug:hover { background: var(--act-raised); transform: translateX(3px); }
.act-empty-tips { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 26px; max-width: 580px; }
.act-tip { padding: 12px 14px; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--act-rule); font-size: 12px; line-height: 1.5; color: var(--act-muted); }
.act-tip b { display: block; margin-bottom: 3px; color: var(--act-ink); font-size: 12.5px; }

/* ---- composer ------------------------------------------------------------ */
.act-composer { flex: none; padding: 0 clamp(18px, 5%, 44px) 12px; }
.act-composer-in { max-width: 780px; margin: 0 auto; }
.act-crow { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 10px 0; border-bottom: 1px solid var(--act-rule); }
.act-crow-text { flex: 1; min-width: 0; font-size: 15px; color: var(--act-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-stop { flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; transition: background-color 0.2s ease; }
.act-stop:hover { background: var(--act-rule); }
.act-stop i { width: 12px; height: 12px; border-radius: 2px; background: var(--act-ink); }
.act-input { flex: 1; min-width: 0; height: 26px; max-height: 160px; resize: none; border: 0; outline: none; background: transparent; color: var(--act-ink); font-family: var(--act-sans); font-size: 15px; line-height: 1.6; padding: 0; }
.act-input::placeholder { color: var(--act-faint); opacity: 1; }
.act-send { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--act-ink); color: var(--act-surface); transition: opacity 0.2s ease, transform 0.25s var(--act-ease); }
.act-send:disabled { opacity: 0.28; }
.act-send:not(:disabled):hover { transform: translateY(-2px); }
.act-foot { display: flex; gap: 22px; padding-top: 10px; font-family: var(--act-mono); font-size: 10.5px; color: var(--act-faint); white-space: nowrap; }
.act-foot span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* ---- machine panel ------------------------------------------------------- */
.act-panel { grid-column: 3; grid-row: 1; display: flex; min-width: 0; overflow: hidden; border-left: 1px solid var(--act-rule); }
.act-root:not(.act-pn-on) .act-panel { border-left-color: transparent; }
.act-panel-in { flex: none; width: 348px; display: flex; flex-direction: column; min-height: 0; overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--act-rule) transparent; }
.act-ph { display: flex; align-items: center; gap: 10px; padding: 14px 12px 6px 22px; }
.act-ph .act-cap:first-child { flex: 1; }
.act-ph-status { display: flex; align-items: center; gap: 7px; color: var(--act-ink); font-weight: 700; }
.act-earlier { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 22px 2px; padding: 7px 10px; border-radius: 8px; background: var(--act-sunk); }
.act-graph-wrap { padding: 8px 10px 4px 8px; min-height: 92px; display: flex; align-items: center; }
.act-graph { width: 100%; height: auto; }
.act-edge { fill: none; stroke: var(--act-ink); stroke-opacity: 0.3; stroke-width: 0.9; transition: stroke-opacity 0.4s ease; }
.act-edge-cap { stroke-dasharray: 2 2.5; stroke-opacity: 0.2; }
.act-edge-on { stroke-opacity: 0.75; stroke-width: 1.15; }
.act-arrow { fill: var(--act-ink); fill-opacity: 0.4; }
.act-arrow-on { fill-opacity: 0.8; }
.act-init { fill: var(--act-ink); }
.act-node { cursor: pointer; }
.act-node:focus-visible { outline: none; }
.act-node-box { fill: var(--act-node); stroke: var(--act-ink); stroke-opacity: 0; stroke-width: 1; transition: fill 0.35s ease, stroke-opacity 0.35s ease; }
.act-node-t { font-family: var(--act-mono); font-weight: 700; fill: var(--act-ink); pointer-events: none; }
.act-node-final .act-node-box { fill: var(--act-raised); stroke-opacity: 0.7; }
.act-node-seen .act-node-box { stroke-opacity: 0.55; }
.act-node-cur .act-node-box { fill: var(--act-ink); stroke-opacity: 1; }
.act-node-cur .act-node-t { fill: var(--act-surface); }
.act-node:hover .act-node-box, .act-node:focus-visible .act-node-box { stroke-opacity: 1; stroke-width: 1.4; }
.act-node-sel .act-node-box { stroke-dasharray: 3 2; stroke-opacity: 1; stroke-width: 1.3; }
.act-node-pulse { fill: none; stroke: var(--act-ink); stroke-width: 1; transform-box: fill-box; transform-origin: center; animation: act-ring 1.6s ease-out infinite; }
.act-travel { fill: var(--act-ink); animation: act-travel 0.85s ease forwards; }
.act-skel rect { fill: none; stroke: var(--act-ink); stroke-opacity: 0.35; stroke-dasharray: 3 3; }
.act-skel-live rect { animation: act-blink 1.2s ease-in-out infinite; }
.act-skel-live rect:nth-child(2) { animation-delay: 0.15s; }
.act-skel-live rect:nth-child(3) { animation-delay: 0.3s; }
.act-skel-live rect:nth-child(4) { animation-delay: 0.45s; }
.act-gcap { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 6px 22px 18px; }
.act-gcap .act-mono-b { font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.act-gcap .act-link { flex: none; }
.act-rule { height: 1px; margin: 0 22px; background: var(--act-rule); }
.act-cur { padding: 16px 22px 20px; }
.act-cur-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.act-pstate { margin: 8px 0 6px; font-size: 24px; font-weight: 700; line-height: 1.15; letter-spacing: -0.024em; overflow-wrap: anywhere; }
.act-dl { display: grid; grid-template-columns: 92px minmax(0, 1fr); row-gap: 7px; margin: 14px 0 16px; align-items: baseline; }
.act-dl dd { font-family: var(--act-mono); font-size: 12px; font-weight: 700; color: var(--act-ink); overflow-wrap: anywhere; }
.act-ptext { margin-top: 7px; font-size: 12.5px; line-height: 1.6; color: var(--act-ink); opacity: 0.86; }
.act-store { flex: 1 0 auto; padding: 16px 22px 22px; background: var(--act-raised); }
.act-store-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.act-legend { display: flex; gap: 10px; }
.act-legend span { display: inline-flex; align-items: center; gap: 4px; }
.act-mk { display: inline-block; flex: none; width: 7px; height: 7px; background: var(--act-ink); }
.act-mk-agent { border-radius: 50%; }
.act-mk-observed { border-radius: 1px; }
.act-mk-set { border-radius: 50%; background: transparent; box-shadow: inset 0 0 0 1.5px var(--act-ink); }
.act-srow { border-bottom: 1px solid var(--act-rule); }
.act-srow:last-child { border-bottom: 0; }
.act-srow-line { display: flex; align-items: center; gap: 10px; min-height: 40px; font-family: var(--act-mono); font-size: 12px; }
.act-skey { min-width: 0; font-weight: 800; color: var(--act-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: 3px; }
.act-skey:disabled { opacity: 1; }
.act-sval { flex: 1; min-width: 0; text-align: right; color: var(--act-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-sval-true { color: var(--act-ok); font-weight: 800; }
.act-sval-false { color: var(--act-warn); font-weight: 800; }
.act-sval-new { animation: act-flash 1.3s ease; }
.act-sval-edit { flex: 0 1 auto; margin-left: auto; padding: 3px 6px; border-radius: 6px; color: var(--act-ink); text-decoration: underline dotted; text-underline-offset: 3px; transition: box-shadow 0.2s ease; }
.act-sval-edit:hover { box-shadow: inset 0 0 0 1px var(--act-ink); text-decoration: none; }
.act-sedit { flex: 1; min-width: 0; }
.act-sedit input { width: 100%; height: 28px; padding: 0 8px; border: 0; border-radius: 6px; outline: none; background: var(--act-surface); box-shadow: inset 0 0 0 1.5px var(--act-ink); font-family: var(--act-mono); font-size: 12px; text-align: right; }
.act-sfull { padding: 0 0 12px 17px; font-size: 12px; line-height: 1.55; color: var(--act-muted); overflow-wrap: anywhere; animation: act-in 0.3s ease both; }
.act-none { padding: 6px 22px 24px; font-size: 12.5px; line-height: 1.55; color: var(--act-faint); }

/* ---- drawers below the breakpoints --------------------------------------- */
.act-scrim { position: absolute; inset: 0; z-index: 5; background: rgba(0, 0, 0, 0.16); opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
.act-scrim-on { opacity: 1; pointer-events: auto; }
.act-tiny .act-side, .act-narrow .act-panel { position: absolute; top: 0; bottom: 0; z-index: 6; background: var(--act-surface); transition: transform 0.42s var(--act-ease); }
.act-tiny .act-side { left: 0; width: min(280px, 86%); grid-column: auto; grid-row: auto; border-right: 1px solid var(--act-rule); transform: translateX(-104%); }
.act-tiny .act-side-in { width: 100%; }
.act-tiny.act-sb-on .act-side { transform: none; box-shadow: 30px 0 60px -34px rgba(0, 0, 0, 0.5); }
.act-narrow .act-panel { right: 0; width: min(348px, 92%); grid-column: auto; grid-row: auto; border-left: 1px solid var(--act-rule); transform: translateX(104%); }
.act-narrow .act-panel-in { width: 100%; }
.act-narrow.act-pn-on .act-panel { transform: none; box-shadow: -30px 0 60px -34px rgba(0, 0, 0, 0.5); }
.act-tiny .act-bar-status { display: none; }
.act-tiny .act-brand span, .act-tiny .act-brand i { display: none; }

/* ---- settings popover ---------------------------------------------------- */
.act-pop {
  position: absolute;
  top: 46px;
  right: 10px;
  z-index: 20;
  width: 284px;
  max-height: calc(100% - 56px);
  overflow-y: auto;
  padding: 14px;
  border-radius: 12px;
  background: var(--act-raised);
  box-shadow: 0 0 0 1px var(--act-rule), 0 24px 50px -20px rgba(0, 0, 0, 0.45);
  animation: act-pop 0.28s var(--act-ease) both;
}
.act-pop .act-cap { display: block; margin: 14px 0 7px; }
.act-pop .act-cap:first-child { margin-top: 0; }
.act-swatches { display: grid; grid-template-columns: repeat(auto-fit, minmax(48px, 1fr)); gap: 6px; }
.act-sw { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 0 6px; border-radius: 9px; font-family: var(--act-mono); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--act-muted); }
.act-sw:hover { background: var(--act-rule); }
.act-sw[aria-pressed="true"] { background: var(--act-sunk); color: var(--act-ink); font-weight: 700; }
.act-sw i { width: 26px; height: 26px; border-radius: 50%; background: var(--act-sw-bg); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); display: grid; place-items: center; }
.act-sw i::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--act-sw-ink); }
.act-seg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 3px; border-radius: 9px; background: var(--act-rule); }
.act-seg button { height: 26px; border-radius: 7px; font-family: var(--act-mono); font-size: 11px; font-weight: 700; color: var(--act-muted); text-align: center; }
.act-seg button[aria-pressed="true"] { background: var(--act-surface); color: var(--act-ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
.act-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; font-size: 12.5px; color: var(--act-ink); }
.act-switch { flex: none; width: 34px; height: 20px; padding: 2px; border-radius: 999px; background: var(--act-rule); transition: background-color 0.25s ease; }
.act-switch i { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--act-surface); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); transition: transform 0.3s var(--act-ease); }
.act-switch[aria-checked="true"] { background: var(--act-ink); }
.act-switch[aria-checked="true"] i { transform: translateX(14px); }
.act-pop-note { font-size: 12px; line-height: 1.5; color: var(--act-muted); }
.act-pop-actions { display: flex; flex-direction: column; gap: 2px; }
.act-pop-actions button { display: flex; align-items: center; gap: 9px; height: 32px; padding: 0 8px; border-radius: 7px; font-size: 12.5px; color: var(--act-ink); }
.act-pop-actions button:not(:disabled):hover { background: var(--act-rule); }
.act-pop-actions .act-menu-bad { color: var(--act-warn); }
.act-keys { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; font-size: 12px; color: var(--act-muted); }
.act-keys kbd { justify-self: start; padding: 1px 6px; border-radius: 4px; box-shadow: inset 0 0 0 1px var(--act-rule); font-family: var(--act-mono); font-size: 10.5px; color: var(--act-ink); }

/* ---- machine viewer and editor ------------------------------------------- */
.act-modal-scrim {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: color-mix(in srgb, var(--act-ink) 22%, transparent);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  animation: act-fade 0.25s ease both;
}
.act-modal {
  width: min(920px, 100%);
  height: min(780px, 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  background: var(--act-surface);
  box-shadow: 0 0 0 1px var(--act-rule), 0 40px 90px -30px rgba(0, 0, 0, 0.55);
  animation: act-pop 0.32s var(--act-ease) both;
}
.act-modal-head { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px 10px 20px; border-bottom: 1px solid var(--act-rule); }
.act-modal-head .act-mono-b { font-size: 13px; }
.act-modal-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
.act-modal-graph { flex: none; max-height: 34%; padding: 14px 20px 6px; overflow: auto; }
.act-modal-graph .act-graph { min-width: 560px; }
.act-code-wrap { position: relative; flex: 1; min-height: 160px; border-top: 1px solid var(--act-rule); background: var(--act-raised); }
.act-code, .act-ta {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 14px 20px 22px 0;
  font-family: var(--act-mono);
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: 0;
  white-space: pre;
  tab-size: 2;
  overflow: auto;
}
.act-code { color: var(--act-ink); }
.act-code-ed { overflow: hidden; pointer-events: none; }
.act-ta {
  width: 100%;
  height: 100%;
  padding-left: 52px;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: transparent;
  -webkit-text-fill-color: transparent;
  caret-color: var(--act-ink);
}
.act-ta::selection { background: color-mix(in srgb, var(--act-ink) 22%, transparent); }
.act-code-line { display: block; min-height: 1.7em; }
.act-ln { display: inline-block; width: 52px; padding-right: 14px; text-align: right; color: var(--act-faint); opacity: 0.7; user-select: none; -webkit-user-select: none; }
.act-tk-kw { color: var(--act-crew); font-weight: 800; }
.act-tk-arrow { color: var(--act-warn); font-weight: 800; }
.act-tk-str { color: var(--act-ok); }
.act-tk-text { color: var(--act-muted); }
.act-tk-cmt { color: var(--act-faint); font-style: italic; }
.act-modal-foot { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px 10px 20px; border-top: 1px solid var(--act-rule); }
.act-modal-msg { flex: 1; min-width: 200px; max-height: 64px; overflow-y: auto; font-size: 12px; line-height: 1.5; }
.act-modal-msg li + li { margin-top: 2px; }

/* ---- toast --------------------------------------------------------------- */
.act-toast {
  position: absolute;
  left: 50%;
  bottom: 96px;
  z-index: 40;
  max-width: min(520px, calc(100% - 32px));
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--act-ink);
  color: var(--act-surface);
  font-size: 13px;
  line-height: 1.45;
  box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.5);
  transform: translateX(-50%);
  animation: act-toast 0.32s var(--act-ease) both;
}
.act-toast-bad { background: var(--act-warn); }

/* ---- motion -------------------------------------------------------------- */
@keyframes act-rot { to { transform: rotate(360deg); } }
@keyframes act-blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes act-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
@keyframes act-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes act-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes act-toast { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes act-ring { from { opacity: 0.6; transform: scale(1); } to { opacity: 0; transform: scale(1.22, 1.6); } }
@keyframes act-travel { 0% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes act-flash { 0% { opacity: 0; transform: translateX(8px); color: var(--act-ok); } 55% { opacity: 1; transform: none; color: var(--act-ok); } }
@keyframes act-breathe { 0%, 100% { transform: none; } 50% { transform: translateY(-0.6px) scaleY(1.012); } }
@keyframes act-hop { 0%, 100% { transform: none; } 40% { transform: translateY(-6px); } }
@keyframes act-orb { 0%, 100% { fill: var(--act-surface); } 50% { fill: #f2c14e; } }
@keyframes act-twinkle { 0%, 100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1); } }
@keyframes act-glyph { 0% { transform: scale(1.7); opacity: 0.3; } 100% { transform: none; opacity: 1; } }
@keyframes act-flap-l { from { transform: rotate(0deg); } to { transform: rotate(-9deg); } }
@keyframes act-flap-r { from { transform: rotate(0deg); } to { transform: rotate(9deg); } }

@media (prefers-reduced-motion: reduce) {
  .act-root *, .act-root *::before, .act-root *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0s !important;
    transition-duration: 0.001ms !important;
  }
}
`

/* ------------------------------------------------------------------------ */
/* Small parts                                                               */
/* ------------------------------------------------------------------------ */

type IconName =
  | "chevron"
  | "sidebar"
  | "panel"
  | "sliders"
  | "plus"
  | "close"
  | "arrow"
  | "check"
  | "copy"
  | "search"
  | "dots"
  | "download"
  | "upload"
  | "edit"
  | "trash"

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className="act-svg" aria-hidden="true">
      {name === "chevron" && <path d="M10 3.5 5.5 8l4.5 4.5" {...p} />}
      {name === "sidebar" && (
        <>
          <rect x="2.5" y="3.5" width="11" height="9" rx="2" {...p} />
          <path d="M6.5 3.8v8.4" {...p} />
        </>
      )}
      {name === "panel" && (
        <>
          <rect x="2.5" y="3.5" width="11" height="9" rx="2" {...p} />
          <path d="M9.5 3.8v8.4" {...p} />
        </>
      )}
      {name === "sliders" && (
        <>
          <path d="M2.5 5.5h11M2.5 10.5h11" {...p} />
          <circle cx="6" cy="5.5" r="1.7" fill="var(--act-surface)" stroke="currentColor" strokeWidth={1.6} />
          <circle cx="10.5" cy="10.5" r="1.7" fill="var(--act-surface)" stroke="currentColor" strokeWidth={1.6} />
        </>
      )}
      {name === "plus" && <path d="M8 3v10M3 8h10" {...p} />}
      {name === "close" && <path d="M4 4l8 8M12 4l-8 8" {...p} />}
      {name === "arrow" && <path d="M8 13V3.5M4 7l4-4 4 4" {...p} />}
      {name === "check" && <path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...p} strokeWidth={2} />}
      {name === "copy" && (
        <>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" {...p} />
          <path d="M10.5 3.2V3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h.2" {...p} />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="7" cy="7" r="4.2" {...p} />
          <path d="M10.2 10.2 13.5 13.5" {...p} />
        </>
      )}
      {name === "dots" && (
        <>
          <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
        </>
      )}
      {name === "download" && <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" {...p} />}
      {name === "upload" && <path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10" {...p} />}
      {name === "edit" && <path d="M10.5 3 13 5.5 6 12.5H3.5V10Z" {...p} />}
      {name === "trash" && <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" {...p} />}
    </svg>
  )
}

/** The default mark: a small cairn of three stones. */
function CairnMark() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} className="act-svg" aria-hidden="true">
      <ellipse cx="12" cy="18.6" rx="8.4" ry="3.4" fill="currentColor" />
      <ellipse cx="11.3" cy="12.6" rx="5.9" ry="2.9" fill="currentColor" opacity="0.78" />
      <ellipse cx="12.4" cy="7.6" rx="3.7" ry="2.3" fill="currentColor" opacity="0.58" />
      <circle cx="12.9" cy="3.6" r="1.4" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

type Tone = "spin" | "wait" | "ok" | "bad" | "idle"

function statusOf(run: Run | null | undefined): { label: string; short: string; tone: Tone } {
  if (!run) return { label: "New session", short: "Idle", tone: "idle" }
  switch (run.phase) {
    case "deciding":
    case "authored":
      return { label: "Authoring", short: "Authoring", tone: "spin" }
    case "awaiting":
      return { label: "Awaiting approval", short: "Awaiting", tone: "wait" }
    case "running":
      return { label: run.current ?? "Running", short: "Running", tone: "spin" }
    case "stopped":
      return { label: run.current ? "Stopped in " + run.current : "Stopped", short: "Stopped", tone: "idle" }
    case "done":
      return { label: "Done", short: "Finished", tone: "ok" }
    case "abandoned":
      return { label: "Abandoned", short: "Abandoned", tone: "bad" }
    case "declined":
      return { label: "Declined", short: "Declined", tone: "bad" }
  }
}

function Mark({ tone }: { tone: Tone }) {
  if (tone === "spin") return <span className="act-spin" aria-hidden="true" />
  if (tone === "ok")
    return (
      <span className="act-mark act-mark-ok" aria-hidden="true">
        <Icon name="check" size={11} />
      </span>
    )
  if (tone === "bad")
    return (
      <span className="act-mark act-mark-bad" aria-hidden="true">
        <Icon name="close" size={10} />
      </span>
    )
  return <span className={"act-mark act-mark-" + tone} aria-hidden="true" />
}

function Dots({ live }: { live: boolean }) {
  return (
    <span className={"act-dots" + (live ? " act-dots-live" : "")} aria-hidden="true">
      <i>.</i>
      <i>.</i>
      <i>.</i>
    </span>
  )
}

function Rich({ text, keys }: { text: string; keys: string[] }) {
  return (
    <>
      {splitCode(text, keys).map((part, i) =>
        part.code ? (
          <code key={i} className="act-chip">
            {part.text}
          </code>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </>
  )
}

const TOOL_VERB = /^(read|write|patch|search|note|outline|trace|attach|post|wire|add|source|tighten|scan|count|check|find|list)\b/

function StepLine({ text, checked, onToggle }: { text: string; checked: boolean | undefined; onToggle: (next: boolean) => void }) {
  const kind = lineKind(text)
  if (kind === "cmd") {
    return (
      <li className="act-step act-step-cmd">
        <span className="act-glyphs act-pr">$</span>
        <span>{text.slice(2)}</span>
      </li>
    )
  }
  if (kind === "check") {
    const on = checked ?? /^\[[xX]\]/.test(text)
    const body = text.replace(/^\[[ xX]\]\s*/, "")
    const m = body.match(/^(\d+)\s+(.*)$/)
    return (
      <li className="act-step">
        <span className="act-glyphs" />
        <button type="button" role="checkbox" aria-checked={on} className="act-check" onClick={() => onToggle(!on)}>
          <span className="act-box">{on && <Icon name="check" size={10} />}</span>
          {m && <span className="act-check-n">{m[1]}</span>}
          <span className="act-check-t">{m ? m[2] : body}</span>
        </button>
      </li>
    )
  }
  if (kind === "tool") {
    const verb = (text.match(TOOL_VERB) ?? [""])[0]
    return (
      <li className="act-step act-step-tool">
        <span className="act-glyphs">{"→"}</span>
        <span>
          <b>{verb}</b>
          {text.slice(verb.length)}
        </span>
      </li>
    )
  }
  return (
    <li className={"act-step act-step-" + kind}>
      <span className="act-glyphs">{kind === "fail" ? "×" : kind === "pass" ? "✓" : "·"}</span>
      <span>{text}</span>
    </li>
  )
}

function secs(ms: number): string {
  if (!(ms >= 0)) return ""
  if (ms < 60000) return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + "s"
  const m = Math.floor(ms / 60000)
  return m + "m " + Math.round((ms % 60000) / 1000) + "s"
}

function clock(t: number | undefined): string {
  if (!t) return ""
  try {
    return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

/* ------------------------------------------------------------------------ */
/* The crew                                                                  */
/* ------------------------------------------------------------------------ */

const CREW = [
  {
    name: "The Seer",
    role: "writes the machines",
    lines: [
      "Every task wants a shape. Most of them want about seven states.",
      "I only write the plan. Keeping it is somebody else’s job.",
      "Anything that can loop gets a cap. The Warden insists.",
    ],
  },
  {
    name: "The Menhir",
    role: "keeps the store",
    lines: [
      "Write it to the store or it did not happen.",
      "I remember what is written down. Nothing more.",
      "Values come and go. I stay exactly where I am.",
    ],
  },
  {
    name: "The Warden",
    role: "watches the checks",
    lines: [
      "Nothing runs until you approve it.",
      "I trust a passing check. The second one, especially.",
      "I count every visit. Three, and we stop.",
    ],
  },
]

function crewLine(who: number, run: Run | null, n: number): string {
  const ctx: string[] = []
  if (run) {
    const m = run.machine.name
    if (who === 0) {
      if (run.phase === "deciding" || run.phase === "authored") ctx.push("Hold on. I am drawing the states.")
      else if (run.phase === "awaiting") ctx.push(m + " is written. It waits on you, not me.")
    } else if (who === 1) {
      const k = Object.keys(run.store).length
      if (k) ctx.push("Holding " + k + (k === 1 ? " value" : " values") + " for " + (m || "this session") + ".")
    } else {
      if (run.phase === "awaiting") ctx.push("Read it first. Then approve it.")
      else if (run.phase === "running" && run.current && /verif|check|test|critique|review|audit/i.test(run.current)) ctx.push("Checking. Do not rush me.")
      else if (run.phase === "done") ctx.push("Every check passed. I am almost pleased.")
    }
  } else if (who === 0) ctx.push("Ask for something. I will draw you a machine.")
  const all = [...ctx, ...CREW[who].lines]
  return all[n % all.length]
}

function Crew({
  uid,
  mood,
  writes,
  pupilRef,
  onSay,
  children,
}: {
  uid: string
  mood: string
  writes: number
  pupilRef: React.RefObject<SVGCircleElement>
  onSay: (who: number) => void
  children?: React.ReactNode
}) {
  const hatch = "url(#" + uid + "-hatch)"
  const line = { fill: "none", stroke: "var(--act-crew)", strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  const solid = (fill: string) => ({ ...line, fill })
  return (
    <div className={"act-crew act-mood-" + mood}>
      {children}
      <svg width="0" height="0" className="act-svg" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <pattern id={uid + "-hatch"} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <rect width="3" height="3" style={{ fill: "var(--act-surface)" }} />
            <path d="M0.75 0V3" style={{ stroke: "var(--act-crew)" }} strokeWidth="0.75" />
          </pattern>
        </defs>
      </svg>

      <button type="button" className="act-fig" aria-label={CREW[0].name + ", who " + CREW[0].role} onClick={() => onSay(0)}>
        <svg viewBox="0 0 40 64" className="act-svg" aria-hidden="true">
          <g className="act-fig-body">
            <path d="M5 61.5h28" {...line} strokeWidth={2.2} />
            <path d="M15.2 23.6c1.6-1.5 7.8-1.5 9.6 0l3.6 36.6H11.4Z" {...solid(hatch)} />
            <path d="M12 56.6h16.6" {...line} />
            <path d="M15.4 24.2c-.9-6.2 1.3-11.4 4.8-11.4s5.7 5.2 4.8 11.4" {...solid("var(--act-surface)")} />
            <ellipse cx="20.2" cy="19" rx="2.5" ry="3.1" {...solid("var(--act-surface)")} />
            <path d="M24.2 27.8c2.6 1.5 4.7 3.3 6.3 5" {...line} />
            <circle cx="30.8" cy="33.2" r="1.3" {...solid("var(--act-surface)")} />
            <path d="M31.6 9.6v51.4" {...line} strokeWidth={1.5} />
            <circle className="act-orb" cx="31.6" cy="7.4" r="2.5" {...line} style={{ fill: "var(--act-surface)" }} />
            <path className="act-spark" d="M35.6 1.8l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z" fill="var(--act-crew)" />
          </g>
        </svg>
      </button>

      <button type="button" className="act-fig" aria-label={CREW[1].name + ", who " + CREW[1].role} onClick={() => onSay(1)}>
        <svg viewBox="0 0 40 64" className="act-svg" aria-hidden="true">
          <g className="act-fig-body">
            <path d="M5 61.5h30" {...line} strokeWidth={2.2} />
            <path d="M11.4 60.6 13 18.8C13.4 9.2 16.9 4.6 20.2 4.6s6.8 4.6 7.2 14.2l1.6 41.8Z" {...solid("var(--act-crew-fill)")} />
            <path d="M23.8 22.5v33.5M26.2 31v24" {...line} strokeWidth={0.7} opacity={0.55} />
            <path d="M15.8 33.5l2.1 3-1.1 4.2" {...line} strokeWidth={0.8} />
            <path d="M12.4 58.4c1-1.6 2.2-1.6 3.2 0M24.6 58.6c1-1.5 2.2-1.5 3.2 0" {...line} strokeWidth={0.9} />
            <g key={"g" + writes} className={"act-glyph" + (writes ? " act-glyph-pulse" : "")}>
              <circle cx="20.2" cy="12.5" r="2.3" {...line} strokeWidth={1.1} />
              <path d="M17.6 12.5h5.2M20.2 16.4v3" {...line} strokeWidth={1.1} />
            </g>
          </g>
        </svg>
      </button>

      <button type="button" className="act-fig" aria-label={CREW[2].name + ", who " + CREW[2].role} onClick={() => onSay(2)}>
        <svg viewBox="0 0 40 64" className="act-svg" aria-hidden="true">
          <g className="act-fig-body">
            <path d="M5 61.5h30" {...line} strokeWidth={2.2} />
            <path className="act-wing-l" d="M17 30.5C9 28.5 4.4 35.5 4.8 45.2c.4 8.8 5.2 13.8 11.4 14.2Z" {...solid(hatch)} />
            <path className="act-wing-r" d="M23 30.5c8-2 12.6 5 12.2 14.7-.4 8.8-5.2 13.8-11.4 14.2Z" {...solid(hatch)} />
            <path d="M16.8 30.6c1.2-2.2 5.2-2.2 6.4 0l1.4 29.2h-9.2Z" {...solid("var(--act-surface)")} />
            <path d="M18.4 59.8v1.6M21.6 59.8v1.6" {...line} />
            <path d="M15.6 17 12.6 12.6M24.4 17l3-4.4M20 15.2v-4.6" {...line} />
            <circle cx="12.4" cy="12.2" r="1" fill="var(--act-crew)" />
            <circle cx="27.6" cy="12.2" r="1" fill="var(--act-crew)" />
            <circle cx="20" cy="10.2" r="1" fill="var(--act-crew)" />
            <circle cx="20" cy="22" r="7" {...solid("var(--act-surface)")} />
            <circle cx="20" cy="22" r="3.4" {...solid("var(--act-raised)")} strokeWidth={1.1} />
            <circle ref={pupilRef} cx="20" cy="22" r="1.6" fill="var(--act-crew)" />
            <path className="act-lid" d="M16.6 18.9h6.8v3.2h-6.8Z" fill="var(--act-surface)" />
          </g>
        </svg>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* The state graph                                                           */
/* ------------------------------------------------------------------------ */

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function MachineGraph({
  layout,
  run,
  uid,
  big,
  selected,
  reduced,
  onSelect,
  onHover,
}: {
  layout: GraphLayout
  run: Run
  uid: string
  big?: boolean
  selected: string | null
  reduced: boolean
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
}) {
  const walked = React.useMemo(() => {
    const s = new Set<string>()
    for (const e of run.events) if (e.kind === "leave") s.add(e.state + ">" + e.to)
    return s
  }, [run.events])
  const edge = run.edge
  const travel = edge ? layout.edges.find((e) => e.from === edge.from && e.to === edge.to) : undefined
  const motion = React.useRef<SVGAnimateMotionElement>(null)
  useIsoLayoutEffect(() => {
    try {
      motion.current?.beginElement()
    } catch {
      /* SMIL unavailable: the dot just stays hidden */
    }
  }, [run.id, run.transitions])

  const arrow = uid + (big ? "-ab" : "-am")
  const fs = big ? 10 : 8.4
  const label = (id: string) => (big || id.length <= 10 ? id : id.slice(0, 9) + "…")
  const first = layout.nodes.find((n) => n.id === run.machine.states[0]?.id)

  return (
    <svg
      className="act-svg act-graph"
      viewBox={"0 0 " + layout.width + " " + layout.height}
      width={layout.width}
      height={layout.height}
      role="group"
      aria-label={"State graph for " + run.machine.name}
    >
      <defs>
        <marker id={arrow} viewBox="0 0 6 6" refX="5.6" refY="3" markerWidth="4.6" markerHeight="4.6" orient="auto">
          <path d="M0 .6 5.8 3 0 5.4Z" className="act-arrow" />
        </marker>
        <marker id={arrow + "-on"} viewBox="0 0 6 6" refX="5.6" refY="3" markerWidth="4.6" markerHeight="4.6" orient="auto">
          <path d="M0 .6 5.8 3 0 5.4Z" className="act-arrow act-arrow-on" />
        </marker>
      </defs>
      {layout.edges.map((e) => {
        const on = walked.has(e.from + ">" + e.to)
        return (
          <path
            key={e.from + ">" + e.to + ":" + e.kind}
            d={e.d}
            className={"act-edge" + (on ? " act-edge-on" : "") + (e.kind === "cap" ? " act-edge-cap" : "")}
            markerEnd={"url(#" + (on ? arrow + "-on" : arrow) + ")"}
          />
        )
      })}
      {first && (
        <>
          <circle cx={first.x - 9} cy={first.y + first.h / 2} r={big ? 2.6 : 2} className="act-init" />
          <path d={"M" + (first.x - 7) + " " + (first.y + first.h / 2) + "H" + first.x} className="act-edge" />
        </>
      )}
      {layout.nodes.map((n) => {
        const cur = run.current === n.id
        const seen = (run.visits[n.id] ?? 0) > 0
        const cls =
          "act-node" +
          (cur ? " act-node-cur" : seen ? " act-node-seen" : "") +
          (n.final ? " act-node-final" : "") +
          (selected === n.id ? " act-node-sel" : "")
        const pick = () => onSelect(n.id)
        return (
          <g
            key={n.id}
            className={cls}
            role="button"
            tabIndex={0}
            aria-pressed={selected === n.id}
            aria-label={
              n.id +
              (cur ? ", current state" : "") +
              (seen ? ", visited " + run.visits[n.id] + (run.visits[n.id] === 1 ? " time" : " times") : "")
            }
            onClick={pick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                pick()
              }
            }}
            onPointerEnter={() => onHover?.(n.id)}
            onPointerLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(n.id)}
            onBlur={() => onHover?.(null)}
          >
            {cur && run.phase === "running" && !reduced && (
              <rect className="act-node-pulse" x={n.x} y={n.y} width={n.w} height={n.h} rx={n.final ? n.h / 2 : big ? 6 : 3.5} />
            )}
            <rect className="act-node-box" x={n.x} y={n.y} width={n.w} height={n.h} rx={n.final ? n.h / 2 : big ? 6 : 3.5} />
            <text className="act-node-t" x={n.x + n.w / 2} y={n.y + n.h / 2} style={{ fontSize: fs }} textAnchor="middle" dominantBaseline="central">
              {label(n.id)}
            </text>
            <title>{n.id}</title>
          </g>
        )
      })}
      {travel && !reduced && (
        <circle key={run.id + ":" + run.transitions} r={big ? 3.4 : 2.6} className="act-travel">
          <animateMotion ref={motion} begin="indefinite" dur="0.8s" fill="freeze" path={travel.d} />
        </circle>
      )}
    </svg>
  )
}

function Skeleton({ live }: { live: boolean }) {
  return (
    <svg viewBox="0 0 300 70" className={"act-svg act-graph act-skel" + (live ? " act-skel-live" : "")} aria-hidden="true">
      <rect x="14" y="27" width="58" height="16" rx="3.5" />
      <rect x="86" y="27" width="58" height="16" rx="3.5" />
      <rect x="158" y="27" width="58" height="16" rx="3.5" />
      <rect x="230" y="15" width="56" height="16" rx="8" />
      <rect x="230" y="40" width="56" height="16" rx="8" />
    </svg>
  )
}

function SourceLine({ line }: { line: string }) {
  const trimmed = line.trimStart()
  if (trimmed.charAt(0) === "|") {
    const at = line.indexOf("|")
    return (
      <>
        {line.slice(0, at)}
        <span className="act-tk-arrow">|</span>
        <span className="act-tk-text">{line.slice(at + 1)}</span>
      </>
    )
  }
  if (trimmed.charAt(0) === "#") return <span className="act-tk-cmt">{line}</span>
  const parts = line.split(/("[^"]*"|->|\b(?:machine|max visits|store|initial|state|final|failure|success|writes|when|otherwise|prompt|agent|observed|set)\b)/)
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null
        if (i % 2 === 0) return <React.Fragment key={i}>{p}</React.Fragment>
        const cls = p === "->" ? "act-tk-arrow" : p.charAt(0) === '"' ? "act-tk-str" : "act-tk-kw"
        return (
          <span key={i} className={cls}>
            {p}
          </span>
        )
      })}
    </>
  )
}

function SourceLines({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <code>
      {lines.map((l, i) => (
        <span key={i} className="act-code-line">
          <span className="act-ln">{i + 1}</span>
          <SourceLine line={l} />
        </span>
      ))}
    </code>
  )
}

/* ------------------------------------------------------------------------ */
/* Transcript model                                                          */
/* ------------------------------------------------------------------------ */

type LeaveEvent = Extract<RunEvent, { kind: "leave" }>
type FinishEvent = Extract<RunEvent, { kind: "finish" }>
type Row = { ev: RunEvent; i: number }
type VisitItem = {
  t: "visit"
  key: string
  state: string
  visit: number
  at: number | undefined
  rows: Row[]
  leave: LeaveEvent | null
  finish: FinishEvent | null
}
type LineItem = { t: "line"; key: string; ev: RunEvent; i: number }

function buildItems(events: RunEvent[]): (VisitItem | LineItem)[] {
  const out: (VisitItem | LineItem)[] = []
  let cur: VisitItem | null = null
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    if (ev.kind === "enter") {
      cur = { t: "visit", key: "v" + i, state: ev.state, visit: ev.visit, at: ev.t, rows: [], leave: null, finish: null }
      out.push(cur)
      continue
    }
    if (cur && !cur.leave) {
      if (ev.kind === "leave") {
        cur.leave = ev
        continue
      }
      if (ev.kind === "finish") {
        cur.finish = ev
        continue
      }
      if (ev.kind === "step" || ev.kind === "write" || ev.kind === "input" || ev.kind === "stopped" || ev.kind === "resumed" || ev.kind === "error") {
        cur.rows.push({ ev, i })
        continue
      }
    }
    out.push({ t: "line", key: "l" + i, ev, i })
  }
  return out
}

/** Time-stamps the events a change added. */
function stamp(prev: Run, next: Run, now: number): Run {
  if (next === prev || next.events.length <= prev.events.length) return next
  const from = prev.events.length
  return { ...next, events: next.events.map((e, i) => (i >= from && e.t === undefined ? { ...e, t: now } : e)) }
}

function stampAll(run: Run, now: number): Run {
  return { ...run, events: run.events.map((e) => (e.t === undefined ? { ...e, t: now } : e)) }
}

function summaries(runs: Run[], upTo: Run): TurnSummary[] {
  const out: TurnSummary[] = []
  for (const r of runs) {
    if (r.id === upTo.id) break
    if (r.session === upTo.session) out.push({ prompt: r.prompt, machine: r.machine.name, phase: r.phase, store: { ...r.store } })
  }
  return out
}

/* ------------------------------------------------------------------------ */
/* The template                                                              */
/* ------------------------------------------------------------------------ */

export interface AgentConsoleTemplateProps {
  /** Product name in the title bar. Also names the source format (Cairn → .cairn). */
  brand?: string
  /** Replaces the cairn mark next to the brand */
  logo?: React.ReactNode
  /** Project shown after the brand */
  project?: string
  /** Working directory in the footer */
  cwd?: string
  /** Custom navigation or mode pills rendered in the header bar */
  headerCenter?: React.ReactNode
  /** Custom actions rendered on the right side of the header bar */
  headerRight?: React.ReactNode
  /** When a custom workspace view is active, it replaces or overlays the main transcript area */
  activeWorkspace?: string
  /** Map of workspace ID to content node (e.g. telemetry, setup, strategy, live) */
  workspaces?: Record<string, React.ReactNode>
  /** Sessions to start with when nothing is saved yet. An empty list opens on a blank session. */
  sessions?: SessionSeed[]
  /** Writes a machine for a new prompt. May be async. Defaults to a built-in seven-state planner. */
  planner?: Planner
  /** Runs one state for real. Leave it out to play the machines' scripted steps instead. */
  executor?: StateExecutor
  /** One-click prompts on a blank session */
  suggestions?: string[]
  /** A built-in theme, or your own palette (missing keys fall back to sage) */
  theme?: AgentConsoleThemeName | Partial<AgentConsolePalette>
  /** Simulation playback speed, 1 = real-ish time */
  speed?: number
  /** Skip the approval step */
  autoApprove?: boolean
  /** Show the three crew members in the sidebar */
  crew?: boolean
  /** localStorage key sessions and settings are saved under. `null` keeps nothing between visits. */
  storageKey?: string | null
  /** Start with the machine panel open (on wide screens) */
  defaultPanelOpen?: boolean
  /** Definite height for the whole app. Never a percentage. */
  height?: string
  minHeight?: string | number
  onSend?: (prompt: string, sessionId: string) => void
  onApprove?: (run: Run) => void
  onFinish?: (result: { id: string; session: string; prompt: string; machine: string; outcome: "done" | "abandoned" }) => void
  className?: string
}

const DEFAULT_SESSIONS: SessionSeed[] = [
  { id: "todo-cli", prompt: TODO_PROMPT, machine: TODO_MACHINE, status: "running" },
  {
    id: "launch-checklist",
    prompt: "Draft a launch checklist for the v2 pricing page, then review it against our analytics events.",
    status: "awaiting",
  },
  { id: "incident-brief", prompt: "Summarise this week’s incident reports into a one-page brief.", status: "done" },
]

const DEFAULT_SUGGESTIONS = [
  "Build a CLI that renames photos by the date they were taken.",
  "Fix the flaky checkout test and prove it passes ten times in a row.",
  "Research three ways to cache our API and recommend one.",
]

const SPEEDS = [0.5, 1, 2, 4]

function seedAll(seeds: SessionSeed[], planner: Planner | undefined): { sessions: Session[]; runs: Run[] } {
  const sessions: Session[] = []
  const runs: Run[] = []
  seeds.forEach((seed, i) => {
    const sid = seed.id ?? "session-" + i
    sessions.push({ id: sid, title: seed.title ?? "", created: 0 })
    if (!seed.prompt) return
    const rid = sid + "-1"
    if (seed.machine || !planner) runs.push(seedRun(rid, sid, seed, planMachine))
    else runs.push(createRun(rid, sid, seed.prompt, EMPTY_MACHINE, true))
  })
  if (!sessions.length) sessions.push({ id: "session-new", title: "", created: 0 })
  return { sessions, runs }
}

function titleOf(s: Session, runs: Run[]): string {
  if (s.title) return s.title
  const first = runs.find((r) => r.session === s.id)
  return first ? first.prompt.replace(/\s+/g, " ") : "New session"
}

function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === "string" ? err : "Something went wrong."
}

export default function AgentConsoleTemplate({
  brand = "ApexWall",
  logo,
  project = "telemetry",
  cwd = "~/sim-racing/motec",
  headerCenter,
  headerRight,
  activeWorkspace = "console",
  workspaces,
  sessions,
  planner,
  executor,
  suggestions = DEFAULT_SUGGESTIONS,
  theme = "apex",
  speed = 1,
  autoApprove = false,
  crew = true,
  storageKey = "agent-console-template",
  defaultPanelOpen = true,
  height = "100svh",
  minHeight = 560,
  onSend,
  onApprove,
  onFinish,
  className,
}: AgentConsoleTemplateProps) {
  const uid = "act" + React.useId().replace(/[^A-Za-z0-9_-]/g, "")
  const ext = "." + (brand.toLowerCase().replace(/[^a-z0-9]+/g, "") || "machine")
  const live = typeof executor === "function"
  const plannerRef = React.useRef(planner)
  plannerRef.current = planner
  const executorRef = React.useRef(executor)
  executorRef.current = executor
  const callbacks = React.useRef({ onSend, onApprove, onFinish })
  callbacks.current = { onSend, onApprove, onFinish }

  // ---- data ----------------------------------------------------------------------
  const init = React.useRef<{ sessions: Session[]; runs: Run[] } | null>(null)
  if (!init.current) init.current = seedAll(sessions ?? DEFAULT_SESSIONS, planner)
  const [sessionList, setSessionList] = React.useState<Session[]>(init.current.sessions)
  const [runs, setRuns] = React.useState<Run[]>(init.current.runs)
  const [activeId, setActiveId] = React.useState("")

  // ---- preferences -----------------------------------------------------------------
  const custom = typeof theme === "object" ? theme : null
  const [themeKey, setThemeKey] = React.useState<AgentConsoleThemeName | "custom">(custom ? "custom" : (theme as AgentConsoleThemeName))
  const [speedNow, setSpeedNow] = React.useState(speed)
  const [autoNow, setAutoNow] = React.useState(autoApprove)
  const [crewOn, setCrewOn] = React.useState(crew)
  const [sbOpen, setSbOpen] = React.useState(true)
  const [pnOpen, setPnOpen] = React.useState(defaultPanelOpen)
  const swatches: (AgentConsoleThemeName | "custom")[] = custom ? ["custom", ...THEME_NAMES] : THEME_NAMES
  const pal: AgentConsolePalette = themeKey === "custom" ? { ...THEMES.sage, ...(custom ?? {}) } : THEMES[themeKey] ?? THEMES.sage

  // ---- layout ----------------------------------------------------------------------
  const [sbDrawer, setSbDrawer] = React.useState(false)
  const [pnDrawer, setPnDrawer] = React.useState(false)
  const [narrow, setNarrow] = React.useState(false)
  const [tiny, setTiny] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const sbShown = tiny ? sbDrawer : sbOpen
  const pnShown = narrow ? pnDrawer : pnOpen

  // ---- view state ------------------------------------------------------------------
  const [draft, setDraft] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [focusId, setFocusId] = React.useState<string | null>(null)
  const [inspect, setInspect] = React.useState<string | null>(null)
  const [hoverNode, setHoverNode] = React.useState<string | null>(null)
  const [whole, setWhole] = React.useState(false)
  const [warnOpen, setWarnOpen] = React.useState<Record<string, boolean>>({})
  const [openRows, setOpenRows] = React.useState<Record<string, boolean>>({})
  const [checks, setChecks] = React.useState<Record<string, boolean>>({})
  const [storeOpen, setStoreOpen] = React.useState<string | null>(null)
  const [editKey, setEditKey] = React.useState<string | null>(null)
  const [editVal, setEditVal] = React.useState("")
  const [menuFor, setMenuFor] = React.useState<string | null>(null)
  const [renaming, setRenaming] = React.useState<{ id: string; text: string } | null>(null)
  const [tweaksOpen, setTweaksOpen] = React.useState(false)
  const [clearArmed, setClearArmed] = React.useState(false)
  const [modal, setModal] = React.useState<{ runId: string; edit: boolean } | null>(null)
  const [src, setSrc] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [toast, setToast] = React.useState<{ text: string; bad: boolean; n: number } | null>(null)
  const [say, setSay] = React.useState<{ who: number; text: string } | null>(null)
  const [reduced, setReduced] = React.useState(false)
  const [isMac, setIsMac] = React.useState(true)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const popRef = React.useRef<HTMLDivElement>(null)
  const tweakBtnRef = React.useRef<HTMLButtonElement>(null)
  const modalCloseRef = React.useRef<HTMLButtonElement>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const hlRef = React.useRef<HTMLPreElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const pupilRef = React.useRef<SVGCircleElement>(null)
  const skipBlur = React.useRef(false)
  const stick = React.useRef(true)
  const seq = React.useRef(0)
  const timers = React.useRef({ say: 0, copy: 0, toast: 0, clear: 0 })
  const sayCount = React.useRef([0, 0, 0])
  const eyeFrame = React.useRef(0)

  const freshId = (prefix: string) => prefix + "-" + Date.now().toString(36) + "-" + ++seq.current

  // ---- derived ---------------------------------------------------------------------
  const active = sessionList.find((s) => s.id === activeId) ?? sessionList[0] ?? null
  const turns = React.useMemo(() => (active ? runs.filter((r) => r.session === active.id) : []), [runs, active])
  const latest = turns.length ? turns[turns.length - 1] : null
  const focusRun = (focusId && turns.find((r) => r.id === focusId)) || latest
  const latestOf = React.useMemo(() => {
    const map = new Map<string, Run>()
    for (const r of runs) map.set(r.session, r)
    return map
  }, [runs])

  const commit = React.useCallback((id: string, fn: (r: Run) => Run) => {
    const now = Date.now()
    setRuns((prev) => prev.map((r) => (r.id === id ? stamp(r, fn(r), now) : r)))
  }, [])

  const notify = React.useCallback((text: string, bad = false) => {
    window.clearTimeout(timers.current.toast)
    setToast((t) => ({ text, bad, n: (t ? t.n : 0) + 1 }))
    timers.current.toast = window.setTimeout(() => setToast(null), 2800)
  }, [])

  // ---- persistence -----------------------------------------------------------------
  // Loaded before the first paint on the client, so a saved session never flashes the demo content.
  useIsoLayoutEffect(() => {
    if (storageKey) {
      let snap: Snapshot | null = null
      try {
        snap = readSnapshot(window.localStorage.getItem(storageKey))
      } catch {
        snap = null
      }
      if (snap && snap.sessions.length) {
        const p = snap.prefs
        // A live run cannot pick up a promise from before the reload: hold it at a stop you can resume.
        setRuns(live ? snap.runs.map((r) => (r.phase === "running" ? stop(r) : r)) : snap.runs)
        setSessionList(snap.sessions)
        setActiveId(snap.active ?? "")
        if (typeof p.theme === "string" && (p.theme in THEMES || (p.theme === "custom" && custom))) setThemeKey(p.theme as AgentConsoleThemeName)
        if (typeof p.speed === "number" && SPEEDS.includes(p.speed)) setSpeedNow(p.speed)
        if (typeof p.auto === "boolean") setAutoNow(p.auto)
        if (typeof p.crew === "boolean") setCrewOn(p.crew)
        if (typeof p.sb === "boolean") setSbOpen(p.sb)
        if (typeof p.pn === "boolean") setPnOpen(p.pn)
      }
    }
    setLoaded(true)
  }, [])

  // Saves are throttled, not debounced: a running machine changes state every
  // beat, and a debounce would never get a quiet moment to write.
  const pendingSave = React.useRef<Snapshot | null>(null)
  const saveTimer = React.useRef(0)
  const flushSave = React.useCallback(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = 0
    const snap = pendingSave.current
    pendingSave.current = null
    if (!snap || !storageKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snap))
    } catch {
      /* storage full or blocked: the app keeps working, it just will not remember */
    }
  }, [storageKey])

  React.useEffect(() => {
    if (!loaded || !storageKey) return
    pendingSave.current = {
      v: 1,
      sessions: sessionList,
      runs,
      active: active ? active.id : null,
      prefs: { theme: themeKey, speed: speedNow, auto: autoNow, crew: crewOn, sb: sbOpen, pn: pnOpen },
    }
    if (!saveTimer.current) saveTimer.current = window.setTimeout(flushSave, 500)
  }, [loaded, storageKey, flushSave, sessionList, runs, active, themeKey, speedNow, autoNow, crewOn, sbOpen, pnOpen])

  React.useEffect(() => {
    window.addEventListener("pagehide", flushSave)
    return () => {
      window.removeEventListener("pagehide", flushSave)
      flushSave()
    }
  }, [flushSave])

  // ---- the simulation clock: one interval paces every scripted run ------------------
  const runsRef = React.useRef(runs)
  runsRef.current = runs
  const speedRef = React.useRef(speedNow)
  speedRef.current = speedNow
  const autoRef = React.useRef(autoNow)
  autoRef.current = autoNow
  const due = React.useRef<Record<string, number>>({})
  const paced = (r: Run) => !r.held && (r.phase === "deciding" || r.phase === "authored" || (r.phase === "running" && !live))
  const anyPaced = runs.some(paced)

  React.useEffect(() => {
    if (!anyPaced) return
    const isPaced = (r: Run) => !r.held && (r.phase === "deciding" || r.phase === "authored" || (r.phase === "running" && !live))
    const advance = (r: Run, auto: boolean) => {
      const n = tick(r)
      return n.phase === "awaiting" && auto ? approve(n, true) : n
    }
    const timer = window.setInterval(() => {
      const now = performance.now()
      const wall = Date.now()
      const readyIds = new Set<string>()
      const auto = autoRef.current
      for (const r of runsRef.current) {
        if (!isPaced(r)) {
          delete due.current[r.id]
          continue
        }
        const at = due.current[r.id]
        if (at === undefined) {
          due.current[r.id] = now + beatDelay(r) / speedRef.current
          continue
        }
        if (now < at) continue
        readyIds.add(r.id)
        due.current[r.id] = now + beatDelay(advance(r, auto)) / speedRef.current
      }
      if (readyIds.size) setRuns((prev) => prev.map((r) => (readyIds.has(r.id) ? stamp(r, advance(r, auto), wall) : r)))
    }, 90)
    return () => window.clearInterval(timer)
  }, [anyPaced, live])

  // Turning auto-approve on releases anything already waiting.
  React.useEffect(() => {
    if (!autoNow) return
    const now = Date.now()
    setRuns((prev) => (prev.some((r) => r.phase === "awaiting") ? prev.map((r) => stamp(r, approve(r, true), now)) : prev))
  }, [autoNow])

  // ---- the planner: writes machines for held runs ------------------------------------
  const planning = React.useRef(new Map<string, { ctrl: AbortController; done: boolean }>())
  React.useEffect(() => {
    const want = new Set(runs.filter((r) => r.held && r.phase === "deciding").map((r) => r.id))
    for (const [id, job] of planning.current) {
      if (!want.has(id)) {
        job.ctrl.abort()
        planning.current.delete(id)
      }
    }
    for (const r of runs) {
      if (!want.has(r.id) || planning.current.has(r.id)) continue
      const job = { ctrl: new AbortController(), done: false }
      planning.current.set(r.id, job)
      const ctx: PlannerContext = { signal: job.ctrl.signal, previous: summaries(runs, r) }
      Promise.resolve()
        .then(() => (plannerRef.current ?? planMachine)(r.prompt, ctx))
        .then(
          (m) => {
            if (job.ctrl.signal.aborted) return
            job.done = true
            const machine = normalizeMachine(m)
            commit(r.id, (x) =>
              !x.held ? x : machine.states.length ? authorRun(x, machine) : fail(x, "The planner returned a machine with no states."),
            )
          },
          (err) => {
            if (job.ctrl.signal.aborted) return
            job.done = true
            commit(r.id, (x) => (x.held ? fail(x, "Could not write a machine: " + errorText(err)) : x))
          },
        )
    }
  }, [runs, commit])

  // ---- the executor: runs states for real when one is supplied -----------------------
  const executing = React.useRef(new Map<string, { key: string; ctrl: AbortController; done: boolean }>())
  React.useEffect(() => {
    const want = new Map<string, Run>()
    if (live) {
      for (const r of runs) {
        if (r.phase !== "running" || !r.current) continue
        const s = byId(r.machine, r.current)
        if (s && !s.final) want.set(r.id, r)
      }
    }
    for (const [id, job] of executing.current) {
      const r = want.get(id)
      if (!r || job.key !== r.current + ":" + (r.visits[r.current as string] ?? 1)) {
        job.ctrl.abort()
        executing.current.delete(id)
      }
    }
    for (const [id, r] of want) {
      if (executing.current.has(id)) continue
      const state = byId(r.machine, r.current) as MachineState
      const visit = r.visits[state.id] ?? 1
      const job = { key: state.id + ":" + visit, ctrl: new AbortController(), done: false }
      executing.current.set(id, job)
      const ok = () => !job.ctrl.signal.aborted
      const store: Record<string, StoreValue> = { ...r.store }
      const ctx: StateContext = {
        machine: r.machine,
        state,
        visit,
        prompt: r.prompt,
        store,
        previous: summaries(runs, r),
        signal: job.ctrl.signal,
        log: (line) => {
          if (ok()) commit(id, (x) => (x.current === state.id ? logStep(x, String(line)) : x))
        },
        write: (key, value) => {
          if (!ok()) return
          store[key] = value
          commit(id, (x) => (x.current === state.id ? writeStore(x, key, value) : x))
        },
      }
      Promise.resolve()
        .then(() => (executorRef.current as StateExecutor)(ctx))
        .then(
          () => {
            if (!ok()) return
            job.done = true
            commit(id, (x) => (x.phase === "running" && x.current === state.id && (x.visits[state.id] ?? 1) === visit ? advanceRun(x) : x))
          },
          (err) => {
            if (!ok()) return
            job.done = true
            commit(id, (x) =>
              x.phase === "running" && x.current === state.id
                ? stop({ ...x, events: [...x.events, { kind: "error", text: state.id + " failed: " + errorText(err) }] })
                : x,
            )
          },
        )
    }
  }, [runs, live, commit])

  React.useEffect(() => {
    const plans = planning.current
    const jobs = executing.current
    return () => {
      for (const job of plans.values()) job.ctrl.abort()
      for (const job of jobs.values()) job.ctrl.abort()
      plans.clear()
      jobs.clear()
    }
  }, [])

  // ---- callbacks on phase changes ----------------------------------------------------
  const phases = React.useRef<Record<string, RunPhase>>({})
  React.useEffect(() => {
    const before = phases.current
    const next: Record<string, RunPhase> = {}
    for (const r of runs) {
      next[r.id] = r.phase
      const was = before[r.id]
      if (!was || was === r.phase) continue
      if (was === "awaiting" && r.phase === "running") callbacks.current.onApprove?.(r)
      if (r.phase === "done" || r.phase === "abandoned") {
        callbacks.current.onFinish?.({ id: r.id, session: r.session, prompt: r.prompt, machine: r.machine.name, outcome: r.phase })
      }
    }
    phases.current = next
  }, [runs])

  // ---- environment -------------------------------------------------------------------
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent))
    const t = timers.current
    return () => {
      mq.removeEventListener("change", sync)
      window.clearTimeout(t.say)
      window.clearTimeout(t.copy)
      window.clearTimeout(t.toast)
      window.clearTimeout(t.clear)
      cancelAnimationFrame(eyeFrame.current)
    }
  }, [])

  // The layout answers to the app's own width, not the viewport's.
  useIsoLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      setNarrow(w < 1000)
      setTiny(w < 720)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // Transitions wait until the first measurement has settled, so a phone
    // does not watch the sidebar fold away on load.
    const f = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(f)
    }
  }, [])

  // ---- view state follows the active session --------------------------------------------
  const activeKey = active ? active.id : ""
  React.useEffect(() => {
    setFocusId(null)
    setInspect(null)
    setHoverNode(null)
    setStoreOpen(null)
    setEditKey(null)
    stick.current = true
  }, [activeKey])

  React.useEffect(() => setWhole(false), [activeKey, latest?.current])

  const eventCount = turns.reduce((n, r) => n + r.events.length, 0)
  React.useEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" })
  }, [activeKey, eventCount, turns.length, reduced])

  // Popovers and menus close on a press outside them.
  React.useEffect(() => {
    if (!tweaksOpen && !menuFor) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (tweaksOpen && !popRef.current?.contains(t) && !tweakBtnRef.current?.contains(t)) setTweaksOpen(false)
      if (menuFor && !t.closest?.(".act-menu, .act-sess-more")) setMenuFor(null)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [tweaksOpen, menuFor])

  React.useEffect(() => {
    if (!tweaksOpen) setClearArmed(false)
  }, [tweaksOpen])

  React.useEffect(() => {
    if (modal) requestAnimationFrame(() => (modal.edit ? taRef.current?.focus() : modalCloseRef.current?.focus()))
  }, [modal])

  // ---- actions -------------------------------------------------------------------------
  // The composer swaps its controls as a run moves on. When the focused one goes,
  // hand focus to the transcript so the keyboard stays inside (and ⌘↵ still approves).
  const keepFocus = () =>
    requestAnimationFrame(() => {
      const el = document.activeElement
      if (!el || el === document.body || !rootRef.current?.contains(el)) scrollRef.current?.focus({ preventScroll: true })
    })

  const onLatest = (fn: (r: Run) => Run) => {
    if (!latest) return
    commit(latest.id, fn)
    keepFocus()
  }

  const send = (text: string) => {
    const prompt = text.trim()
    if (!prompt || !active) return
    if (latest && (isBusy(latest) || latest.phase === "awaiting" || latest.phase === "stopped")) return
    callbacks.current.onSend?.(prompt, active.id)
    const id = freshId("run")
    const run = stampAll(createRun(id, active.id, prompt, EMPTY_MACHINE, true), Date.now())
    setRuns((prev) => [...prev, run])
    setFocusId(null)
    setInspect(null)
    setDraft("")
    if (inputRef.current) inputRef.current.style.height = ""
    stick.current = true
    keepFocus()
  }

  const newSession = () => {
    const empty = sessionList.find((s) => !runs.some((r) => r.session === s.id))
    if (empty) setActiveId(empty.id)
    else {
      const id = freshId("session")
      setSessionList((prev) => [{ id, title: "", created: Date.now() }, ...prev])
      setActiveId(id)
    }
    setQuery("")
    if (tiny) setSbDrawer(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const removeSession = (id: string) => {
    setMenuFor(null)
    const at = sessionList.findIndex((s) => s.id === id)
    const left = sessionList.filter((s) => s.id !== id)
    setRuns((prev) => prev.filter((r) => r.session !== id))
    if (!left.length) {
      const fresh = freshId("session")
      setSessionList([{ id: fresh, title: "", created: Date.now() }])
      setActiveId(fresh)
      return
    }
    setSessionList(left)
    if (active && id === active.id) setActiveId((left[at] ?? left[at - 1] ?? left[0]).id)
    notify("Session deleted.")
  }

  const saveRename = () => {
    if (!renaming) return
    const { id, text } = renaming
    setSessionList((prev) => prev.map((s) => (s.id === id ? { ...s, title: text.trim() } : s)))
    setRenaming(null)
  }

  const exportSession = (s: Session) => {
    setMenuFor(null)
    const list = runs.filter((r) => r.session === s.id)
    if (!list.length) return
    download(slugify(titleOf(s, runs)) + ".md", transcriptMarkdown(titleOf(s, runs), list, ext), "text/markdown")
    notify("Exported the transcript as Markdown.")
  }

  const runAgain = (run: Run) => {
    const id = freshId("run")
    setRuns((prev) => [...prev, stampAll(createRun(id, run.session, run.prompt, run.machine), Date.now())])
    setFocusId(null)
    stick.current = true
  }

  /** A fresh copy of a run's machine, waiting for approval, to edit. */
  const forkRun = (run: Run): Run => {
    const id = freshId("run")
    const copy = stampAll(fastForward(createRun(id, run.session, run.prompt, run.machine), (r) => r.phase === "awaiting"), Date.now())
    setRuns((prev) => [...prev, copy])
    setFocusId(null)
    return copy
  }

  const openSource = (run: Run) => {
    opener.current = document.activeElement as HTMLElement | null
    setCopied(false)
    setModal({ runId: run.id, edit: false })
  }

  const closeSource = () => {
    setModal(null)
    requestAnimationFrame(() => opener.current?.focus())
  }

  const startEdit = (run: Run) => {
    let target = run
    if (run.phase !== "awaiting") {
      if (latest && latest.session === run.session && (isBusy(latest) || latest.phase === "awaiting" || latest.phase === "stopped")) {
        notify("Finish or stop the current run before editing a copy.", true)
        return
      }
      target = forkRun(run)
    }
    setSrc(machineSource(target.machine))
    setModal({ runId: target.id, edit: true })
  }

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ""
    if (!file) return
    file.text().then(
      (text) => {
        const { machine, errors } = parseMachine(text)
        if (!machine) {
          notify("Could not read " + file.name + ". " + errors[0], true)
          return
        }
        const sid = freshId("session")
        const run = stampAll(
          fastForward(createRun(freshId("run"), sid, "Run " + machine.name + ", imported from " + file.name + ".", normalizeMachine(machine)), (r) => r.phase === "awaiting"),
          Date.now(),
        )
        setSessionList((prev) => [{ id: sid, title: machine.name, created: Date.now() }, ...prev])
        setRuns((prev) => [...prev, run])
        setActiveId(sid)
        setTweaksOpen(false)
        notify("Imported " + machine.name + ". Read it, then approve.")
      },
      () => notify("Could not read " + file.name + ".", true),
    )
  }

  const clearAll = () => {
    if (!clearArmed) {
      setClearArmed(true)
      window.clearTimeout(timers.current.clear)
      timers.current.clear = window.setTimeout(() => setClearArmed(false), 3200)
      return
    }
    const id = freshId("session")
    setRuns([])
    setSessionList([{ id, title: "", created: Date.now() }])
    setActiveId(id)
    setTweaksOpen(false)
    notify("Cleared every session.")
  }

  const copyText = (text: string) => {
    const done = () => {
      setCopied(true)
      window.clearTimeout(timers.current.copy)
      timers.current.copy = window.setTimeout(() => setCopied(false), 1600)
    }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => notify("Copying is blocked here.", true))
  }

  const speak = (who: number) => {
    const n = sayCount.current[who]++
    setSay({ who, text: crewLine(who, latest, n) })
    window.clearTimeout(timers.current.say)
    timers.current.say = window.setTimeout(() => setSay(null), 3800)
  }

  const saveInput = (key: string) => {
    if (skipBlur.current) {
      skipBlur.current = false
      return
    }
    setEditKey(null)
    if (!focusRun) return
    const value = parseValue(editVal)
    if (focusRun.store[key] === value) return
    commit(focusRun.id, (r) => setInput(r, key, value))
  }

  const togglePanel = () => (narrow ? setPnDrawer(!pnDrawer) : setPnOpen(!pnOpen))
  const toggleSidebar = () => (tiny ? setSbDrawer(!sbDrawer) : setSbOpen(!sbOpen))

  // ---- the machine viewer / editor ------------------------------------------------------
  const modalRun = modal ? runs.find((r) => r.id === modal.runId) ?? null : null
  const parsed = React.useMemo(() => (modal && modal.edit ? parseMachine(src) : null), [modal, src])
  const shownMachine = React.useMemo(() => {
    if (!modalRun) return null
    if (parsed && parsed.machine) return mergeScripts(normalizeMachine(parsed.machine), modalRun.machine)
    return modalRun.machine
  }, [modalRun, parsed])
  const modalLayout = React.useMemo(() => {
    if (!shownMachine) return null
    const longest = Math.max(8, ...shownMachine.states.map((s) => s.id.length))
    return layoutMachine(shownMachine, { w: Math.round(longest * 6.2 + 22), h: 26, gapX: 34, gapY: 16 })
  }, [shownMachine])
  const modalWarnings = React.useMemo(() => (shownMachine ? lintMachine(shownMachine) : []), [shownMachine])
  const viewSource = React.useMemo(() => (modalRun ? machineSource(modalRun.machine) : ""), [modalRun])

  const saveEdit = () => {
    if (!modalRun || !parsed || !parsed.machine) return
    if (modalRun.phase !== "awaiting") {
      notify("This machine is already running, so it can no longer change.", true)
      return
    }
    const machine = parsed.machine
    commit(modalRun.id, (r) => editMachine(r, machine))
    setModal({ runId: modalRun.id, edit: false })
    notify("Saved " + machine.name + ". Approve it when it looks right.")
  }

  // ---- keyboard: the app owns these while focus is inside it (or nowhere) ---------------
  const keyRef = React.useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e: KeyboardEvent) => {
    const root = rootRef.current
    const el = document.activeElement
    if (!root || (el && el !== document.body && !root.contains(el))) return
    const mod = e.metaKey || e.ctrlKey
    if (e.key === "Escape") {
      if (modal) closeSource()
      else if (tweaksOpen) {
        setTweaksOpen(false)
        tweakBtnRef.current?.focus()
      } else if (menuFor) setMenuFor(null)
      else if (renaming) setRenaming(null)
      else if (narrow && pnDrawer) setPnDrawer(false)
      else if (tiny && sbDrawer) setSbDrawer(false)
      else if (query && el === searchRef.current) setQuery("")
      return
    }
    if (!mod) return
    if (modal) {
      if ((e.key === "Enter" || e.key.toLowerCase() === "s") && modal.edit) {
        e.preventDefault()
        saveEdit()
      }
      return
    }
    if (e.key === "Enter") {
      if (latest && latest.phase === "awaiting") {
        e.preventDefault()
        onLatest((r) => approve(r))
      } else if (draft.trim() && el === inputRef.current) {
        e.preventDefault()
        send(draft)
      }
    } else if (e.key === ".") {
      if (latest && isBusy(latest)) {
        e.preventDefault()
        onLatest(stop)
      } else if (latest && latest.phase === "stopped") {
        e.preventDefault()
        onLatest(resume)
      }
    } else if (e.key.toLowerCase() === "k") {
      e.preventDefault()
      if (tiny) setSbDrawer(true)
      else setSbOpen(true)
      requestAnimationFrame(() => searchRef.current?.focus())
    } else if (e.key === "\\") {
      e.preventDefault()
      togglePanel()
    }
  }
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const followEye = (e: React.PointerEvent) => {
    if (!crewOn || reduced) return
    const x = e.clientX
    const y = e.clientY
    cancelAnimationFrame(eyeFrame.current)
    eyeFrame.current = requestAnimationFrame(() => {
      const p = pupilRef.current
      const svg = p?.ownerSVGElement
      if (!p || !svg) return
      const b = svg.getBoundingClientRect()
      const dx = x - (b.left + b.width / 2)
      const dy = y - (b.top + b.height * (22 / 64))
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 140) * 1.5
      p.setAttribute("transform", "translate(" + ((dx / d) * k).toFixed(2) + " " + ((dy / d) * k).toFixed(2) + ")")
    })
  }

  // ---- more derived ------------------------------------------------------------------------
  const machine = focusRun ? focusRun.machine : EMPTY_MACHINE
  const hasMachine = !!focusRun && !focusRun.held && focusRun.phase !== "deciding" && machine.states.length > 0
  const keys = React.useMemo(() => storeKeys(machine), [machine])
  const keyNames = React.useMemo(() => keys.map((k) => k.key), [keys])
  const layout = React.useMemo(() => layoutMachine(machine), [machine])
  const writes = latest ? latest.events.filter((e) => e.kind === "write").length : 0
  const st = statusOf(latest)
  const fst = statusOf(focusRun)
  const shownId = focusRun ? inspect ?? focusRun.current ?? (hasMachine ? machine.states[0].id : null) : null
  const shown = byId(machine, shownId)
  const busy = isBusy(latest)
  const composing = !latest || latest.phase === "done" || latest.phase === "abandoned" || latest.phase === "declined"
  const storeEditable = !!focusRun && focusRun === latest && !["done", "abandoned", "declined"].includes(focusRun.phase) && !focusRun.held
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessionList
    return sessionList.filter((s) => (s.title + " " + runs.filter((r) => r.session === s.id).map((r) => r.prompt + " " + r.machine.name).join(" ")).toLowerCase().includes(q))
  }, [query, sessionList, runs])
  const mod = isMac ? "⌘" : "Ctrl "
  const mood = !latest
    ? "idle"
    : latest.phase === "deciding" || latest.phase === "authored"
      ? "authoring"
      : latest.phase === "awaiting"
        ? "waiting"
        : latest.phase === "running"
          ? /verif|check|test|critique|review|audit/i.test(latest.current ?? "")
            ? "verifying"
            : "working"
          : latest.phase === "done"
            ? "done"
            : "down"

  const vars = {
    "--act-h": height,
    "--act-minh": typeof minHeight === "number" ? minHeight + "px" : minHeight,
    "--act-surface": pal.surface,
    "--act-raised": pal.raised,
    "--act-sunk": pal.sunk,
    "--act-node": pal.node,
    "--act-ink": pal.ink,
    "--act-muted": pal.muted,
    "--act-faint": pal.faint,
    "--act-rule": pal.rule,
    "--act-warn": pal.warn,
    "--act-ok": pal.ok,
    "--act-crew": pal.crew,
    "--act-crew-fill": pal.crewFill,
  } as React.CSSProperties

  const rootCls =
    "act-root" +
    (sbShown ? " act-sb-on" : "") +
    (pnShown ? " act-pn-on" : "") +
    (narrow ? " act-narrow" : "") +
    (tiny ? " act-tiny" : "") +
    (ready ? " act-ready" : "") +
    (className ? " " + className : "")

  // ---- transcript pieces ----------------------------------------------------------------------
  const renderRows = (run: Run, rows: Row[]) => (
    <ul className="act-steps">
      {rows.map(({ ev, i }) => {
        const k = run.id + ":" + i
        if (ev.kind === "step") {
          return <StepLine key={i} text={ev.text} checked={checks[k]} onToggle={(next) => setChecks((c) => ({ ...c, [k]: next }))} />
        }
        if (ev.kind === "write" || ev.kind === "input") {
          const kind = storeKeys(run.machine).find((x) => x.key === ev.key)?.kind ?? "agent"
          return (
            <li key={i} className="act-step act-step-write">
              <span className="act-glyphs">
                <i className={"act-mk act-mk-" + kind} />
              </span>
              <span>
                {ev.kind === "input" ? "you set " : "wrote "}
                <code className="act-chip">{ev.key}</code>
              </span>
              <em>{typeof ev.value === "string" ? "“" + ev.value + "”" : String(ev.value)}</em>
            </li>
          )
        }
        if (ev.kind === "error") {
          return (
            <li key={i} className="act-step act-step-fail">
              <span className="act-glyphs">!</span>
              <span>{ev.text}</span>
            </li>
          )
        }
        if (ev.kind === "stopped" || ev.kind === "resumed") {
          return (
            <li key={i} className="act-step act-step-note">
              <span className="act-glyphs">{ev.kind === "stopped" ? "■" : "▶"}</span>
              <span>{ev.kind === "stopped" ? "Stopped by you." : "Resumed."}</span>
            </li>
          )
        }
        return null
      })}
    </ul>
  )

  const renderLine = (run: Run, item: LineItem, isLatest: boolean) => {
    const ev = item.ev
    const wk = run.id + ":" + item.i
    switch (ev.kind) {
      case "note":
        return (
          <p key={item.key} className="act-log">
            {ev.text}
            <Dots live={isLatest && run.phase === "deciding"} />
          </p>
        )
      case "authored":
      case "edited": {
        const n = ev.warnings.length
        return (
          <React.Fragment key={item.key}>
            <div className="act-kv">
              <span className="act-cap">{ev.kind === "edited" ? "You edited" : "Machine authored"}</span>
              <button
                type="button"
                className="act-mono-b act-namebtn"
                title="Show this machine in the panel"
                onClick={() => {
                  setFocusId(run.id === latest?.id ? null : run.id)
                  setInspect(null)
                  if (narrow) setPnDrawer(true)
                  else setPnOpen(true)
                }}
              >
                {ev.machine}
              </button>
              {n ? (
                <button type="button" className="act-cap act-warnbtn" aria-expanded={!!warnOpen[wk]} onClick={() => setWarnOpen((w) => ({ ...w, [wk]: !w[wk] }))}>
                  {n + (n === 1 ? " warning" : " warnings")}
                </button>
              ) : (
                <span className="act-cap act-okc">No warnings</span>
              )}
              <button type="button" className="act-cap act-link" onClick={() => openSource(run)}>
                View {ext}
              </button>
            </div>
            {warnOpen[wk] && n > 0 && (
              <ul className="act-warns">
                {ev.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </React.Fragment>
        )
      }
      case "waiting":
        return (
          <p key={item.key} className="act-log">
            Waiting for you to approve {ev.machine} before anything runs
            <Dots live={isLatest && run.phase === "awaiting"} />
            {isLatest && run.phase === "awaiting" && (
              <>
                {" "}
                <button type="button" className="act-cap act-link" onClick={() => startEdit(run)}>
                  Edit first
                </button>
              </>
            )}
          </p>
        )
      case "approved":
        return (
          <div key={item.key} className="act-kv">
            <span className="act-cap">{ev.auto ? "Auto-approved" : "Approved"}</span>
            <b className="act-mono-b">{ev.machine}</b>
          </div>
        )
      case "executing":
        return (
          <p key={item.key} className="act-log">
            Executing machine {ev.machine} {"—"} {ev.states} states.
          </p>
        )
      case "declined":
        return (
          <React.Fragment key={item.key}>
            <div className="act-kv">
              <span className="act-cap act-badc">Declined</span>
              <b className="act-mono-b">{ev.machine}</b>
            </div>
            <p className="act-log">Nothing ran. Ask again with more detail, or edit a copy of the machine.</p>
          </React.Fragment>
        )
      case "error":
        return (
          <p key={item.key} className="act-log act-log-err">
            {ev.text}
          </p>
        )
      case "input":
        return (
          <p key={item.key} className="act-log">
            You set <code className="act-chip">{ev.key}</code> to {formatValue(ev.value)}.
          </p>
        )
      case "stopped":
        return (
          <p key={item.key} className="act-log">
            Stopped by you before anything ran.
          </p>
        )
      case "resumed":
        return (
          <p key={item.key} className="act-log">
            Resumed.
          </p>
        )
      case "finish":
        return (
          <p key={item.key} className="act-log act-log-err">
            Ended by you before anything ran.
          </p>
        )
      default:
        return null
    }
  }

  const renderVisit = (run: Run, item: VisitItem, last: boolean, isLatest: boolean, firstPast: boolean) => {
    const s = byId(run.machine, item.state)
    const runKeys = storeKeys(run.machine).map((k) => k.key)
    if (last && item.finish) {
      const repairs = Object.entries(run.visits)
        .filter(([id]) => /repair|revise|fix|patch|triage/i.test(id))
        .reduce((a, [, v]) => a + v, 0)
      const prev = run.edge
      const ok = item.finish.outcome === "done"
      const startT = run.events.find((e) => e.kind === "enter")?.t
      const endT = item.finish.t
      const runWrites = run.events.filter((e) => e.kind === "write").length
      return (
        <section key={item.key} className="act-state" aria-label={ok ? "Run finished" : "Run abandoned"}>
          <div className="act-hr" role="separator" />
          <p className={"act-cap" + (ok ? " act-okc" : " act-badc")}>{ok ? "Finished" : "Abandoned"}</p>
          <h2 className="act-state-name">{item.state}</h2>
          <p className="act-final-sum">
            {ok
              ? "Reached " + item.state + " after " + run.transitions + (run.transitions === 1 ? " transition" : " transitions") + ". Every check on the way passed."
              : s && !s.final
                ? "You ended the run here, in " + item.state + ". Nothing after it ran."
                : prev && prev.via === "visit cap"
                ? "Gave up after " + prev.from + " used every visit it had. Nothing past it ran."
                : "There was no way forward, so the run stopped here."}
          </p>
          <div className="act-stats">
            <span className="act-stat">
              <b>{run.transitions}</b>transitions
            </span>
            <span className="act-stat">
              <b>
                {Object.keys(run.visits).length}/{run.machine.states.length}
              </b>
              states visited
            </span>
            <span className="act-stat">
              <b>{repairs}</b>
              {repairs === 1 ? "repair" : "repairs"}
            </span>
            <span className="act-stat">
              <b>{runWrites}</b>store writes
            </span>
            {startT && endT ? (
              <span className="act-stat">
                <b>{secs(endT - startT)}</b>elapsed
              </span>
            ) : null}
          </div>
          {isLatest && (
            <div className="act-actions">
              <button type="button" className="act-btn" onClick={() => runAgain(run)}>
                Run it again
              </button>
              <button type="button" className="act-btn act-btn-ghost" onClick={() => startEdit(run)}>
                Edit a copy
              </button>
              <button type="button" className="act-btn act-btn-ghost" onClick={() => openSource(run)}>
                View {run.machine.name + ext}
              </button>
            </div>
          )}
        </section>
      )
    }
    if (last && !item.leave && isLatest) {
      const prompt = s?.prompt ?? ""
      return (
        <section key={item.key} className="act-state" aria-label={"State " + item.state}>
          <div className="act-hr" role="separator" />
          <p className="act-cap">State{item.visit > 1 ? " · visit " + item.visit : ""}</p>
          <h2 className="act-state-name">{item.state}</h2>
          {prompt && (
            <>
              <p className={"act-instr" + (whole ? "" : " act-instr-clamp")}>
                <Rich text={prompt} keys={runKeys} />
              </p>
              {prompt.length > 140 && (
                <button type="button" className="act-cap act-link act-more" aria-expanded={whole} onClick={() => setWhole(!whole)}>
                  {whole ? "Show less" : "Show the whole instruction"}
                </button>
              )}
            </>
          )}
          {item.rows.length > 0 && renderRows(run, item.rows)}
          {run.phase === "running" && (
            <p className="act-working" aria-hidden="true">
              <i />
              <i />
              <i />
            </p>
          )}
        </section>
      )
    }
    const leave = item.leave
    const k = run.id + ":" + item.key
    const open = !!openRows[k]
    const wrote = item.rows.filter((r) => r.ev.kind === "write").map((r) => (r.ev.kind === "write" ? r.ev.key : ""))
    const capped = leave && leave.via !== "otherwise" && !runKeys.includes(leave.via)
    const took = leave && item.at && leave.t ? secs(leave.t - item.at) : ""
    return (
      <div key={item.key} className={"act-past" + (firstPast ? " act-past-first" : "")}>
        <button type="button" className="act-past-row" aria-expanded={open} onClick={() => setOpenRows((o) => ({ ...o, [k]: !open }))}>
          <span className={"act-past-mark" + (capped || !leave ? " act-badc" : "")}>
            <Icon name={capped ? "close" : leave ? "check" : "dots"} size={12} />
          </span>
          <b>{item.state}</b>
          {item.visit > 1 && <span className="act-cap">visit {item.visit}</span>}
          <span className="act-past-meta">
            {wrote.length ? "wrote " + wrote.join(", ") + "  " : ""}
            {leave
              ? "→ " + leave.to + (leave.via !== "otherwise" ? " · " + (runKeys.includes(leave.via) ? "when " + leave.via : leave.via) : "")
              : "stopped here"}
          </span>
          {took && <span className="act-past-time">{took}</span>}
          <span className="act-chev">
            <Icon name="chevron" size={12} />
          </span>
        </button>
        {open && renderRows(run, item.rows)}
      </div>
    )
  }

  // ---- render ------------------------------------------------------------------------------
  return (
    <div ref={rootRef} className={rootCls} style={vars} onPointerMove={followEye}>
      <style>{ACT_CSS}</style>

      {/* ---- title bar ---- */}
      <div className="act-bar">
        <button type="button" className="act-iconbtn" aria-label={sbShown ? "Hide sessions" : "Show sessions"} aria-expanded={sbShown} onClick={toggleSidebar}>
          <Icon name="sidebar" />
        </button>
        <div className="act-brand">
          <span className="act-logo">{logo ?? <CairnMark />}</span>
          <b>{brand}</b>
          <i>/</i>
          <span>{project}</span>
        </div>
        {headerCenter && <div className="act-bar-center">{headerCenter}</div>}
        <div className="act-grow" />
        {headerRight && <div className="act-bar-right">{headerRight}</div>}
        <div className="act-bar-status" title={st.label} aria-live="polite">
          <Mark tone={st.tone} />
          <span>{st.label}</span>
        </div>
        <button type="button" className="act-iconbtn act-panelbtn" aria-label="Machine panel" aria-pressed={pnShown} onClick={togglePanel}>
          <Icon name="panel" />
        </button>
        <button
          ref={tweakBtnRef}
          type="button"
          className="act-iconbtn act-tweakbtn"
          aria-label="Settings"
          aria-expanded={tweaksOpen}
          aria-haspopup="dialog"
          onClick={() => setTweaksOpen(!tweaksOpen)}
        >
          <Icon name="sliders" />
        </button>
        {tweaksOpen && (
          <div ref={popRef} className="act-pop" role="dialog" aria-label="Settings">
            <span className="act-cap">Theme</span>
            <div className="act-swatches">
              {swatches.map((name) => {
                const p = name === "custom" ? { ...THEMES.sage, ...custom } : THEMES[name]
                return (
                  <button
                    key={name}
                    type="button"
                    className="act-sw"
                    aria-pressed={themeKey === name}
                    onClick={() => setThemeKey(name)}
                    style={{ "--act-sw-bg": p.surface, "--act-sw-ink": p.ink } as React.CSSProperties}
                  >
                    <i />
                    {name}
                  </button>
                )
              })}
            </div>
            {live ? (
              <>
                <span className="act-cap">Agent</span>
                <p className="act-pop-note">Connected to a live executor. States run as fast as the agent works.</p>
              </>
            ) : (
              <>
                <span className="act-cap">Simulation speed</span>
                <div className="act-seg" role="group" aria-label="Simulation speed">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" aria-pressed={speedNow === s} onClick={() => setSpeedNow(s)}>
                      {s === 0.5 ? "½" : s}
                      {"×"}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="act-toggle">
              <span id={uid + "-auto"}>Approve machines automatically</span>
              <button type="button" role="switch" aria-checked={autoNow} aria-labelledby={uid + "-auto"} className="act-switch" onClick={() => setAutoNow(!autoNow)}>
                <i />
              </button>
            </div>
            <div className="act-toggle">
              <span id={uid + "-crew"}>Show the crew</span>
              <button type="button" role="switch" aria-checked={crewOn} aria-labelledby={uid + "-crew"} className="act-switch" onClick={() => setCrewOn(!crewOn)}>
                <i />
              </button>
            </div>
            <span className="act-cap">Data</span>
            <div className="act-pop-actions">
              <button type="button" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} />
                Import a {ext} file
              </button>
              <button type="button" disabled={!active || !turns.length} onClick={() => active && exportSession(active)}>
                <Icon name="download" size={14} />
                Export this session (.md)
              </button>
              <button type="button" className="act-menu-bad" onClick={clearAll}>
                <Icon name="trash" size={14} />
                {clearArmed ? "Click again to clear everything" : "Clear all sessions"}
              </button>
            </div>
            <p className="act-pop-note" style={{ marginTop: 6 }}>
              {storageKey ? "Sessions are saved in this browser." : "Sessions are not saved between visits."}
            </p>
            <span className="act-cap">Shortcuts</span>
            <div className="act-keys">
              <kbd>{mod}{"↵"}</kbd>
              <span>Send, or approve</span>
              <kbd>{mod}.</kbd>
              <span>Stop or resume</span>
              <kbd>{mod}K</kbd>
              <span>Search sessions</span>
              <kbd>{mod}\</kbd>
              <span>Machine panel</span>
              <kbd>Esc</kbd>
              <span>Close what is open</span>
            </div>
          </div>
        )}
      </div>

      <div className="act-body">
        {/* ---- sessions ---- */}
        <nav className="act-side" aria-label="Sessions">
          <div className="act-side-in">
            <div className="act-side-head">
              <span className="act-cap">Sessions</span>
              <button type="button" className="act-iconbtn" aria-label="New session" onClick={newSession}>
                <Icon name="plus" />
              </button>
            </div>
            <label className="act-search">
              <Icon name="search" size={14} />
              <span className="act-sr">Search sessions</span>
              <input ref={searchRef} type="search" value={query} placeholder="Search sessions" onChange={(e) => setQuery(e.target.value)} />
              {query ? (
                <button
                  type="button"
                  className="act-search-x"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("")
                    searchRef.current?.focus()
                  }}
                >
                  <Icon name="close" size={11} />
                </button>
              ) : (
                <span className="act-kbd">{mod}K</span>
              )}
            </label>
            <ul className="act-sessions">
              {filtered.map((s) => {
                const lr = latestOf.get(s.id)
                const ss = statusOf(lr)
                const on = !!active && s.id === active.id
                const title = titleOf(s, runs)
                return (
                  <li key={s.id} className={"act-sess" + (on ? " act-sess-on" : "")}>
                    {renaming && renaming.id === s.id ? (
                      <form
                        className="act-rename"
                        onSubmit={(e) => {
                          e.preventDefault()
                          saveRename()
                        }}
                      >
                        <input
                          autoFocus
                          aria-label="Session name"
                          value={renaming.text}
                          placeholder={title}
                          onChange={(e) => setRenaming({ id: s.id, text: e.target.value })}
                          onBlur={saveRename}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation()
                              setRenaming(null)
                            }
                          }}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="act-sess-btn"
                        aria-current={on ? "true" : undefined}
                        title={title + " (double-click to rename)"}
                        onClick={() => {
                          setActiveId(s.id)
                          if (tiny) setSbDrawer(false)
                        }}
                        onDoubleClick={() => setRenaming({ id: s.id, text: s.title || title })}
                      >
                        <span className="act-sess-title">{title}</span>
                        <span className="act-sess-status">
                          <Mark tone={ss.tone} />
                          <span>{ss.label}</span>
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="act-sess-more"
                      aria-label={"Actions for " + title}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === s.id}
                      onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                    >
                      <Icon name="dots" size={14} />
                    </button>
                    {menuFor === s.id && (
                      <div className="act-menu" role="menu" aria-label={"Actions for " + title}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuFor(null)
                            setRenaming({ id: s.id, text: s.title || title })
                          }}
                        >
                          <Icon name="edit" size={14} />
                          Rename
                        </button>
                        <button type="button" role="menuitem" disabled={!lr} onClick={() => exportSession(s)}>
                          <Icon name="download" size={14} />
                          Export transcript
                        </button>
                        <button type="button" role="menuitem" className="act-menu-bad" onClick={() => removeSession(s.id)}>
                          <Icon name="trash" size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
              {!filtered.length && <li className="act-empty-list">No sessions match {"“" + query + "”"}.</li>}
            </ul>
            {crewOn && (
              <Crew uid={uid} mood={mood} writes={writes} pupilRef={pupilRef} onSay={speak}>
                {say && (
                  <div key={say.who + say.text} className="act-say" role="status" style={{ "--act-say-x": 17 + say.who * 46 + "px" } as React.CSSProperties}>
                    <b>{CREW[say.who].name}</b>
                    {say.text}
                  </div>
                )}
              </Crew>
            )}
          </div>
        </nav>

        {/* ---- transcript or custom workspace ---- */}
        <section className="act-main" aria-label={activeWorkspace && activeWorkspace !== "console" ? activeWorkspace : "Transcript"}>
          {activeWorkspace && activeWorkspace !== "console" && workspaces?.[activeWorkspace] ? (
            <div className="act-custom-workspace">
              {workspaces[activeWorkspace]}
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="act-scroll"
                tabIndex={-1}
                onScroll={(e) => {
                  const el = e.currentTarget
                  stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
                }}
              >
            <div className="act-thread">
              {!turns.length ? (
                <div className="act-empty">
                  <p className="act-cap">New session</p>
                  <h2 className="act-ask">What should the machine do?</h2>
                  <p className="act-empty-sub">
                    Describe a task. {brand} decides whether it needs a machine, writes one, and waits for you to approve it before anything
                    runs.
                  </p>
                  {suggestions.length > 0 && (
                    <div className="act-sugs">
                      {suggestions.map((s) => (
                        <button key={s} type="button" className="act-sug" onClick={() => send(s)}>
                          <span>{s}</span>
                          <Icon name="arrow" size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="act-empty-tips">
                    <p className="act-tip">
                      <b>Read before it runs</b>
                      Every machine waits for approval. Open its source to edit states, exits and prompts first.
                    </p>
                    <p className="act-tip">
                      <b>Keep going</b>
                      Ask a follow-up in the same session. Each ask gets its own machine.
                    </p>
                    <p className="act-tip">
                      <b>Bring a machine</b>
                      Import a {ext} file from Settings, or export any session as Markdown.
                    </p>
                  </div>
                </div>
              ) : (
                <div role="log" aria-label="Run transcript">
                  {turns.map((run) => {
                    const items = buildItems(run.events)
                    let lastVisit = -1
                    for (let i = items.length - 1; i >= 0; i--) {
                      if (items[i].t === "visit") {
                        lastVisit = i
                        break
                      }
                    }
                    const isLatest = run === latest
                    let firstPastSeen = false
                    return (
                      <article key={run.id} className="act-turn">
                        <div className="act-turn-head">
                          <span className="act-cap">You asked</span>
                          {run.events[0]?.t ? <span className="act-cap act-faintc">{clock(run.events[0].t)}</span> : null}
                        </div>
                        <h2 className="act-ask">{run.prompt}</h2>
                        {items.map((item, idx) => {
                          if (item.t === "line") return renderLine(run, item, isLatest)
                          const isLast = idx === lastVisit
                          const past = !(isLast && item.finish) && !(isLast && !item.leave && isLatest)
                          const first = past && !firstPastSeen
                          if (past) firstPastSeen = true
                          return renderVisit(run, item, isLast, isLatest, first)
                        })}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ---- composer ---- */}
          <div className="act-composer">
            <div className="act-composer-in">
              {busy && latest && (
                <div className="act-crow">
                  <p className="act-crow-text">
                    {latest.phase === "running" ? "Running" : "Authoring"}
                    <Dots live />
                  </p>
                  <button type="button" className="act-stop" aria-label="Stop the run" title={"Stop (" + mod + ".)"} onClick={() => onLatest(stop)}>
                    <i />
                  </button>
                </div>
              )}
              {latest && latest.phase === "awaiting" && (
                <div className="act-crow">
                  <p className="act-crow-text">
                    Approve <b className="act-mono-b">{latest.machine.name}</b> to start.
                  </p>
                  <button type="button" className="act-btn act-btn-ghost" onClick={() => startEdit(latest)}>
                    Edit
                  </button>
                  <button type="button" className="act-btn act-btn-ghost" onClick={() => onLatest(decline)}>
                    Decline
                  </button>
                  <button type="button" className="act-btn" onClick={() => onLatest((r) => approve(r))}>
                    Approve
                  </button>
                </div>
              )}
              {latest && latest.phase === "stopped" && (
                <div className="act-crow">
                  <p className="act-crow-text">
                    Stopped{latest.current ? " in " : "."}
                    {latest.current && <b className="act-mono-b">{latest.current}</b>}
                  </p>
                  <button type="button" className="act-btn act-btn-ghost" onClick={() => onLatest(endRun)}>
                    End run
                  </button>
                  <button type="button" className="act-btn" onClick={() => onLatest(resume)}>
                    Resume
                  </button>
                </div>
              )}
              {composing && (
                <form
                  className="act-crow"
                  onSubmit={(e) => {
                    e.preventDefault()
                    send(draft)
                  }}
                >
                  <textarea
                    ref={inputRef}
                    className="act-input"
                    rows={1}
                    value={draft}
                    aria-label="Describe a task"
                    placeholder={!turns.length ? "Describe a task for " + brand + "…" : "Ask a follow-up, or something new…"}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      const el = e.target
                      el.style.height = "auto"
                      el.style.height = Math.min(el.scrollHeight, 160) + "px"
                    }}
                  />
                  <button type="submit" className="act-send" aria-label="Send" disabled={!draft.trim()}>
                    <Icon name="arrow" size={14} />
                  </button>
                </form>
              )}
              <div className="act-foot">
                <span>
                  {mod}
                  {"↵"} {latest && latest.phase === "awaiting" ? "to approve" : "to send"}
                </span>
                <span title={cwd}>{cwd}</span>
              </div>
            </div>
          </div>
          </>
          )}
        </section>

        {/* ---- machine ---- */}
        <aside className="act-panel" aria-label="Machine">
          <div className="act-panel-in">
            <div className="act-ph">
              <span className="act-cap">Machine</span>
              <span className="act-cap act-ph-status">
                <Mark tone={fst.tone} />
                {fst.short}
              </span>
              <button type="button" className="act-iconbtn" aria-label="Close machine panel" onClick={togglePanel}>
                <Icon name="close" size={14} />
              </button>
            </div>
            {focusRun && latest && focusRun !== latest && (
              <div className="act-earlier">
                <span className="act-cap">Earlier ask</span>
                <button type="button" className="act-cap act-link" onClick={() => setFocusId(null)}>
                  Show latest
                </button>
              </div>
            )}

            {hasMachine && focusRun ? (
              <>
                <div className="act-graph-wrap">
                  <MachineGraph
                    layout={layout}
                    run={focusRun}
                    uid={uid}
                    selected={inspect}
                    reduced={reduced}
                    onSelect={(id) => setInspect(id === focusRun.current ? null : id)}
                    onHover={setHoverNode}
                  />
                </div>
                <div className="act-gcap">
                  <b className="act-mono-b">
                    {hoverNode ? hoverNode + (focusRun.visits[hoverNode] ? " · " + focusRun.visits[hoverNode] + "×" : "") : machine.name}
                  </b>
                  <button type="button" className="act-cap act-link" onClick={() => openSource(focusRun)}>
                    View {ext}
                  </button>
                </div>
                <div className="act-rule" />
                {shown && (
                  <section className="act-cur">
                    <div className="act-cur-head">
                      <span className="act-cap">{shown.id === focusRun.current || !inspect ? "Current state" : "Inspecting"}</span>
                      {inspect && focusRun.current && (
                        <button type="button" className="act-cap act-link" onClick={() => setInspect(null)}>
                          Follow run
                        </button>
                      )}
                    </div>
                    <h3 className="act-pstate">{shown.id}</h3>
                    <p className="act-cap">
                      {[
                        machine.states[0]?.id === shown.id ? "Initial" : "",
                        shown.final ? (outcomeOf(shown) === "failure" ? "Final · failure" : "Final") : "",
                        focusRun.visits[shown.id] ? "Visit " + focusRun.visits[shown.id] : "Not visited",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {!shown.final && (
                      <dl className="act-dl">
                        {shown.writes && shown.writes.length > 0 && (
                          <>
                            <dt className="act-cap">Writes</dt>
                            <dd>{shown.writes.join(", ")}</dd>
                          </>
                        )}
                        {(shown.when ?? []).map((w) => (
                          <React.Fragment key={w.key + w.to}>
                            <dt className="act-cap">When</dt>
                            <dd>
                              {w.key} {"→"} {w.to}
                            </dd>
                          </React.Fragment>
                        ))}
                        {shown.next && (
                          <>
                            <dt className="act-cap">Otherwise</dt>
                            <dd>
                              {"→"} {shown.next}
                            </dd>
                          </>
                        )}
                      </dl>
                    )}
                    {shown.prompt && (
                      <>
                        <p className="act-cap">Prompt</p>
                        <p className="act-ptext">{shown.prompt}</p>
                      </>
                    )}
                    {shown.final && (
                      <p className="act-ptext">
                        {outcomeOf(shown) === "failure"
                          ? "Where the run goes when a state runs out of visits or has no way forward."
                          : "Reaching this state ends the run."}
                      </p>
                    )}
                  </section>
                )}
                {keys.length > 0 && (
                  <section className="act-store" aria-label="Store">
                    <div className="act-store-head">
                      <span className="act-cap">Store</span>
                      <span className="act-cap act-legend">
                        <span>
                          <i className="act-mk act-mk-agent" />
                          Agent
                        </span>
                        <span>
                          <i className="act-mk act-mk-observed" />
                          Observed
                        </span>
                        <span>
                          <i className="act-mk act-mk-set" />
                          Set
                        </span>
                      </span>
                    </div>
                    <ul>
                      {keys.map((k) => {
                        const has = Object.prototype.hasOwnProperty.call(focusRun.store, k.key)
                        const v = focusRun.store[k.key]
                        let lastWrite = -1
                        focusRun.events.forEach((e, i) => {
                          if ((e.kind === "write" || e.kind === "input") && e.key === k.key) lastWrite = i
                        })
                        const open = storeOpen === k.key && has
                        const editable = storeEditable && k.kind === "set"
                        const valueCls =
                          "act-sval" + (v === true ? " act-sval-true" : v === false ? " act-sval-false" : "") + (lastWrite > -1 ? " act-sval-new" : "")
                        return (
                          <li key={k.key} className="act-srow">
                            <div className="act-srow-line">
                              <i className={"act-mk act-mk-" + k.kind} title={k.kind} />
                              <button type="button" className="act-skey" aria-expanded={has ? open : undefined} disabled={!has} onClick={() => setStoreOpen(open ? null : k.key)}>
                                {k.key}
                              </button>
                              {editKey === k.key ? (
                                <form
                                  className="act-sedit"
                                  onSubmit={(e) => {
                                    e.preventDefault()
                                    saveInput(k.key)
                                  }}
                                >
                                  <input
                                    autoFocus
                                    aria-label={"Value for " + k.key}
                                    value={editVal}
                                    onChange={(e) => setEditVal(e.target.value)}
                                    onBlur={() => saveInput(k.key)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        e.stopPropagation()
                                        skipBlur.current = true
                                        setEditKey(null)
                                      }
                                    }}
                                  />
                                </form>
                              ) : editable ? (
                                <button
                                  key={lastWrite}
                                  type="button"
                                  className={valueCls + " act-sval-edit"}
                                  title="Edit this value"
                                  onClick={() => {
                                    skipBlur.current = false
                                    setEditVal(has ? (typeof v === "string" ? v : JSON.stringify(v)) : "")
                                    setEditKey(k.key)
                                  }}
                                >
                                  {has ? formatValue(v) : "set a value"}
                                </button>
                              ) : (
                                <span key={lastWrite} className={valueCls}>
                                  {has ? formatValue(v) : "—"}
                                </span>
                              )}
                            </div>
                            {open && <p className="act-sfull">{formatValue(v)}</p>}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <>
                <div className="act-graph-wrap">
                  <Skeleton live={!!focusRun && (focusRun.held || focusRun.phase === "deciding")} />
                </div>
                <p className="act-none">
                  {focusRun && (focusRun.held || focusRun.phase === "deciding")
                    ? "Authoring a machine for this request. Its states, store and exits appear here once it is written."
                    : focusRun
                      ? "This ask ended before a machine was written."
                      : "No machine yet. Ask for something and the machine " + brand + " writes for it shows up here."}
                </p>
              </>
            )}
          </div>
        </aside>

        <div
          className={"act-scrim" + ((tiny && sbDrawer) || (narrow && pnDrawer) ? " act-scrim-on" : "")}
          onClick={() => {
            setSbDrawer(false)
            setPnDrawer(false)
          }}
          aria-hidden="true"
        />
      </div>

      {/* ---- machine viewer / editor ---- */}
      {modal && modalRun && shownMachine && modalLayout && (
        <div
          className="act-modal-scrim"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeSource()
          }}
        >
          <div className="act-modal" role="dialog" aria-modal="true" aria-labelledby={uid + "-src"}>
            <div className="act-modal-head">
              <b id={uid + "-src"} className="act-mono-b">
                {(shownMachine.name || "Machine") + ext}
              </b>
              <span className="act-cap">
                {modal.edit ? "Editing · " : ""}
                {shownMachine.states.length} states {"·"} {storeKeys(shownMachine).length} store keys
              </span>
              <div className="act-modal-tools">
                {!modal.edit && (
                  <button type="button" className="act-btn act-btn-ghost" onClick={() => startEdit(modalRun)}>
                    <Icon name="edit" size={13} />
                    {modalRun.phase === "awaiting" ? "Edit" : "Edit a copy"}
                  </button>
                )}
                <button type="button" className="act-btn act-btn-ghost" onClick={() => copyText(modal.edit ? src : viewSource)}>
                  <Icon name={copied ? "check" : "copy"} size={13} />
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className="act-btn act-btn-ghost"
                  onClick={() => {
                    download((shownMachine.name || "machine") + ext, modal.edit ? src : viewSource)
                    notify("Downloaded " + (shownMachine.name || "machine") + ext + ".")
                  }}
                >
                  <Icon name="download" size={13} />
                  Download
                </button>
                <button ref={modalCloseRef} type="button" className="act-iconbtn" aria-label="Close" onClick={closeSource}>
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div className="act-modal-graph">
              <MachineGraph
                layout={modalLayout}
                run={{ ...modalRun, machine: shownMachine }}
                uid={uid}
                big
                selected={null}
                reduced={reduced}
                onSelect={(id) => {
                  if (modal.edit && taRef.current) {
                    const at = src.search(new RegExp("^(initial|state|final) " + id + "\\b", "m"))
                    if (at > -1) {
                      taRef.current.focus()
                      taRef.current.setSelectionRange(at, at)
                    }
                  } else if (modalRun === focusRun) setInspect(id === modalRun.current ? null : id)
                }}
              />
            </div>
            <div className="act-code-wrap">
              {modal.edit ? (
                <>
                  <pre ref={hlRef} className="act-code act-code-ed" aria-hidden="true">
                    <SourceLines text={src + "\n"} />
                  </pre>
                  <textarea
                    ref={taRef}
                    className="act-ta"
                    value={src}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label={"Source for " + (shownMachine.name || "the machine")}
                    onChange={(e) => setSrc(e.target.value)}
                    onScroll={(e) => {
                      if (hlRef.current) {
                        hlRef.current.scrollTop = e.currentTarget.scrollTop
                        hlRef.current.scrollLeft = e.currentTarget.scrollLeft
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault()
                        const el = e.currentTarget
                        el.setRangeText("  ", el.selectionStart, el.selectionEnd, "end")
                        setSrc(el.value)
                      }
                    }}
                  />
                </>
              ) : (
                <pre className="act-code">
                  <SourceLines text={viewSource.trimEnd()} />
                </pre>
              )}
            </div>
            {modal.edit && (
              <div className="act-modal-foot">
                <div className="act-modal-msg" aria-live="polite">
                  {parsed && parsed.errors.length ? (
                    <ul className="act-badc">
                      {parsed.errors.slice(0, 4).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  ) : modalWarnings.length ? (
                    <ul>
                      {modalWarnings.map((w, i) => (
                        <li key={i}>
                          <span className="act-badc">!</span> {w}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="act-okc">Reads cleanly. No warnings.</span>
                  )}
                </div>
                <button type="button" className="act-btn act-btn-ghost" onClick={() => setModal({ runId: modalRun.id, edit: false })}>
                  Cancel
                </button>
                <button type="button" className="act-btn" disabled={!parsed || !parsed.machine} onClick={saveEdit}>
                  Save {mod}
                  {"↵"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.n} className={"act-toast" + (toast.bad ? " act-toast-bad" : "")} role="status">
          {toast.text}
        </div>
      )}
      <input ref={fileRef} type="file" accept={ext + ",.txt,text/plain"} onChange={importFile} hidden />
    </div>
  )
}
