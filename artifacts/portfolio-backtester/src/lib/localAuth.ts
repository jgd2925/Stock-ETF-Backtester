const USERS_KEY = "pt_users";
const SESSION_KEY = "pt_session";

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
}

export interface Session {
  userId: string;
  email: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: string | null; session: Session | null }> {
  const users = getUsers();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "이미 사용 중인 이메일입니다.", session: null };
  }
  const passwordHash = await hashPassword(password);
  const newUser: LocalUser = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
  };
  saveUsers([...users, newUser]);
  const session: Session = { userId: newUser.id, email: newUser.email };
  saveSession(session);
  return { error: null, session };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null; session: Session | null }> {
  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", session: null };
  }
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", session: null };
  }
  const session: Session = { userId: user.id, email: user.email };
  saveSession(session);
  return { error: null, session };
}

export function signOut() {
  saveSession(null);
}
