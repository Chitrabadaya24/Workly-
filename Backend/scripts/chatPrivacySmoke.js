/**
 * Privacy / IDOR smoke checks for the private chat module.
 * Usage (server must be running, with three users):
 *   node scripts/chatPrivacySmoke.js
 *
 * Optional env:
 *   API_URL=http://localhost:5000/api
 *   USER_A_USER / USER_A_PASS
 *   USER_B_USER / USER_B_PASS
 *   USER_C_USER / USER_C_PASS
 *   ADMIN_USER / ADMIN_PASS
 */
const API = process.env.API_URL || 'http://localhost:5000/api';

async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${username}: ${data.message}`);
  return data;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const aUser = process.env.USER_A_USER || 'employee1';
  const aPass = process.env.USER_A_PASS || 'password123';
  const bUser = process.env.USER_B_USER || 'employee2';
  const bPass = process.env.USER_B_PASS || 'password123';
  const cUser = process.env.USER_C_USER || 'employee3';
  const cPass = process.env.USER_C_PASS || 'password123';
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'password123';

  console.log('Logging in test users…');
  const A = await login(aUser, aPass);
  const B = await login(bUser, bPass);
  const C = await login(cUser, cPass);
  let admin;
  try {
    admin = await login(adminUser, adminPass);
  } catch {
    admin = null;
    console.log('  (admin login skipped — set ADMIN_USER/ADMIN_PASS if available)');
  }

  console.log('\n1) A creates / opens conversation with B');
  const createAB = await api(A.token, 'POST', '/chat/conversations', {
    participantId: B.user._id,
  });
  assert(createAB.status === 200 && createAB.data.conversation?._id, 'A↔B conversation created/found');
  const convId = createAB.data.conversation._id;

  console.log('\n2) A sends a message');
  const send = await api(A.token, 'POST', `/chat/conversations/${convId}/messages`, {
    content: `privacy-test-${Date.now()}`,
  });
  assert(send.status === 201 && send.data.message, 'A can send message in A↔B');

  console.log('\n3) A and B can read messages');
  const aMsgs = await api(A.token, 'GET', `/chat/conversations/${convId}/messages`);
  const bMsgs = await api(B.token, 'GET', `/chat/conversations/${convId}/messages`);
  assert(aMsgs.status === 200 && aMsgs.data.messages?.length > 0, 'A can access A↔B messages');
  assert(bMsgs.status === 200 && bMsgs.data.messages?.length > 0, 'B can access A↔B messages');

  console.log('\n4) C cannot access A↔B by conversationId');
  const cMsgs = await api(C.token, 'GET', `/chat/conversations/${convId}/messages`);
  assert(cMsgs.status === 404, 'C cannot access A↔B messages (404)');

  const cSend = await api(C.token, 'POST', `/chat/conversations/${convId}/messages`, {
    content: 'intrusion',
  });
  assert(cSend.status === 404, 'C cannot send into A↔B (404)');

  if (admin) {
    console.log('\n5) Admin cannot access A↔B by default');
    const adminMsgs = await api(admin.token, 'GET', `/chat/conversations/${convId}/messages`);
    assert(adminMsgs.status === 404, 'Admin cannot access A↔B messages (404)');
  }

  console.log('\n6) Unauthenticated rejected');
  const noAuth = await api('invalid', 'GET', `/chat/conversations/${convId}/messages`);
  assert(noAuth.status === 401, 'Invalid token rejected');

  console.log('\n7) Spoofed participantId does not leak others\' chats');
  const fakeCreate = await api(C.token, 'POST', '/chat/conversations', {
    participantId: A.user._id,
  });
  assert(fakeCreate.status === 200, 'C can create own C↔A thread');
  assert(
    String(fakeCreate.data.conversation._id) !== String(convId),
    'C↔A conversation id differs from A↔B'
  );
  const cOwn = await api(C.token, 'GET', `/chat/conversations/${fakeCreate.data.conversation._id}/messages`);
  assert(cOwn.status === 200, 'C can read own C↔A messages only');

  console.log('\nAll privacy smoke checks passed.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
