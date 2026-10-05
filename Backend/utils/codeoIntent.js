/**
 * Codeo intent parser.
 *
 * This is the "brain" seam. Today it uses a deterministic, offline,
 * keyword + regex parser (no API key, no network needed). When you want
 * real LLM understanding later, implement `parseWithLLM` below and flip
 * USE_LLM to true (or set CODEO_USE_LLM=true in .env). The rest of the
 * codebase only calls `parseIntent`, so nothing else changes.
 *
 * An "intent" looks like:
 *   { type, entities: {...}, raw }
 *
 * Supported types:
 *   create_meeting        -> CEO/admin: schedule a real meeting
 *   request_meeting       -> employee: request a meeting with the CEO/manager
 *   request_leave         -> employee: file a leave request
 *   assign_task           -> CEO/admin: assign a task to someone/team
 *   create_task           -> anyone: create a personal task (with confirmation)
 *   show_tasks            -> anyone: list my tasks
 *   show_requests         -> show my meeting requests
 *   show_meetings         -> list upcoming meetings
 *   set_status            -> CEO: change availability
 *   list_pending_requests -> CEO/admin: inbox of pending requests
 *   approve_request       -> CEO: approve a pending request
 *   reject_request        -> CEO: reject a pending request
 *   show_analytics        -> CEO/admin: request stats summary
 *   list_users            -> admin: list users
 *   create_user           -> admin: create a user account
 *   toggle_user           -> admin: activate/deactivate user
 *   reset_password        -> admin: reset a user's password
 *   show_assigned_tasks   -> CEO/admin: tasks you assigned to others
 *   help                  -> what can you do
 *   smalltalk / unknown   -> friendly fallback
 */

const USE_LLM = process.env.CODEO_USE_LLM === 'true';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

// ---------- date & time extraction ----------

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseDate(text) {
  const t = text.toLowerCase();
  const now = new Date();

  if (/\btoday\b/.test(t)) return startOfDay(now);
  if (/\btomorrow\b/.test(t)) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/\bday after tomorrow\b/.test(t)) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 2);
    return d;
  }

  // "next monday", "on friday", "monday"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const re = new RegExp(`\\b(next\\s+)?${WEEKDAYS[i]}\\b`);
    const m = t.match(re);
    if (m) {
      const d = startOfDay(now);
      let diff = (i - d.getDay() + 7) % 7;
      if (diff === 0 || m[1]) diff += 7; // "next" or same-day -> push a week
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  // explicit dd/mm or yyyy-mm-dd
  const iso = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return startOfDay(new Date(+iso[1], +iso[2] - 1, +iso[3]));

  const dmy = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (dmy) {
    const year = dmy[3] ? (dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3]) : now.getFullYear();
    return startOfDay(new Date(year, +dmy[2] - 1, +dmy[1]));
  }

  return null;
}

function parseTime(text) {
  const t = text.toLowerCase();

  // 5 pm, 5:30pm, 17:00, 9 am
  let m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let hr = +m[1] % 12;
    if (m[3] === 'pm') hr += 12;
    const min = m[2] ? m[2] : '00';
    return `${String(hr).padStart(2, '0')}:${min}`;
  }

  m = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;

  if (/\bnoon\b/.test(t)) return '12:00';
  if (/\bmidnight\b/.test(t)) return '00:00';

  return null;
}

function parseDuration(text) {
  const m = text.toLowerCase().match(/\b(\d{1,3})\s*(min|mins|minutes)\b/);
  if (m) return +m[1];
  const h = text.toLowerCase().match(/\b(\d{1,2})\s*(hour|hours|hr|hrs)\b/);
  if (h) return +h[1] * 60;
  return null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // UTC noon on that calendar day — avoids next-day requests landing on "today" in UTC calendars.
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), 12, 0, 0));
}

function extractPriority(text) {
  const t = text.toLowerCase();
  if (/\burgent|asap|emergency|critical\b/.test(t)) return 'urgent';
  if (/\bhigh\b/.test(t)) return 'high';
  if (/\blow\b/.test(t)) return 'low';
  return 'medium';
}

