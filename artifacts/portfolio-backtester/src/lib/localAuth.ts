const USERS_KEY = "pt_users";
const SESSION_KEY = "pt_session";

export interface LocalUser {
  id: string;
  email: string;
  password: string;
}

export interface Session {
  userId: string;
  email: string;
}

function getLocalUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUser[]) {
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

async function fetchFileUsers(): Promise<LocalUser[]> {
  try {
    const res = await fetch("/users.json");
    if (!res.ok) return [];
    return (await res.json()) as LocalUser[];
  } catch {
    return [];
  }
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: string | null; session: Session | null }> {
  const fileUsers = await fetchFileUsers();
  const localUsers = getLocalUsers();
  const allEmails = [...fileUsers, ...localUsers].map((u) => u.email.toLowerCase());

  if (allEmails.includes(email.toLowerCase())) {
    return { error: "이미 사용 중인 이메일입니다.", session: null };
  }

  const newUser: LocalUser = {
    id: crypto.randomUUID(),
    email,
    password,
  };
  saveLocalUsers([...localUsers, newUser]);
  const session: Session = { userId: newUser.id, email: newUser.email };
  saveSession(session);
  return { error: null, session };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null; session: Session | null }> {
  const fileUsers = await fetchFileUsers();
  const localUsers = getLocalUsers();
  const allUsers = [...fileUsers, ...localUsers];

  const user = allUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", session: null };
  }

  const session: Session = { userId: user.id, email: user.email };
  saveSession(session);
  return { error: null, session };
}

export function signOut() {
  saveSession(null);
}
