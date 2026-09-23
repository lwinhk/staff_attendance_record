import type { AuthenticatedUser, Language } from "@attendance/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { api, getCurrentUser } from "./api";
import { translate } from "./i18n";
import { EmployeesPanel, SitesPanel, SupervisorSitesPanel } from "./MasterData";
import { AdminRosterPanel, NotificationsPanel, SupervisorRosterPanel } from "./Roster";
import { AttendancePanel } from "./Attendance";
import { ReportsPanel } from "./Reports";
import { DashboardHome } from "./DashboardHome";
import { AuditPanel,AutomationPanel } from "./Operations";

interface TenantRow { id: string; slug: string; company_name: string; user_count: number }
interface UserRow { id: string; display_name: string; email: string | null; phone: string | null; role: string }
type T = (key: Parameters<typeof translate>[1]) => string;

function LanguageSwitch({ language, change }: { language: Language; change: (value: Language) => void }) {
  return <div className="language-switch"><button className={language === "en" ? "active" : ""} onClick={() => change("en")}>EN</button><button className={language === "my" ? "active" : ""} onClick={() => change("my")}>မြန်မာ</button></div>;
}

function Login({ language, setLanguage, onLogin }: { language: Language; setLanguage: (value: Language) => void; onLogin: (user: AuthenticatedUser) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const t: T = (key) => translate(language, key);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try { await api("/auth/login", { method: "POST", body: JSON.stringify({ identifier: data.get("identifier"), password: data.get("password") }) }); onLogin((await getCurrentUser()).user); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in"); } finally { setBusy(false); }
  };
  return <main className="login-shell"><section className="login-story"><div className="brand-mark">A</div><p className="eyebrow">Attendance platform</p><h1>{t("title")}</h1><p className="lead">{t("subtitle")}</p></section><section className="login-card"><LanguageSwitch language={language} change={setLanguage} /><p className="panel-label">{t("foundation")}</p><h2>{t("signIn")}</h2><form onSubmit={submit}><label>{t("identifier")}<input name="identifier" autoComplete="username" required /></label><label>{t("password")}<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? t("signingIn") : t("signIn")}</button></form></section></main>;
}

function PlatformPanel({ t, language }: { t: T; language: Language }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]); const [error, setError] = useState("");
  const load = () => api<{ tenants: TenantRow[] }>("/platform/tenants").then((data) => setTenants(data.tenants)).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setError("");
    try { await api("/platform/tenants", { method: "POST", body: JSON.stringify({ slug: data.get("slug"), companyName: data.get("companyName"), timezone: "Pacific/Auckland", primaryColor: "#173f35", defaultDailyMinutes: 480, defaultLanguage: language, admin: { displayName: data.get("adminName"), email: data.get("email"), password: data.get("password"), preferredLanguage: language } }) }); form.reset(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create tenant"); }
  };
  return <div className="content-grid"><section className="card"><p className="panel-label">{t("platform")}</p><div className="record-list">{tenants.length ? tenants.map((tenant) => <article key={tenant.id}><div><strong>{tenant.company_name}</strong><span>{tenant.slug}</span></div><span className="badge">{tenant.user_count} users</span></article>) : <p>{t("noRecords")}</p>}</div></section><section className="card"><h2>{t("createTenant")}</h2><form onSubmit={create}><label>{t("company")}<input name="companyName" required /></label><label>{t("slug")}<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>{t("name")}<input name="adminName" required /></label><label>{t("email")}<input name="email" type="email" required /></label><label>{t("password")}<input name="password" type="password" minLength={12} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary">{t("createTenant")}</button></form></section></div>;
}

