const {
  parseIntent,
  parseDate,
  parseTime,
  parseDuration,
  isValidUsername,
  normalizeUsername,
  pickUsernameFromFreeText,
  extractCeoStatus,
} = require('../utils/codeoIntent');
const { normalizeDateOnly } = require('../utils/dateOnly');
const Meeting = require('../models/Meeting');
const MeetingRequest = require('../models/MeetingRequest');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const CodeoConversation = require('../models/CodeoConversation');
const AvailabilityStatus = require('../models/AvailabilityStatus');
const User = require('../models/User');

// ---- helpers -------------------------------------------------------------

const generateMeetCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const notify = async (io, recipient, type, title, message, relatedRequest) => {
  const n = await Notification.create({ recipient, type, title, message, relatedRequest });
  if (io) io.to(`user_${recipient}`).emit('new_notification', n.toObject());
  return n;
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'soon');

// Persist a turn into the user's Codeo conversation memory.
const remember = async (userId, userText, codeoText, action) => {
  await CodeoConversation.findOneAndUpdate(
    { user: userId },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', text: userText },
            { role: 'codeo', text: codeoText, action: action || null },
          ],
          $slice: -100, // keep last 100 messages
        },
      },
    },
    { upsert: true, new: true }
  );
};

const isPrivileged = (role) => role === 'ceo' || role === 'admin';

const CEO_ONLY = new Set(['approve_request', 'reject_request', 'set_status']);
const ADMIN_ONLY = new Set(['list_users', 'create_user', 'toggle_user', 'reset_password']);

const hasRequestRef = (entities = {}) => !!(
  entities.requestId
  || entities.requestIndex
  || entities.requestTitle
);

const normalizeIntentType = (intentType, role) => {
  if (intentType === 'create_meeting' && !isPrivileged(role)) return 'request_meeting';
  if (intentType === 'assign_task' && !isPrivileged(role)) return 'create_task';
  if (CEO_ONLY.has(intentType) && role !== 'ceo') return 'unknown';
  if (ADMIN_ONLY.has(intentType) && role !== 'admin') return 'unknown';
  if (intentType === 'show_assigned_tasks' && !isPrivileged(role)) return 'show_tasks';
  if (intentType === 'list_pending_requests' && role === 'employee') return 'unknown';
  if (intentType === 'show_analytics' && !isPrivileged(role)) return 'unknown';
  return intentType;
};

const stripAutofilledDefaults = (intentType, entities = {}) => {
  const next = { ...entities };

  // Parser fallbacks should not count as "user-provided" values in slot-filling.
  if (intentType === 'request_meeting' && next.title === 'Meeting with manager') {
    delete next.title;
  }
  if (intentType === 'create_meeting' && next.title === 'Team Meeting') {
    delete next.title;
  }
  if (intentType === 'assign_task' && next.title === 'New task') {
    delete next.title;
  }
  if (intentType === 'create_task' && (next.title === 'New task' || !next.title)) {
    delete next.title;
  }
  if (intentType === 'request_leave' && next.reason === 'Leave request') {
    delete next.reason;
  }
  if (intentType === 'create_user') {
    if (!isValidUsername(next.username)) delete next.username;
    if (!next.fullName || String(next.fullName).trim().length < 2) delete next.fullName;
    if (!next.password) delete next.password;
    if (!next.role) delete next.role;
  }

  return next;
};

const CEO_STATUSES = new Set(['available', 'in_meeting', 'deep_work', 'emergency_only', 'offline']);

const needsFlow = (intentType, entities = {}) => {
  if (intentType === 'approve_request' || intentType === 'reject_request') {
    return !hasRequestRef(entities);
  }
  if (intentType === 'set_status') {
    return !entities.status || !CEO_STATUSES.has(entities.status);
  }
  if (intentType === 'toggle_user') return !entities.username;
  if (intentType === 'reset_password') {
    return !entities.username || !entities.newPassword;
  }
  if (intentType === 'create_meeting'
    || intentType === 'request_meeting'
    || intentType === 'request_leave'
    || intentType === 'assign_task'
    || intentType === 'create_task'
    || intentType === 'create_user') {
    return true;
  }
  return false;
};

const getRequiredFields = (intentType) => getFieldOrder(intentType);

const getFieldOrder = (intentType) => {
  switch (intentType) {
    case 'create_meeting':
      return ['title', 'date', 'time'];
    case 'request_meeting':
      return ['title', 'purpose', 'agenda', 'urgency', 'date', 'time'];
    case 'request_leave':
      return ['date', 'reason'];
    case 'assign_task':
      return ['title'];
    case 'create_task':
      return ['title'];
    case 'set_status':
      return ['status'];
    case 'approve_request':
    case 'reject_request':
      return ['requestRef'];
    case 'create_user':
      return ['username', 'fullName', 'password', 'role'];
    case 'toggle_user':
      return ['username'];
    case 'reset_password':
      return ['username', 'newPassword'];
    default:
      return [];
  }
};

const entityHasValue = (intentType, field, entities = {}) => {
  if (field === 'requestRef') return hasRequestRef(entities);
  if (field === 'username') return isValidUsername(entities.username);
  if (field === 'fullName') return String(entities.fullName || '').trim().length >= 2;
  if (field === 'password') return String(entities.password || '').length >= 6;
  if (field === 'role') return ['employee', 'ceo', 'admin'].includes(entities.role);
  if (field === 'status') return CEO_STATUSES.has(entities.status);
  return !!entities[field];
};

const getMissingFields = (intentType, entities = {}) => (
  getFieldOrder(intentType).filter((f) => !entityHasValue(intentType, f, entities))
);

const getNextMissingField = (intentType, entities = {}) => (
  getMissingFields(intentType, entities)[0] || null
);

