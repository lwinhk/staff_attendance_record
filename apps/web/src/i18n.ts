import type { Language } from "@attendance/contracts";

const messages = {
  en: {
    title: "Attendance, without uncertainty.", subtitle: "Manage people, sites and working records from one secure place.", signIn: "Sign in", identifier: "Email or phone", password: "Password", signingIn: "Signing in...", overview: "Overview", signedInAs: "Signed in as", signOut: "Sign out", platform: "Platform tenants", tenantUsers: "Company users", createTenant: "Create tenant", createUser: "Create user", name: "Name", company: "Company name", slug: "Tenant slug", email: "Email", role: "Role", noRecords: "No records yet.", foundation: "Platform foundation",
    dashboard: "Dashboard", employees: "Employees", roster: "Roster", attendance: "Attendance", reports: "Reports", sites: "Sites", automation: "Automation", audit: "Audit", notifications: "Notifications", users: "Users",
  },
  my: {
    title: "တက်ရောက်မှုကို ရှင်းလင်းတိကျစွာ စီမံပါ။", subtitle: "ဝန်ထမ်း၊ လုပ်ငန်းခွင်နှင့် အလုပ်ချိန်မှတ်တမ်းများကို လုံခြုံသည့်တစ်နေရာတည်းမှ စီမံပါ။", signIn: "ဝင်ရောက်ရန်", identifier: "အီးမေးလ် သို့မဟုတ် ဖုန်း", password: "စကားဝှက်", signingIn: "ဝင်ရောက်နေသည်...", overview: "ခြုံငုံသုံးသပ်ချက်", signedInAs: "ဝင်ရောက်ထားသူ", signOut: "ထွက်ရန်", platform: "ကုမ္ပဏီစာရင်း", tenantUsers: "ကုမ္ပဏီအသုံးပြုသူများ", createTenant: "ကုမ္ပဏီဖန်တီးရန်", createUser: "အသုံးပြုသူဖန်တီးရန်", name: "အမည်", company: "ကုမ္ပဏီအမည်", slug: "ကုမ္ပဏီအမှတ်အသား", email: "အီးမေးလ်", role: "အခန်းကဏ္ဍ", noRecords: "မှတ်တမ်းမရှိသေးပါ။", foundation: "စနစ်အခြေခံ",
    dashboard: "ဒက်ရှ်ဘုတ်", employees: "ဝန်ထမ်းများ", roster: "တာဝန်ချထားမှု", attendance: "တက်ရောက်မှု", reports: "အစီရင်ခံစာများ", sites: "လုပ်ငန်းခွင်များ", automation: "အလိုအလျောက်လုပ်ဆောင်မှု", audit: "စစ်ဆေးမှတ်တမ်း", notifications: "အသိပေးချက်များ", users: "အသုံးပြုသူများ",
  },
} as const;

export type MessageKey = keyof typeof messages.en;
export const translate = (language: Language, key: MessageKey): string => messages[language][key];