function TenantUsersPanel({ t, language }: { t: T; language: Language }) {
  const [users, setUsers] = useState<UserRow[]>([]); const [error, setError] = useState("");
  const load = () => api<{ users: UserRow[] }>("/tenant/users").then((data) => setUsers(data.users)).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setError("");
    try { await api("/tenant/users", { method: "POST", body: JSON.stringify({ displayName: data.get("displayName"), email: data.get("email"), password: data.get("password"), role: data.get("role"), preferredLanguage: language }) }); form.reset(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create user"); }
  };
  return <div className="content-grid"><section className="card"><p className="panel-label">{t("tenantUsers")}</p><div className="record-list">{users.map((user) => <article key={user.id}><div><strong>{user.display_name}</strong><span>{user.email ?? user.phone}</span></div><span className="badge">{user.role.replaceAll("_", " ")}</span></article>)}</div></section><section className="card"><h2>{t("createUser")}</h2><form onSubmit={create}><label>{t("name")}<input name="displayName" required /></label><label>{t("email")}<input name="email" type="email" required /></label><label>{t("role")}<select name="role"><option value="operations_admin">Operations Admin</option><option value="site_supervisor">Site Supervisor</option></select></label><label>{t("password")}<input name="password" type="password" minLength={12} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary">{t("createUser")}</button></form></section></div>;
}

function Dashboard({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => void }) {
  const [language, setLanguage] = useState(user.preferredLanguage); const [tab, setTab] = useState(user.role === "super_admin" ? "platform" : "dashboard"); const t: T = (key) => translate(language, key);
  const switchLanguage = async (value: Language) => { setLanguage(value); if (user.tenantId) await api("/tenant/profile/language", { method: "PATCH", body: JSON.stringify({ preferredLanguage: value }) }); };
  const content = user.role === "super_admin" ? <PlatformPanel t={t} language={language} /> : tab === "dashboard" ? <DashboardHome role={user.role} /> : tab === "automation" ? <AutomationPanel /> : tab === "audit" ? <AuditPanel /> : tab === "reports" ? <ReportsPanel /> : tab === "attendance" ? <AttendancePanel role={user.role} /> : user.role === "site_supervisor" ? tab === "notifications" ? <NotificationsPanel /> : tab === "sites" ? <SupervisorSitesPanel /> : <SupervisorRosterPanel /> : tab === "roster" ? <AdminRosterPanel /> : tab === "sites" ? <SitesPanel /> : tab === "users" ? <TenantUsersPanel t={t} language={language} /> : <EmployeesPanel />;
  return <main className="dashboard"><header><div><p className="eyebrow">{user.tenant?.companyName ?? "Attendance Platform"}</p><h1>{t("overview")}</h1></div><div className="account"><LanguageSwitch language={language} change={(value) => void switchLanguage(value)} /><span>{user.displayName}<small>{user.role.replaceAll("_", " ")}</small></span><button className="quiet" onClick={onLogout}>{t("signOut")}</button></div></header>{user.role !== "super_admin" && <nav className="tabs"><button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>Dashboard</button>{user.role !== "site_supervisor"&&<button className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")}>Employees</button>}<button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>Roster</button><button className={tab === "attendance" ? "active" : ""} onClick={() => setTab("attendance")}>Attendance</button>{user.role!=="site_supervisor"&&<button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>Reports</button>}<button className={tab === "sites" ? "active" : ""} onClick={() => setTab("sites")}>Sites</button>{user.role!=="site_supervisor"&&<button className={tab === "automation" ? "active" : ""} onClick={() => setTab("automation")}>Automation</button>}{user.role==="tenant_admin"&&<button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit</button>}{user.role === "site_supervisor"&&<button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}>Notifications</button>}{user.role === "tenant_admin" && <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Users</button>}</nav>}{content}</main>;
}

export function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null); const [loading, setLoading] = useState(true); const [language, setLanguage] = useState<Language>("en");
  useEffect(() => { getCurrentUser().then(({ user: current }) => { setUser(current); setLanguage(current.preferredLanguage); }).catch(() => undefined).finally(() => setLoading(false)); }, []);
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); };
  if (loading) return <main className="loading">Attendance</main>;
  return user ? <Dashboard user={user} onLogout={() => void logout()} /> : <Login language={language} setLanguage={setLanguage} onLogin={setUser} />;
}