const buildCollectingReply = (intentType, nextField, entities, userText = '') => {
  const question = askForField(intentType, nextField);
  const intro = intentType === 'create_user' && nextField === 'username'
    && !isValidUsername(entities?.username)
    ? "I'll set up a new user account. "
    : '';
  if (
    intentType === 'create_user'
    && nextField === 'username'
    && String(userText || '').trim()
    && !isValidUsername(entities?.username)
  ) {
    return `${intro}That username isn't valid. ${question}`;
  }
  return `${intro}${question}`;
};

const askForField = (intentType, field) => {
  if (field === 'title') return 'What should I call it? (for example: "Weekly frontend sync")';
  if (field === 'purpose') return 'What is the purpose of this meeting?';
  if (field === 'agenda') return 'What agenda should I include?';
  if (field === 'urgency') return 'How urgent is it? (low, medium, high)';
  if (field === 'date') return 'What date should I use? (for example: tomorrow, next Monday, or 2026-06-10)';
  if (field === 'time') return 'What time should I set? (for example: 5 PM or 17:00)';
  if (field === 'reason') return 'What reason should I include?';
  if (field === 'team') return 'Which team should I assign this to (HR, frontend, sales, etc.)?';
  if (field === 'requestRef') return 'Which request? Reply with the list number (e.g. 1) or the request title.';
  if (field === 'username') {
    return 'What username should they use to log in? (e.g. jsmith — 3–30 letters, numbers, dots, underscores, or hyphens)';
  }
  if (field === 'fullName') return 'What is their full name?';
  if (field === 'password') return 'What temporary password should I set? (min 6 characters)';
  if (field === 'newPassword') return 'What should the new password be? (min 6 characters)';
  if (field === 'role') return 'What role? (employee, ceo, or admin)';
  if (field === 'status') {
    return 'Which status should I set? Choose: available, in meeting, deep work, emergency only, or offline.';
  }
  return `Can you share the missing detail: ${field}?`;
};

