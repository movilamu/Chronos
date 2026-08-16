<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=220&section=header&text=Chronos&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Your%20day.%20Planned%20by%20AI.&descAlignY=55&descSize=20" width="100%" />

<a href="https://chronos-kappa-three.vercel.app">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=6366F1&center=true&vCenter=true&width=600&lines=AI-powered+daily+planner;Voice+commands+%2B+smart+scheduling;Multi-block+focus+%26+sleep+windows;Sprints%2C+conflicts%2C+and+auto+re-planning" alt="Typing SVG" />
</a>

<br/>

[![Live Website](https://img.shields.io/badge/Live-chronos--kappa--three.vercel.app-6366F1?style=for-the-badge&logo=vercel&logoColor=white)](https://chronos-kappa-three.vercel.app)
[![Download APK](https://img.shields.io/badge/Download-Android%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](../../releases/latest)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?style=flat-square&logo=capacitor&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)

</div>

---

## What is Chronos?

**Chronos** is a full-stack AI day-planning app. Tell it what you need to do — by typing or by voice — and it intelligently schedules your tasks around fixed commitments like college, sleep, and focus windows, adapts in real time when your day changes, and tracks longer-term goals through JIRA-style sprints.

Built as a real product, not a toy: real auth, real database with row-level security, a live web deployment, and a native Android app.

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=rect&color=0:6366F1,100:22C55E&height=3&width=100%" />
</div>

## ✨ Features

| | |
|---|---|
| 🎙️ **Voice commands** | Add, delete, or reschedule tasks by talking — native speech recognition on Android, Web Speech API on desktop |
| 🧠 **AI day planning** | An edge-function-powered planner schedules tasks around your fixed blocks and priorities |
| 🧩 **Multi-block schedules** | Define multiple College / Sleep / Focus windows per day, not just one block |
| 🔒 **Locked task times** | Pin a task's time so the AI planner never touches it |
| 🏃 **Sprints** | JIRA-style time-boxed goals with task assignment and a burndown chart |
| 🔔 **Real notifications** | OS-level reminders on Android (fires even with the app closed), browser notifications on web |
| ⚠️ **Conflict handling** | Overflow tasks get flagged instead of silently dropped, with a one-tap "move to tomorrow" |
| 🎯 **Focus classification** | The AI asks when it's genuinely unsure whether a task needs deep focus |
| 📊 **Reports & tracking** | Actual vs. planned time, completion trends, category breakdowns |

## 🖥️ Try it

- **Web app:** [chronos-kappa-three.vercel.app](https://chronos-kappa-three.vercel.app)
- **Android APK:** grab the latest build from the [Releases](../../releases) tab — sideload it, no Play Store needed

## 🏗️ Architecture

```
┌──────────────────────┐        ┌──────────────────────┐
│   React + Vite SPA   │◄──────►│   Supabase (Postgres)│
│   Tailwind CSS 4     │        │   Row-Level Security │
└─────────┬────────────┘        └──────────┬───────────┘
          │                                  │
          │ Capacitor                        │ Edge Functions
          ▼                                  ▼
┌────────────────────────┐        ┌────────────────────────┐
│  Native Android APK    │        │  plan-day / voice-cmd  │
│  Speech / Notifications│        │  AI scheduling logic   │
└────────────────────────┘        └────────────────────────┘
```

**Frontend** — React 19, Vite 8, Tailwind CSS 4, React Router, Recharts
**Backend** — Supabase (Postgres + Auth + Edge Functions), Row-Level Security on every table
**Native** — Capacitor 7, native speech recognition, local notifications, Google OAuth deep-linking
**Deployment** — Vercel (web), signed Android APK (mobile)

## 🔐 Security

- Row-Level Security enforced on every database table — every query is scoped to `auth.uid()`
- Google OAuth via Supabase Auth, native deep-link callback (`chronos://login-callback`) on Android
- Secrets never committed — `.env` is gitignored, all keys injected via Vercel environment variables
- Signed release builds for Android with code shrinking/obfuscation enabled
- Security headers (CSP, HSTS, X-Frame-Options) enforced on the web deployment

## 🚀 Local development

```bash
git clone https://github.com/movilamu/Chronos.git
cd Chronos
npm install
cp .env.example .env   # fill in your own Supabase URL + anon key
npm run dev
```

### Building the Android APK yourself

```bash
npm run build
npx cap sync
npx cap open android
# Build ▸ Build Bundle(s)/APK(s) ▸ Build APK(s) in Android Studio
```

## 📄 License

Released under the [MIT License](LICENSE) — free to use, modify, and distribute.

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%" />
</div>