// Pulls a quoted title, or text after "called/titled/about/for", else a trimmed phrase.
function extractTitle(text, fallback) {
  const quoted = text.match(/["“'](.+?)["”']/);
  if (quoted) return quoted[1].trim();
  const remind = text.match(/\bremind me to\s+(.+)$/i);
  if (remind) return remind[1].trim();
  const taskPhrase = text.match(/\b(?:create|add|make|new)\s+(?:a\s+)?task\s+(?:to\s+|called\s+|named\s+)?(.+)$/i);
  if (taskPhrase) {
    return taskPhrase[1]
      .replace(/\b(for|to)\s+(?:the\s+)?[a-z]+\s+team\b.*$/i, '')
      .trim() || fallback;
  }
  const after = text.match(/\b(?:called|titled|about|regarding|for|on)\s+(.+)$/i);
  if (after) {
    return after[1]
      .replace(/\b(tomorrow|today|next week|at \d.*|on \d.*)\b.*/i, '')
      .trim() || fallback;
  }
  return fallback;
}

// Mentioned team / department, e.g. "assign task to HR team"
function extractTeam(text) {
  const m = text.match(/\b(?:to|for)\s+(?:the\s+)?([a-z]+)\s+(?:team|department|dept)\b/i);
  if (m) return m[1].toLowerCase();
  const m2 = text.match(/\b(hr|frontend|backend|sales|marketing|design|engineering|finance|qa|devops)\b/i);
  return m2 ? m2[1].toLowerCase() : '';
}

/** CEO availability status — returns null if not explicitly stated */
function extractCeoStatus(text) {
  const t = String(text || '').toLowerCase();
  if (/\bdeep work|focus mode|dnd|do not disturb\b/.test(t)) return 'deep_work';
  if (/\bin meeting\b/.test(t)) return 'in_meeting';
  if (/\bbusy\b/.test(t) && !/\bdeep work\b/.test(t)) return 'in_meeting';
  if (/\boffline\b/.test(t)) return 'offline';
  if (/\bemergency only\b/.test(t)) return 'emergency_only';
  if (/\bavailable\b/.test(t)) return 'available';
  return null;
}

function extractRequestRef(text) {
  const t = text.toLowerCase();
  const num = t.match(/\b(?:request\s*)?#?(\d{1,2})\b/);
  if (num) return { requestIndex: Number(num[1]) };
  const quoted = text.match(/["“'](.+?)["”']/);
  if (quoted) return { requestTitle: quoted[1].trim() };
  const titled = text.match(/\b(?:approve|reject|decline|deny|accept)\s+(?:the\s+)?(.+?)(?:\s+request)?\s*$/i);
  if (titled && titled[1]) return { requestTitle: titled[1].trim() };
  return {};
}

const INVALID_USERNAME_WORDS = new Set([
  'create', 'user', 'users', 'add', 'new', 'register', 'account', 'profile',
  'employee', 'admin', 'ceo', 'a', 'an', 'the', 'for', 'with', 'named', 'called',
]);

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

function isValidUsername(value) {
  const u = normalizeUsername(value);
  return USERNAME_RE.test(u) && !INVALID_USERNAME_WORDS.has(u);
}

function pickUsernameFromFreeText(text) {
  const t = String(text || '');
  const at = t.match(/@([a-z0-9._-]{3,30})/i);
  if (at && isValidUsername(at[1])) return normalizeUsername(at[1]);
  const explicit = t.match(/\busername\s+([a-z0-9._-]{3,30})\b/i);
  if (explicit && isValidUsername(explicit[1])) return normalizeUsername(explicit[1]);
  const afterUser = t.match(/\buser\s+([a-z0-9._-]{3,30})\b/i);
  if (afterUser && isValidUsername(afterUser[1])) return normalizeUsername(afterUser[1]);
  const plain = t.trim().match(/^([a-z0-9._-]{3,30})$/i);
  if (plain && isValidUsername(plain[1])) return normalizeUsername(plain[1]);
  return '';
}

function extractUsername(text) {
  return pickUsernameFromFreeText(text);
}

function extractRole(text) {
  const t = text.toLowerCase();
  if (/\badmin\b/.test(t)) return 'admin';
  if (/\bceo\b/.test(t)) return 'ceo';
  if (/\bemployee\b/.test(t)) return 'employee';
  return '';
}

/** Full name from "create user …" commands — avoid treating command words as names. */
function extractPersonName(text) {
  const quoted = text.match(/["“'](.+?)["”']/);
  if (quoted) return quoted[1].trim();
  const named = text.match(/\b(?:named|called)\s+(.+?)(?:\s+as\s+|\s*,\s*|\s+role\b|\s+employee\b|\s+admin\b|\s+ceo\b|$)/i);
  if (named && named[1]) return named[1].trim();
  const asRole = text.match(
    /\buser\s+[a-z0-9._-]{3,30}\s+(.+?)\s+(?:as\s+)?(?:employee|admin|ceo)\b/i
  );
  if (asRole && asRole[1]) return asRole[1].trim();
  return '';
}

// ---------- the offline parser ----------

function parseOffline(text, ctx = {}) {
  const t = text.toLowerCase().trim();
  const role = ctx.role || 'employee';

  const date = parseDate(text);
  const time = parseTime(text);
  const duration = parseDuration(text);

  // ----- leave -----
  if (/\b(leave|day off|time off|vacation|holiday|sick)\b/.test(t) &&
      /\b(request|apply|need|want|file|take)\b/.test(t)) {
    return {
      type: 'request_leave',
      entities: { date, time, reason: extractTitle(text, 'Leave request') },
      raw: text,
    };
  }

  // ----- shift change -----
  if (/\bshift\b/.test(t) && /\b(change|swap|switch|request)\b/.test(t)) {
    return {
      type: 'request_leave',
      entities: { date, time, reason: 'Shift change request', subtype: 'shift_change' },
      raw: text,
    };
  }

  // ----- create / assign task -----
  const team = extractTeam(text);
  const wantsTeamAssign = (role === 'ceo' || role === 'admin')
    && (team || /\b(assign|give|delegate)\b.*\b(to|for)\b/.test(t));

  if (
    /\b(create|add|make|new)\b.*\btask\b/.test(t)
    || /\b(remind me to)\b/.test(t)
    || /\btask\b.*\b(for me|myself|my)\b/.test(t)
    || (/\btask\b/.test(t) && /\b(create|add|make)\b/.test(t))
  ) {
    if (wantsTeamAssign) {
      return {
        type: 'assign_task',
        entities: {
          title: extractTitle(text, ''),
          team: team || '',
          priority: extractPriority(text),
          dueDate: date,
        },
        raw: text,
      };
    }
    return {
      type: 'create_task',
      entities: {
        title: extractTitle(text, ''),
        priority: extractPriority(text),
        dueDate: date,
      },
      raw: text,
    };
  }

  if (/\b(assign|create|add|give)\b.*\btask\b/.test(t) || /\btask\b.*\b(to|for)\b/.test(t)) {
    return {
      type: wantsTeamAssign ? 'assign_task' : 'create_task',
      entities: {
        title: extractTitle(text, ''),
        team: team || '',
        priority: extractPriority(text),
        dueDate: date,
      },
      raw: text,
    };
  }

  // ----- show tasks -----
  if (
    (role === 'ceo' || role === 'admin')
    && (/\b(assigned|delegated|team)\b.*\btasks?\b/.test(t) || /\btasks?\b.*\b(assigned|delegated|i gave)\b/.test(t))
  ) {
    return { type: 'show_assigned_tasks', entities: {}, raw: text };
  }
  if (/\b(show|list|what are|see|view|my)\b.*\btasks?\b/.test(t) || /^tasks?\b/.test(t)) {
    return { type: 'show_tasks', entities: {}, raw: text };
  }

  // ----- CEO approve / reject (before generic "meeting" rules) -----
  if (role === 'ceo' && /\b(approve|accept|greenlight)\b/.test(t)) {
    return { type: 'approve_request', entities: extractRequestRef(text), raw: text };
  }
  if (role === 'ceo' && /\b(reject|decline|deny)\b/.test(t)) {
    const entities = extractRequestRef(text);
    const reasonMatch = text.match(/\bbecause\s+(.+)$/i);
    if (reasonMatch) entities.rejectionReason = reasonMatch[1].trim();
    return { type: 'reject_request', entities, raw: text };
  }

  if ((role === 'ceo' || role === 'admin') && /\b(pending|waiting|inbox|need review|awaiting)\b.*\brequests?\b/.test(t)) {
    return { type: 'list_pending_requests', entities: {}, raw: text };
  }

  if (/\b(show|list|status of)\b.*\brequests?\b/.test(t) || /\brequests?\b.*\b(show|list)\b/.test(t)) {
    if ((role === 'ceo' || role === 'admin') && !/\bmy\b/.test(t)) {
      return { type: 'list_pending_requests', entities: {}, raw: text };
    }
    return { type: 'show_requests', entities: {}, raw: text };
  }

  // ----- meeting: create vs request (never when approving/rejecting pending items) -----
  const meetingWords = /\b(meeting|meet|interview|sync|call|standup|1:1|one on one|catch up)\b/.test(t);
  const scheduleWords = /\b(schedule|create|set up|setup|book|arrange|plan|organize|organise)\b/.test(t);
  const requestWords = /\b(request|ask for|want|need|can i)\b/.test(t);
  const reviewWords = /\b(approve|reject|decline|deny|accept|pending|greenlight)\b/.test(t);

  if (meetingWords && !reviewWords && (scheduleWords || requestWords || date || time)) {
    if (role === 'ceo' || role === 'admin') {
      return {
        type: 'create_meeting',
        entities: {
          title: extractTitle(text, /interview/.test(t) ? 'Interview' : 'Team Meeting'),
          date, time, duration: duration || 30,
          isInterview: /interview/.test(t),
          // crude participant hint: "with frontend candidates", "with HR"
          team: extractTeam(text),
        },
        raw: text,
      };
    }
    return {
      type: 'request_meeting',
      entities: {
        title: extractTitle(text, 'Meeting with manager'),
        date, time, duration: duration || 30,
        urgency: extractPriority(text) === 'urgent' ? 'high' : 'low',
      },
      raw: text,
    };
  }

  // ----- show meetings -----
  if (/\b(show|list|upcoming|my)\b.*\bmeetings?\b/.test(t)) {
    return { type: 'show_meetings', entities: {}, raw: text };
  }

  // ----- analytics (CEO/admin) -----
  if ((role === 'ceo' || role === 'admin') && /\b(analytics|stats|statistics|overview|summary)\b/.test(t)) {
    return { type: 'show_analytics', entities: {}, raw: text };
  }

  // ----- admin user management -----
  if (role === 'admin' && /\b(list|show|all)\b.*\busers?\b/.test(t)) {
    return { type: 'list_users', entities: {}, raw: text };
  }
  if (
    role === 'admin'
    && (
      /\b(create|add|register|new)\b.*\b(user|account|profile)\b/.test(t)
      || /\b(user|account|profile)\b.*\b(create|add|register|new)\b/.test(t)
      || /\bcreate\s+(?:an?\s+)?employee\b/.test(t)
    )
  ) {
    return {
      type: 'create_user',
      entities: {
        username: pickUsernameFromFreeText(text),
        role: extractRole(text),
        fullName: extractPersonName(text),
      },
      raw: text,
    };
  }
  if (role === 'admin' && /\b(disable|deactivate|suspend)\b/.test(t) && /\buser\b/.test(t)) {
    return { type: 'toggle_user', entities: { username: extractUsername(text), activate: false }, raw: text };
  }
  if (role === 'admin' && /\b(activate|enable|re-?enable)\b/.test(t) && /\buser\b/.test(t)) {
    return { type: 'toggle_user', entities: { username: extractUsername(text), activate: true }, raw: text };
  }
  if (role === 'admin' && /\b(reset|change)\b.*\bpassword\b/.test(t)) {
    return { type: 'reset_password', entities: { username: extractUsername(text) }, raw: text };
  }

  // ----- CEO set status -----
  const status = extractCeoStatus(text);
  if ((role === 'ceo') && /\b(set|change|update)\b.*\b(status|availability)\b/.test(t)) {
    return { type: 'set_status', entities: status ? { status } : {}, raw: text };
  }
  if (role === 'ceo' && status && /\b(set|change|update|switch|put|go)\b/.test(t)) {
    return { type: 'set_status', entities: { status }, raw: text };
  }

  // ----- help -----
  if (/\b(help|what can you do|commands|how do you work|who are you)\b/.test(t)) {
    return { type: 'help', entities: {}, raw: text };
  }

  // ----- greetings (must beat partial date words in other rules) -----
  if (/^\s*(hi|hey|hello|yo|sup|hola|namaste|good (morning|afternoon|evening))\b/i.test(text)) {
    return { type: 'smalltalk', entities: { kind: 'greeting' }, raw: text };
  }

  return { type: 'unknown', entities: {}, raw: text };
}

// ---------- LLM seam (implement later) ----------

function sanitizeIntent(parsed, rawText) {
  const fallback = { type: 'unknown', entities: {}, raw: rawText };
  if (!parsed || typeof parsed !== 'object') return fallback;

  const allowedTypes = new Set([
    'create_meeting',
    'request_meeting',
    'request_leave',
    'assign_task',
    'create_task',
    'show_tasks',
    'show_assigned_tasks',
    'show_requests',
    'show_meetings',
    'list_pending_requests',
    'approve_request',
    'reject_request',
    'show_analytics',
    'list_users',
    'create_user',
    'toggle_user',
    'reset_password',
    'set_status',
    'help',
    'smalltalk',
    'unknown',
  ]);

  const type = typeof parsed.type === 'string' && allowedTypes.has(parsed.type)
    ? parsed.type
    : 'unknown';

  const entities = parsed.entities && typeof parsed.entities === 'object'
    ? parsed.entities
    : {};

  return { type, entities, raw: rawText };
}

async function parseWithLLM(text, ctx = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing');
  }

  const role = ctx.role || 'employee';
  const systemPrompt = [
    'You are an intent parser for an ERP assistant named Codeo.',
    'Return only valid JSON with this exact shape: {"type":"...", "entities":{...}}.',
    'Allowed intent types:',
    'create_meeting, request_meeting, request_leave, assign_task, create_task, show_tasks, show_assigned_tasks, show_requests, show_meetings, list_pending_requests, approve_request, reject_request, show_analytics, list_users, create_user, toggle_user, reset_password, set_status, help, smalltalk, unknown.',
    `User role: ${role}.`,
    'Role rules: employee — request_meeting, request_leave, create_task, show_tasks, show_requests only; never create_meeting, assign_task, approve/reject, admin user ops.',
    'ceo — create_meeting, assign_task, create_task, list_pending_requests, approve_request, reject_request, set_status, show_analytics; not create_user.',
    'admin — create_meeting, assign_task, create_task, list_users, create_user, toggle_user, reset_password, show_analytics; not set_status or approve_request.',
    'Extract entities when present: title, team, date, time, duration, urgency, priority, dueDate, reason, status, isInterview, subtype, requestId, requestIndex, requestTitle, rejectionReason, username, fullName, password, role, department, activate.',
    'Date should be ISO date (YYYY-MM-DD) when explicit; time should be HH:mm 24h when explicit.',
    'If uncertain, return {"type":"unknown","entities":{}}.',
    'Do not include markdown fences. JSON only.',
  ].join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const resp = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Groq request failed (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Groq returned empty content');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      // Tolerate accidental wrapping text and attempt to recover JSON object.
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    return sanitizeIntent(parsed, text);
  } finally {
    clearTimeout(timeout);
  }
}

async function parseIntent(text, ctx = {}) {
  if (USE_LLM) {
    try {
      return await parseWithLLM(text, ctx);
    } catch (e) {
      // graceful fallback so Codeo never breaks
      return parseOffline(text, ctx);
    }
  }
  return parseOffline(text, ctx);
}

module.exports = {
  parseIntent,
  parseDate,
  parseTime,
  parseDuration,
  isValidUsername,
  normalizeUsername,
  pickUsernameFromFreeText,
  extractCeoStatus,
};