const yesRe = /^\s*(yes|y|confirm|confirmed|go ahead|do it|proceed|sure|ok|okay)\b/i;
const noRe = /^\s*(no|n|cancel|stop|never mind|dont|don't)\b/i;

const extractTitle = (text, fallback) => {
  const quoted = text.match(/["“'](.+?)["”']/);
  if (quoted) return quoted[1].trim();
  const after = text.match(/\b(?:called|titled|about|regarding|for|on)\s+(.+)$/i);
  return (after && after[1] ? after[1].trim() : fallback);
};

const extractTeam = (text) => {
  const m = text.match(/\b(?:to|for)\s+(?:the\s+)?([a-z]+)\s+(?:team|department|dept)\b/i);
  if (m) return m[1].toLowerCase();
  const m2 = text.match(/\b(hr|frontend|backend|sales|marketing|design|engineering|finance|qa|devops)\b/i);
  return m2 ? m2[1].toLowerCase() : '';
};

const extractUrgency = (text) => {
  const t = String(text || '').toLowerCase();
  if (/\b(asap|urgent|emergency|critical|high)\b/.test(t)) return 'high';
  if (/\b(medium|normal|standard)\b/.test(t)) return 'medium';
  if (/\b(low|not urgent|whenever)\b/.test(t)) return 'low';
  return null;
};

const extractFlowEntities = (text, intentType, base = {}, fieldHint = null) => {
  const cleaned = String(text || '').trim();
  const entities = { ...base };
  const date = parseDate(cleaned);
  const time = parseTime(cleaned);
  const duration = parseDuration(cleaned);
  if (date) entities.date = date;
  if (time) entities.time = time;
  if (duration) entities.duration = duration;

  if (intentType === 'assign_task') {
    const team = extractTeam(cleaned);
    if (team) entities.team = team;
    const title = extractTitle(cleaned, '');
    if (title && !/^\s*(yes|no|cancel|stop)\b/i.test(cleaned)) entities.title = title;
  } else if (intentType === 'create_task') {
    const title = extractTitle(cleaned, '');
    if (title && !/^\s*(yes|no|cancel|stop)\b/i.test(cleaned)) entities.title = title;
    const priority = extractUrgency(cleaned);
    if (priority) entities.priority = priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium';
  } else if (intentType === 'request_leave') {
    const reason = extractTitle(cleaned, '').replace(/\b(on|for)\s+\d.*$/i, '').trim();
    if (reason) entities.reason = reason;
  } else if (intentType === 'create_meeting') {
    const title = extractTitle(cleaned, '');
    if (title && !/^\s*(yes|no|cancel|stop)\b/i.test(cleaned)) entities.title = title;
  } else if (intentType === 'request_meeting') {
    const title = extractTitle(cleaned, '');
    if (title && !/^\s*(yes|no|cancel|stop)\b/i.test(cleaned)) entities.title = title;
    const urgency = extractUrgency(cleaned);
    if (urgency) entities.urgency = urgency;
  } else if (intentType === 'set_status') {
    const status = extractCeoStatus(cleaned);
    if (status) entities.status = status;
  }

  // If Codeo asked a specific field, accept plain short replies directly.
  if (!yesRe.test(cleaned) && !noRe.test(cleaned) && fieldHint) {
    if (fieldHint === 'title' && !entities.title) {
      entities.title = cleaned;
    } else if (fieldHint === 'purpose' && !entities.purpose) {
      entities.purpose = cleaned;
    } else if (fieldHint === 'agenda' && !entities.agenda) {
      entities.agenda = cleaned;
    } else if (fieldHint === 'reason' && !entities.reason) {
      entities.reason = cleaned;
    } else if (fieldHint === 'team' && !entities.team) {
      const directTeam = cleaned.replace(/\bteam\b/i, '').trim().toLowerCase();
      if (directTeam) entities.team = directTeam;
    } else if (fieldHint === 'urgency' && !entities.urgency) {
      const urgency = extractUrgency(cleaned);
      if (urgency) entities.urgency = urgency;
    } else if (fieldHint === 'time' && !entities.time) {
      const hourOnly = cleaned.match(/^\s*(\d{1,2})\s*$/);
      if (hourOnly) {
        const hr = Math.max(0, Math.min(23, Number(hourOnly[1])));
        entities.time = `${String(hr).padStart(2, '0')}:00`;
      }
    } else if (fieldHint === 'requestRef') {
      const num = cleaned.match(/^\s*#?(\d{1,2})\s*$/);
      if (num) entities.requestIndex = Number(num[1]);
      else if (cleaned) entities.requestTitle = cleaned;
    } else if (fieldHint === 'username') {
      const candidate = normalizeUsername(cleaned);
      if (isValidUsername(candidate)) entities.username = candidate;
    } else if (fieldHint === 'fullName' && !entities.fullName) {
      entities.fullName = cleaned;
    } else if (fieldHint === 'password' && !entities.password) {
      entities.password = cleaned;
    } else if (fieldHint === 'newPassword' && !entities.newPassword) {
      entities.newPassword = cleaned;
    } else if (fieldHint === 'role' && !entities.role) {
      const r = cleaned.toLowerCase();
      if (['employee', 'ceo', 'admin'].includes(r)) entities.role = r;
    } else if (fieldHint === 'status' && !entities.status) {
      const status = extractCeoStatus(cleaned);
      if (status) entities.status = status;
    }
  }

  if (intentType === 'create_user' && !fieldHint) {
    const picked = pickUsernameFromFreeText(cleaned);
    if (picked) entities.username = picked;
    const roleMatch = cleaned.match(/\b(employee|ceo|admin)\b/i);
    if (roleMatch && !entities.role) entities.role = roleMatch[1].toLowerCase();
  }

  return entities;
};

const summarizeFlow = (intentType, entities = {}) => {
  if (intentType === 'create_meeting' || intentType === 'request_meeting') {
    if (intentType === 'request_meeting') {
      return `title "${entities.title}", purpose "${entities.purpose}", urgency ${entities.urgency}, date ${fmtDate(entities.date)}, time ${entities.time}`;
    }
    return `title "${entities.title}", date ${fmtDate(entities.date)}, time ${entities.time}`;
  }
  if (intentType === 'request_leave') {
    return `date ${fmtDate(entities.date)}, reason "${entities.reason}"`;
  }
  if (intentType === 'assign_task') {
    const team = entities.team ? `, team ${entities.team}` : '';
    return `task "${entities.title}"${team}${entities.dueDate ? `, due ${fmtDate(entities.dueDate)}` : ''}`;
  }
  if (intentType === 'create_task') {
    return `task "${entities.title}"${entities.priority ? `, priority ${entities.priority}` : ''}${entities.dueDate ? `, due ${fmtDate(entities.dueDate)}` : ''}`;
  }
  if (intentType === 'create_user') {
    return `user @${entities.username} (${entities.fullName}), role ${entities.role}`;
  }
  if (intentType === 'toggle_user') {
    return `user @${entities.username} — ${entities.activate === false ? 'deactivate' : 'activate'}`;
  }
  if (intentType === 'reset_password') {
    return `reset password for @${entities.username}`;
  }
  if (intentType === 'approve_request' || intentType === 'reject_request') {
    return entities.requestTitle
      ? `request "${entities.requestTitle}"`
      : entities.requestIndex
      ? `request #${entities.requestIndex}`
      : 'the selected request';
  }
  return 'the requested action';
};

const buildConfirmReply = (intentType, entities) => {
  const summary = summarizeFlow(intentType, entities);
  if (intentType === 'create_task' || intentType === 'assign_task') {
    return `Perfect. I have ${summary}. Should I create this task? Say "yes" to confirm or "no" to cancel.`;
  }
  return `Got it. I have ${summary}. Should I proceed? Say "yes" to confirm or "no" to cancel.`;
};

const setPendingFlow = async (userId, flow) => {
  await CodeoConversation.findOneAndUpdate(
    { user: userId },
    { $set: { pendingFlow: flow } },
    { upsert: true, new: true }
  );
};

const clearPendingFlow = async (userId) => {
  await CodeoConversation.findOneAndUpdate(
    { user: userId },
    { $set: { pendingFlow: null } },
    { upsert: true, new: true }
  );
};

const emitCodeoAction = (req, result) => {
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${req.user.id}`).emit('codeo_action', {
      mood: result.mood,
      action: result.action,
      reply: result.reply,
    });
  }
};

// ---- action executors ----------------------------------------------------

async function doCreateMeeting(req, intent) {
  const io = req.app.get('io');
  const e = intent.entities;

  const date = e.date || (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
  const time = e.time || '10:00';

  // Resolve participants: by team if given, else all employees.
  let participantQuery = { isActive: true, role: 'employee' };
  if (e.team) participantQuery.department = new RegExp(e.team, 'i');
  let participants = await User.find(participantQuery).select('_id fullName');
  if (participants.length === 0) {
    participants = await User.find({ isActive: true, role: 'employee' }).select('_id fullName');
  }
  const participantIds = participants.map((p) => p._id);

  const code = generateMeetCode();
  const meetLink = `https://meet.jit.si/${code}`;

  const meeting = await Meeting.create({
    title: e.title || 'Team Meeting',
    description: e.isInterview ? 'Interview scheduled via Codeo' : 'Scheduled via Codeo',
    date, time, duration: e.duration || 30,
    participants: participantIds,
    createdBy: req.user.id,
    meetLink, meetingCode: code,
    status: 'upcoming',
  });

  for (const pid of participantIds) {
    const n = await Notification.create({
      recipient: pid,
      type: 'meeting_pending',
      title: '📹 New Meeting (via Codeo)',
      message: `${req.user.fullName} scheduled "${meeting.title}" on ${fmtDate(date)} at ${time}. Join: ${meetLink}`,
      relatedRequest: meeting._id,
    });
    if (io) {
      io.to(`user_${pid}`).emit('new_notification', n);
      io.to(`user_${pid}`).emit('new_meeting', meeting);
    }
  }

  const reply = `Done ✨ I scheduled "${meeting.title}" for ${fmtDate(date)} at ${time}, generated a Meet link, and notified ${participantIds.length} ${participantIds.length === 1 ? 'person' : 'people'}.`;
  return {
    reply,
    action: { kind: 'create_meeting', meetingId: meeting._id, meetLink, count: participantIds.length },
    mood: 'celebrate',
  };
}

async function doRequestMeeting(req, intent) {
  const io = req.app.get('io');
  const e = intent.entities;
  const date = e.date || (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

  const request = await MeetingRequest.create({
    title: e.title || 'Meeting with manager',
    purpose: e.purpose || e.title || 'Requested via Codeo',
    agenda: e.agenda || intent.raw,
    urgency: e.urgency || 'medium',
    preferredDate: normalizeDateOnly(date),
    preferredTime: e.time || '10:00',
    duration: e.duration || 30,
    requestedBy: req.user.id,
  });

  const ceo = await User.findOne({ role: 'ceo' });
  if (ceo) {
    await notify(io, ceo._id, 'meeting_pending', 'New Meeting Request',
      `${req.user.fullName} requested a meeting: "${request.title}"`, request._id);
  }

  return {
    reply: `Got it ✅ I sent your meeting request "${request.title}" (${request.urgency} urgency) for ${fmtDate(date)} to the CEO. I'll ping you the moment it's reviewed.`,
    action: { kind: 'request_meeting', requestId: request._id },
    mood: 'happy',
  };
}

async function doRequestLeave(req, intent) {
  const io = req.app.get('io');
  const e = intent.entities;
  const date = e.date;

  // Reuse MeetingRequest as the generic "request" store (urgency=leave-ish),
  // tagged so it's distinguishable. Keeps us from adding a model you may
  // already plan to design differently.
  const request = await MeetingRequest.create({
    title: e.subtype === 'shift_change' ? 'Shift Change Request' : 'Leave Request',
    purpose: e.reason || 'Leave',
    agenda: intent.raw,
    urgency: 'low',
    preferredDate: normalizeDateOnly(date || new Date()),
    preferredTime: e.time || '09:00',
    duration: 0,
    notes: 'Submitted via Codeo',
    requestedBy: req.user.id,
  });

  const ceo = await User.findOne({ role: 'ceo' });
  if (ceo) {
    await notify(io, ceo._id, 'meeting_pending', '🌿 Leave / Shift Request',
      `${req.user.fullName} submitted: "${request.title}"`, request._id);
  }

  return {
    reply: `Submitted 🌿 Your ${request.title.toLowerCase()}${date ? ` for ${fmtDate(date)}` : ''} is now pending approval. I'll track it and update you.`,
    action: { kind: 'request_leave', requestId: request._id },
    mood: 'sad',
  };
}

async function doCreateTask(req, intent) {
  const io = req.app.get('io');
  const e = intent.entities;
  const title = (e.title || '').trim();
  if (!title) {
    return { reply: 'What should I call this task?', action: null, mood: 'thinking' };
  }

  const task = await Task.create({
    title,
    description: intent.raw || '',
    assignedTo: req.user.id,
    assignedBy: req.user.id,
    team: '',
    priority: e.priority || 'medium',
    dueDate: e.dueDate || null,
    createdByCodeo: true,
  });

  if (io) io.to(`user_${req.user.id}`).emit('new_task', task);

  return {
    reply: `Done ✨ I created your task "${task.title}"${task.dueDate ? ` (due ${fmtDate(task.dueDate)})` : ''}. You can see it in your task list.`,
    action: { kind: 'create_task', taskId: task._id, title: task.title },
    mood: 'celebrate',
  };
}

async function doAssignTask(req, intent) {
  const io = req.app.get('io');
  const e = intent.entities;

  // Resolve assignee(s) by team; if none, this becomes an unassigned team task
  // assigned to the first matching member, else to the requester as a placeholder.
  let assignee = null;
  if (e.team) {
    assignee = await User.findOne({ isActive: true, department: new RegExp(e.team, 'i') }).select('_id fullName');
  }
  if (!assignee) {
    assignee = await User.findOne({ isActive: true, role: 'employee' }).select('_id fullName');
  }
  if (!assignee) {
    return { reply: `I couldn't find anyone to assign that to yet. Add a team member first and I'll handle it.`, action: null, mood: 'thinking' };
  }

  const task = await Task.create({
    title: e.title || 'New task',
    description: intent.raw,
    assignedTo: assignee._id,
    assignedBy: req.user.id,
    team: e.team || '',
    priority: e.priority || 'medium',
    dueDate: e.dueDate || null,
    createdByCodeo: true,
  });

  await notify(io, assignee._id, 'status_update', '✅ New Task Assigned',
    `${req.user.fullName} assigned you: "${task.title}"${e.priority === 'urgent' ? ' (urgent)' : ''}`, null);
  if (io) io.to(`user_${assignee._id}`).emit('new_task', task);

  return {
    reply: `Done ✨ I assigned "${task.title}" to ${assignee.fullName}${e.team ? ` (${e.team} team)` : ''} and notified them.`,
    action: { kind: 'assign_task', taskId: task._id, assignee: assignee.fullName },
    mood: 'celebrate',
  };
}

async function doShowTasks(req) {
  const tasks = await Task.find({ assignedTo: req.user.id, status: { $ne: 'cancelled' } })
    .sort({ status: 1, dueDate: 1 }).limit(10);
  if (tasks.length === 0) {
    return { reply: `You're all clear 🎉 No open tasks assigned to you right now.`, action: { kind: 'show_tasks', tasks: [] }, mood: 'happy' };
  }
  const open = tasks.filter((t) => t.status !== 'completed').length;
  return {
    reply: `You have ${open} open task${open === 1 ? '' : 's'} assigned to you. Top: "${tasks[0].title}"${tasks[0].dueDate ? ` (due ${fmtDate(tasks[0].dueDate)})` : ''}.`,
    action: { kind: 'show_tasks', tasks: tasks.map((t) => ({ id: t._id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate })) },
    mood: 'focused',
  };
}

async function doShowAssignedTasks(req) {
  const tasks = await Task.find({ assignedBy: req.user.id, status: { $ne: 'cancelled' } })
    .populate('assignedTo', 'fullName')
    .sort({ createdAt: -1 })
    .limit(10);
  if (tasks.length === 0) {
    return {
      reply: `You haven't assigned any tasks yet. Say "assign task to HR team" to create one.`,
      action: { kind: 'show_assigned_tasks', tasks: [] },
      mood: 'happy',
    };
  }
  const open = tasks.filter((t) => t.status !== 'completed').length;
  const top = tasks[0];
  const who = top.assignedTo?.fullName || 'someone';
  return {
    reply: `You assigned ${open} open task${open === 1 ? '' : 's'}. Latest: "${top.title}" → ${who} (${top.status}).`,
    action: {
      kind: 'show_assigned_tasks',
      tasks: tasks.map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        assignee: t.assignedTo?.fullName,
      })),
    },
    mood: 'focused',
  };
}

async function fetchPendingRequests(limit = 8) {
  return MeetingRequest.find({ status: 'pending' })
    .populate('requestedBy', 'fullName username department')
    .sort({ urgency: -1, createdAt: -1 })
    .limit(limit);
}

async function resolvePendingRequest(entities = {}) {
  if (entities.requestId) {
    const byId = await MeetingRequest.findById(entities.requestId).populate('requestedBy', 'fullName');
    if (byId) return byId;
  }
  const pending = await fetchPendingRequests(10);
  const titleHint = (entities.requestTitle || '').toLowerCase();
  if (titleHint && /\bpending\b/.test(titleHint) && pending.length > 0) {
    return pending[0];
  }
  if (entities.requestIndex) {
    const idx = Number(entities.requestIndex) - 1;
    if (pending[idx]) return pending[idx];
  }
  if (entities.requestTitle) {
    const needle = entities.requestTitle.toLowerCase();
    const match = pending.find((r) => r.title.toLowerCase().includes(needle)
      || r.requestedBy?.fullName?.toLowerCase().includes(needle));
    if (match) return match;
  }
  if (pending.length === 1) return pending[0];
  return null;
}

function formatPendingList(requests) {
  if (!requests.length) return 'No pending requests right now — inbox is clear ✅';
  return requests.map((r, i) => {
    const who = r.requestedBy?.fullName || 'Unknown';
    return `${i + 1}. "${r.title}" — ${who} (${r.urgency}, ${fmtDate(r.preferredDate)})`;
  }).join('\n');
}

async function doListPendingRequests(req) {
  const pending = await fetchPendingRequests(8);
  const lines = formatPendingList(pending);
  const reply = pending.length
    ? `📥 ${pending.length} pending request${pending.length === 1 ? '' : 's'}:\n${lines}\n\nSay "approve 1" or "reject 2" to act on one.`
    : lines;
  return {
    reply,
    action: {
      kind: 'list_pending_requests',
      requests: pending.map((r, i) => ({
        index: i + 1,
        id: r._id,
        title: r.title,
        requester: r.requestedBy?.fullName,
        urgency: r.urgency,
      })),
    },
    mood: pending.length ? 'focused' : 'happy',
  };
}

async function doApproveRequest(req, intent) {
  const io = req.app.get('io');
  const request = await resolvePendingRequest(intent.entities || {});
  if (!request) {
    const pending = await fetchPendingRequests(5);
    return {
      reply: `I couldn't find that request. ${pending.length ? `Pending:\n${formatPendingList(pending)}` : 'Nothing is pending.'}`,
      action: { kind: 'approve_request', needsPick: true, requests: pending.map((r, i) => ({ index: i + 1, id: r._id, title: r.title })) },
      mood: 'thinking',
    };
  }
  if (request.status !== 'pending') {
    return { reply: `"${request.title}" is already ${request.status}.`, action: null, mood: 'surprised' };
  }
  request.status = 'approved';
  request.reviewedBy = req.user.id;
  request.approvedDate = normalizeDateOnly(request.preferredDate);
  request.approvedTime = request.preferredTime;
  await request.save();
  await request.populate('requestedBy', 'fullName');
  if (request.requestedBy) {
    await notify(io, request.requestedBy._id, 'meeting_approved', '✅ Request Approved',
      `Your request "${request.title}" was approved for ${fmtDate(request.approvedDate)}.`, request._id);
  }
  return {
    reply: `Approved ✅ "${request.title}" from ${request.requestedBy?.fullName || 'the employee'} — they're notified.`,
    action: { kind: 'approve_request', requestId: request._id, title: request.title },
    mood: 'celebrate',
  };
}

async function doRejectRequest(req, intent) {
  const io = req.app.get('io');
  const e = intent.entities || {};
  const request = await resolvePendingRequest(e);
  if (!request) {
    const pending = await fetchPendingRequests(5);
    return {
      reply: `I couldn't find that request. ${pending.length ? `Pending:\n${formatPendingList(pending)}` : 'Nothing is pending.'}`,
      action: { kind: 'reject_request', needsPick: true, requests: pending.map((r, i) => ({ index: i + 1, id: r._id, title: r.title })) },
      mood: 'thinking',
    };
  }
  if (request.status !== 'pending') {
    return { reply: `"${request.title}" is already ${request.status}.`, action: null, mood: 'surprised' };
  }
  const reason = e.rejectionReason || 'Not approved at this time';
  request.status = 'rejected';
  request.reviewedBy = req.user.id;
  request.rejectionReason = reason;
  await request.save();
  await request.populate('requestedBy', 'fullName');
  if (request.requestedBy) {
    await notify(io, request.requestedBy._id, 'meeting_rejected', '❌ Request Rejected',
      `Your request "${request.title}" was rejected. ${reason ? `Reason: ${reason}` : ''}`, request._id);
  }
  return {
    reply: `Rejected "${request.title}"${reason ? ` — reason: ${reason}` : ''}. The employee is notified.`,
    action: { kind: 'reject_request', requestId: request._id, title: request.title },
    mood: 'cool',
  };
}

async function doShowAnalytics(req) {
  const [total, pending, approved, rejected, completed] = await Promise.all([
    MeetingRequest.countDocuments(),
    MeetingRequest.countDocuments({ status: 'pending' }),
    MeetingRequest.countDocuments({ status: 'approved' }),
    MeetingRequest.countDocuments({ status: 'rejected' }),
    MeetingRequest.countDocuments({ status: 'completed' }),
  ]);
  const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
  const userCount = await User.countDocuments({ isActive: true });
  return {
    reply: `📊 Analytics: ${total} total requests — ${pending} pending, ${approved} approved, ${rejected} rejected, ${completed} completed (${rate}% approval rate). ${userCount} active users.`,
    action: { kind: 'show_analytics', total, pending, approved, rejected, completed, approvalRate: rate, activeUsers: userCount },
    mood: 'focused',
  };
}

async function doListUsers(req) {
  const users = await User.find().select('username fullName role department isActive').sort({ fullName: 1 }).limit(12);
  if (!users.length) {
    return { reply: 'No users in the system yet.', action: { kind: 'list_users', users: [] }, mood: 'happy' };
  }
  const lines = users.map((u) => `${u.isActive ? '🟢' : '⚫'} @${u.username} — ${u.fullName} (${u.role}${u.department ? `, ${u.department}` : ''})`).join('\n');
  return {
    reply: `👥 Users (${users.length} shown):\n${lines}`,
    action: { kind: 'list_users', users: users.map((u) => ({ id: u._id, username: u.username, fullName: u.fullName, role: u.role, isActive: u.isActive })) },
    mood: 'focused',
  };
}

async function doCreateUser(req, intent) {
  const e = intent.entities || {};
  const username = normalizeUsername(e.username);
  if (!isValidUsername(username)) {
    return {
      reply: 'I need a valid login username first (3–30 characters: letters, numbers, . _ -). Try: "create user" and I\'ll ask step by step.',
      action: null,
      mood: 'thinking',
    };
  }
  const existing = await User.findOne({ username });
  if (existing) {
    return { reply: `Username @${e.username} already exists. Pick another username.`, action: null, mood: 'surprised' };
  }
  if (!e.password || String(e.password).length < 6) {
    return { reply: 'Password must be at least 6 characters.', action: null, mood: 'thinking' };
  }
  const role = ['admin', 'ceo', 'employee'].includes(e.role) ? e.role : 'employee';
  const user = await User.create({
    username,
    password: e.password,
    role,
    fullName: e.fullName,
    email: e.email || '',
    department: e.department || '',
  });
  return {
    reply: `Created user @${user.username} (${user.fullName}) as ${user.role} ✅`,
    action: { kind: 'create_user', userId: user._id, username: user.username, role: user.role },
    mood: 'celebrate',
  };
}

async function doToggleUser(req, intent) {
  const e = intent.entities || {};
  const user = await User.findOne({ username: e.username });
  if (!user) {
    return { reply: `No user @${e.username} found.`, action: null, mood: 'surprised' };
  }
  if (user._id.toString() === req.user.id) {
    return { reply: `I can't deactivate your own account.`, action: null, mood: 'thinking' };
  }
  const targetActive = e.activate !== false;
  user.isActive = targetActive;
  await user.save({ validateBeforeSave: false });
  return {
    reply: `${targetActive ? 'Activated' : 'Deactivated'} @${user.username} (${user.fullName}) ✅`,
    action: { kind: 'toggle_user', userId: user._id, isActive: user.isActive },
    mood: 'cool',
  };
}

async function doResetPassword(req, intent) {
  const e = intent.entities || {};
  const user = await User.findOne({ username: e.username });
  if (!user) {
    return { reply: `No user @${e.username} found.`, action: null, mood: 'surprised' };
  }
  if (!e.newPassword || String(e.newPassword).length < 6) {
    return { reply: 'New password must be at least 6 characters.', action: null, mood: 'thinking' };
  }
  user.password = e.newPassword;
  await user.save();
  return {
    reply: `Password reset for @${user.username} (${user.fullName}) 🔐`,
    action: { kind: 'reset_password', userId: user._id, username: user.username },
    mood: 'cool',
  };
}

async function doShowMeetings(req) {
  const q = req.user.role === 'employee' ? { participants: req.user.id } : {};
  const meetings = await Meeting.find({ ...q, status: { $in: ['upcoming', 'live'] } }).sort({ date: 1 }).limit(5);
  if (meetings.length === 0) return { reply: `No upcoming meetings on your calendar 📅`, action: { kind: 'show_meetings', meetings: [] }, mood: 'happy' };
  return {
    reply: `You have ${meetings.length} upcoming meeting${meetings.length === 1 ? '' : 's'}. Next: "${meetings[0].title}" on ${fmtDate(meetings[0].date)} at ${meetings[0].time}.`,
    action: { kind: 'show_meetings', meetings: meetings.map((m) => ({ id: m._id, title: m.title, date: m.date, time: m.time, meetLink: m.meetLink })) },
    mood: 'happy',
  };
}

async function doShowRequests(req) {
  const requests = await MeetingRequest.find({ requestedBy: req.user.id }).sort({ createdAt: -1 }).limit(5);
  if (requests.length === 0) return { reply: `You haven't made any requests yet. Just tell me what you need!`, action: { kind: 'show_requests', requests: [] }, mood: 'happy' };
  const pending = requests.filter((r) => r.status === 'pending').length;
  return {
    reply: `You have ${requests.length} recent request${requests.length === 1 ? '' : 's'}, ${pending} still pending. Latest: "${requests[0].title}" — ${requests[0].status}.`,
    action: { kind: 'show_requests', requests: requests.map((r) => ({ id: r._id, title: r.title, status: r.status })) },
    mood: 'happy',
  };
}

async function doSetStatus(req, intent) {
  const io = req.app.get('io');
  const status = intent.entities?.status;
  if (!status || !CEO_STATUSES.has(status)) {
    return {
      reply: 'Which status should I set? Choose: available, in meeting, deep work, emergency only, or offline.',
      action: { kind: 'flow_collecting', type: 'set_status', missing: ['status'], currentField: 'status' },
      mood: 'thinking',
    };
  }
  let availability = await AvailabilityStatus.findOne({ ceo: req.user.id });
  if (!availability) availability = await AvailabilityStatus.create({ ceo: req.user.id });
  availability.status = status;
  await availability.save();
  if (io) io.emit('ceo_status_changed', { status });
  return {
    reply: `Set your status to ${status.replace('_', ' ')} 🛡️ Employees will see this instantly.`,
    action: { kind: 'set_status', status },
    mood: 'cool',
  };
}

function doHelp(req) {
  const role = req.user.role;
  let lines;
  if (role === 'ceo') {
    lines = [
      '"Show pending requests"',
      '"Approve 1" / "Reject 2 because schedule conflict"',
      '"Create a meeting tomorrow at 5 PM"',
      '"Assign task to HR team"',
      '"Create a task to review Q4 budget"',
      '"Set my status to deep work"',
      '"Show analytics"',
      '"Show assigned tasks"',
    ];
  } else if (role === 'admin') {
    lines = [
      '"List users"',
      '"Create user" (I\'ll ask username, full name, password, role)',
      '"Create user jsmith employee John Smith"',
      '"Deactivate user @oldhire"',
      '"Reset password for @jsmith"',
      '"Create a meeting tomorrow at 5 PM"',
      '"Show analytics"',
      '"Show pending requests"',
    ];
  } else {
    lines = [
      '"Request leave next Monday"',
      '"Request a meeting with my manager tomorrow at 3pm"',
      '"Create a task to finish the report"',
      '"Show my tasks"',
      '"Show my requests"',
      '"Apply for shift change"',
    ];
  }
  return {
    reply: `I'm Codeo, your AI teammate ⚡ As ${role}, try:\n• ${lines.join('\n• ')}`,
    action: { kind: 'help', role },
    mood: 'happy',
  };
}

function doSmalltalk(req) {
  const name = (req.user.fullName || '').split(' ')[0];
  const role = req.user.role;
  const hints = {
    ceo: 'approve requests, schedule meetings, or set your status',
    admin: 'manage users, view analytics, or schedule meetings',
    employee: 'file a leave request, request a meeting, or check your tasks',
  };
  return {
    reply: `Hey ${name || 'there'} 👋 I'm Codeo (${role} mode). I can ${hints[role] || 'help with your work'}. Type "help" for examples.`,
    action: { kind: 'smalltalk', role },
    mood: 'happy',
  };
}

function doUnknown(req) {
  const role = req.user?.role || 'employee';
  const hint = role === 'ceo'
    ? '"show pending requests" or "approve 1"'
    : role === 'admin'
    ? '"list users" or "create user"'
    : '"request leave" or "show my tasks"';
  return {
    reply: `I didn't quite catch that 🤔 Try ${hint}, or type "help".`,
    action: { kind: 'unknown' },
    mood: 'surprised',
  };
}

async function executeIntent(req, intent) {
  switch (intent.type) {
    case 'create_meeting':
      return isPrivileged(req.user.role)
        ? doCreateMeeting(req, intent)
        : doRequestMeeting(req, intent);
    case 'request_meeting': return doRequestMeeting(req, intent);
    case 'request_leave':   return doRequestLeave(req, intent);
    case 'assign_task':
      return isPrivileged(req.user.role)
        ? doAssignTask(req, intent)
        : doCreateTask(req, intent);
    case 'create_task':
      return doCreateTask(req, intent);
    case 'show_tasks':           return doShowTasks(req);
    case 'show_assigned_tasks':  return doShowAssignedTasks(req);
    case 'show_meetings':        return doShowMeetings(req);
    case 'show_requests':        return doShowRequests(req);
    case 'list_pending_requests': return doListPendingRequests(req);
    case 'approve_request':      return doApproveRequest(req, intent);
    case 'reject_request':       return doRejectRequest(req, intent);
    case 'show_analytics':       return doShowAnalytics(req);
    case 'list_users':           return doListUsers(req);
    case 'create_user':          return doCreateUser(req, intent);
    case 'toggle_user':          return doToggleUser(req, intent);
    case 'reset_password':       return doResetPassword(req, intent);
    case 'set_status':           return doSetStatus(req, intent);
    case 'help':                 return doHelp(req);
    case 'smalltalk':            return doSmalltalk(req);
    default:                     return doUnknown(req);
  }
}

const OVERRIDE_FLOW_INTENTS = new Set([
  'approve_request', 'reject_request', 'list_pending_requests',
  'help', 'smalltalk', 'show_analytics', 'list_users',
  'show_tasks', 'show_assigned_tasks', 'show_meetings', 'show_requests',
  'set_status', 'assign_task', 'create_task', 'create_user', 'toggle_user', 'reset_password',
]);

const isGreetingText = (text) => /^\s*(hi|hey|hello|yo|sup|hola|namaste|good (morning|afternoon|evening))\b/i.test(text);

const shouldOverridePendingFlow = (text, pendingFlow, newType) => {
  if (isGreetingText(text)) return true;
  if (newType === 'approve_request' || newType === 'reject_request' || newType === 'list_pending_requests') {
    return true;
  }
  if (newType === 'help' || newType === 'smalltalk') return true;
  if (OVERRIDE_FLOW_INTENTS.has(newType) && newType !== pendingFlow.type) return true;
  return false;
};

// ---- main endpoint -------------------------------------------------------

// @desc  Send a message to Codeo; it understands + acts
// @route POST /api/codeo/message
// @access Private
const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    const text = message.trim();
    const convo = await CodeoConversation.findOne({ user: req.user.id }).select('pendingFlow');
    let pendingFlow = convo?.pendingFlow || null;
    let preParsedIntent = null;
    let result;
    let intentTypeForResponse = 'unknown';

    // Drop stale slot-filling when the user clearly starts a new command (e.g. "hi", "approve pending meeting").
    if (pendingFlow && !noRe.test(text)) {
      const fresh = await parseIntent(text, { role: req.user.role });
      const freshType = normalizeIntentType(fresh.type, req.user.role);
      if (shouldOverridePendingFlow(text, pendingFlow, freshType)) {
        await clearPendingFlow(req.user.id);
        pendingFlow = null;
        preParsedIntent = { ...fresh, type: freshType };
      }
    }

    // Handle existing multi-step flow first.
    if (pendingFlow) {
      if (noRe.test(text)) {
        await clearPendingFlow(req.user.id);
        result = {
          reply: 'No problem — I cancelled that request. Tell me what you want to do next.',
          action: { kind: 'flow_cancelled', type: pendingFlow.type },
          mood: 'happy',
        };
        intentTypeForResponse = 'cancel';
      } else if (pendingFlow.stage === 'confirming' && yesRe.test(text)) {
        const intent = { type: pendingFlow.type, entities: pendingFlow.entities || {}, raw: text };
        result = await executeIntent(req, intent);
        intentTypeForResponse = intent.type;
        await clearPendingFlow(req.user.id);
      } else {
        const updatedEntities = extractFlowEntities(
          text,
          pendingFlow.type,
          pendingFlow.entities || {},
          pendingFlow.currentField || null
        );
        const missing = getMissingFields(pendingFlow.type, updatedEntities);
        const nextField = getNextMissingField(pendingFlow.type, updatedEntities);

        if (missing.length > 0) {
          const nextFlow = {
            ...pendingFlow,
            entities: updatedEntities,
            missing,
            currentField: nextField,
            stage: 'collecting',
            updatedAt: new Date(),
          };
          await setPendingFlow(req.user.id, nextFlow);
          result = {
            reply: buildCollectingReply(pendingFlow.type, nextField, updatedEntities, text),
            action: { kind: 'flow_collecting', type: pendingFlow.type, missing, currentField: nextField },
            mood: 'thinking',
          };
          intentTypeForResponse = pendingFlow.type;
        } else if (
          pendingFlow.type === 'approve_request'
          || pendingFlow.type === 'reject_request'
          || pendingFlow.type === 'set_status'
        ) {
          result = await executeIntent(req, { type: pendingFlow.type, entities: updatedEntities, raw: text });
          intentTypeForResponse = pendingFlow.type;
          await clearPendingFlow(req.user.id);
        } else {
          const nextFlow = {
            ...pendingFlow,
            entities: updatedEntities,
            missing: [],
            currentField: null,
            stage: 'confirming',
            updatedAt: new Date(),
          };
          await setPendingFlow(req.user.id, nextFlow);
          result = {
            reply: buildConfirmReply(pendingFlow.type, updatedEntities),
            action: { kind: 'flow_confirm', type: pendingFlow.type, entities: updatedEntities },
            mood: 'focused',
          };
          intentTypeForResponse = pendingFlow.type;
        }
      }
    } else {
      const parsedIntent = preParsedIntent || await parseIntent(text, { role: req.user.role });
      const normalizedType = preParsedIntent
        ? parsedIntent.type
        : normalizeIntentType(parsedIntent.type, req.user.role);
      const intent = { ...parsedIntent, type: normalizedType };
      intentTypeForResponse = intent.type;

      // For request-meeting flows, always ask urgency unless explicitly provided.
      if (intent.type === 'request_meeting' && intent.entities) {
        const explicitUrgency = extractUrgency(text);
        if (!explicitUrgency) {
          delete intent.entities.urgency;
        } else {
          intent.entities.urgency = explicitUrgency;
        }
      }

      if (needsFlow(intent.type, intent.entities || {})) {
        const cleanEntities = stripAutofilledDefaults(intent.type, intent.entities || {});
        const entities = extractFlowEntities(text, intent.type, cleanEntities);
        const missing = getMissingFields(intent.type, entities);
        const nextField = getNextMissingField(intent.type, entities);

        // Approve/reject/set_status: execute immediately once required fields are present.
        if (
          (intent.type === 'approve_request' || intent.type === 'reject_request' || intent.type === 'set_status')
          && missing.length === 0
        ) {
          result = await executeIntent(req, { ...intent, entities });
          intentTypeForResponse = intent.type;
        } else if (missing.length > 0) {
          await setPendingFlow(req.user.id, {
            type: intent.type,
            entities,
            missing,
            currentField: nextField,
            stage: 'collecting',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          result = {
            reply: buildCollectingReply(intent.type, nextField, entities, text),
            action: { kind: 'flow_collecting', type: intent.type, missing, currentField: nextField },
            mood: 'thinking',
          };
        } else {
          await setPendingFlow(req.user.id, {
            type: intent.type,
            entities,
            missing: [],
            currentField: null,
            stage: 'confirming',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          result = {
            reply: buildConfirmReply(intent.type, entities),
            action: { kind: 'flow_confirm', type: intent.type, entities },
            mood: 'focused',
          };
        }
      } else {
        result = await executeIntent(req, intent);
      }
    }

    await remember(req.user.id, text, result.reply, result.action);
    emitCodeoAction(req, result);

    res.json({
      success: true,
      reply: result.reply,
      intent: intentTypeForResponse,
      action: result.action,
      mood: result.mood,
    });
  } catch (error) {
    console.error('Codeo error:', error);
    res.status(500).json({ success: false, message: 'Codeo had trouble with that. Try again.' });
  }
};

// @desc  Get recent Codeo conversation history
// @route GET /api/codeo/history
// @access Private
const getHistory = async (req, res) => {
  try {
    const convo = await CodeoConversation.findOne({ user: req.user.id });
    res.json({ success: true, messages: convo ? convo.messages.slice(-100) : [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendMessage, getHistory };
