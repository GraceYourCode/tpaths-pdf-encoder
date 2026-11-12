import Image from "next/image";
import Link from "next/link";
import Brand from "@/components/Brand";

/*
 * Photos: Unsplash, free to use under the Unsplash License.
 *  - hero:    "University Library" by Ryan Waring        https://unsplash.com/photos/maNdO_gAyJ4
 *  - split:   "Students studying together at a long table" by Jaykumar Bherwani  https://unsplash.com/photos/Dg8WzlOE1as
 *  - account: "Library shelves" by Priscilla Du Preez      https://unsplash.com/photos/ggeZ9oyI-PE
 */
const PHOTO = {
  hero: "https://images.unsplash.com/photo-1551173953-54a75e46fccd?auto=format&fit=crop&q=85&w=2400",
  students: "https://images.unsplash.com/photo-1762512346988-045f4d5ad2b3?auto=format&fit=crop&q=85&w=2400",
  shelves: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=85&w=2400",
};

const steps = [
  {
    title: "Choose",
    body: "Browse the catalogue and see the price of each past-question set before you check out.",
  },
  {
    title: "Pay",
    body: "Pay securely through our payment provider. Your purchase is only marked as paid once our servers confirm the payment.",
  },
  {
    title: "Study",
    body: "Use your activation details in the Tpaths mobile app to open your secured materials.",
  },
];

const accountItems = [
  { title: "Purchase history", body: "Every order with its status, amount and reference." },
  { title: "Transactions", body: "Payment records kept exactly as our servers hold them." },
  { title: "Licences", body: "Which materials you can use, when they expire, and whether they are bound to a device." },
  { title: "Security", body: "Change your password, review your devices, and sign out everywhere." },
];

const faqs = [
  {
    q: "Do I need the mobile app?",
    a: "Yes. Secured documents are opened in the Tpaths mobile app, signed in with the same account. The website shows your purchases, licences and activation details, but it does not download the materials.",
  },
  {
    q: "How do I know my payment went through?",
    a: "A purchase is shown as paid only after our servers have confirmed the payment with the provider. If confirmation is still pending, the page will say so and you can check again from your purchases.",
  },
  {
    q: "What is an activation token?",
    a: "It is a one-time code that links a purchased licence to your device in the mobile app. It is shown once after your payment is confirmed, so copy it and keep it somewhere safe.",
  },
  {
    q: "I forgot my password. What now?",
    a: "Use Forgot password on the login page. We will send a reset link to your email. For your security, changing your password signs you out on every device.",
  },
];

const navLinks = [
  { href: "/store", label: "Store" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#account", label: "Your account" },
  { href: "#help", label: "Help" },
];

export default function Home() {
  return (
    <div className="font-sans text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#4c1d95] focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* ───────────── Navigation ───────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-[#4c1d95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c1d95]">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/auth/login" className="rounded-lg px-4 py-2 text-sm font-bold text-[#4c1d95] hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c1d95]">
              Log in
            </Link>
            <Link href="/auth/register" className="button-primary !min-h-10 !px-4 !text-sm">
              Create account
            </Link>
          </div>

          {/* Mobile menu: native details/summary, keyboard and screen-reader accessible without JavaScript */}
          <details className="group relative md:hidden">
            <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-300 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c1d95] [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Open menu</span>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="group-open:hidden">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="hidden group-open:block">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </summary>
            <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <ul className="grid gap-1">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="block rounded-lg px-3 py-3 text-base font-semibold text-slate-800 hover:bg-violet-50 hover:text-[#4c1d95]">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                <Link href="/auth/login" className="button-secondary">Log in</Link>
                <Link href="/auth/register" className="button-primary">Create account</Link>
              </div>
            </div>
          </details>
        </nav>
      </header>

      <main id="main">
        {/* ───────────── Hero ───────────── */}
        <section className="relative isolate overflow-hidden bg-[#1e1038] text-white">
          <Image
            src={PHOTO.hero}
            alt="A quiet university library with rows of bookshelves and reading tables"
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
          {/* Gradient overlay keeps white text readable on any screen size. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-[#1e1038]/95 via-[#2e1065]/80 to-[#4c1d95]/30" />

          <div className="mx-auto flex min-h-[32rem] max-w-7xl items-center px-4 py-20 sm:px-6 sm:py-28 lg:min-h-[40rem] lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-200">Tpaths · Digital learning</p>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Past questions, bought simply and studied securely.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-violet-50 sm:text-lg">
                Find the materials you need, pay with confidence, and keep every purchase in one student account.
                Open your secured documents in the Tpaths mobile app.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/store" className="button-primary !bg-white !text-[#4c1d95] hover:!bg-violet-100">
                  Browse past questions
                </Link>
                <Link href="/auth/register" className="button-secondary !border-white/60 !bg-transparent !text-white hover:!bg-white/10">
                  Create student account
                </Link>
              </div>
              <ul className="mt-10 grid gap-3 text-sm text-violet-100 sm:grid-cols-3">
                <li className="flex items-start gap-2"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-300" />Payments confirmed before access</li>
                <li className="flex items-start gap-2"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-300" />Secured materials in the mobile app</li>
                <li className="flex items-start gap-2"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-300" />One account for purchases and licences</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ───────────── How it works ───────────── */}
        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#4c1d95]">How it works</p>
              <h2 id="how-title" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                From choosing a past-question set to studying it, in three steps.
              </h2>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4c1d95] text-sm font-extrabold text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-6 text-xl font-extrabold">{s.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────────── Split: study with confidence ───────────── */}
        <section aria-labelledby="confidence-title" className="bg-violet-50/60">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl sm:aspect-[16/11]">
              <Image
                src={PHOTO.students}
                alt="A group of students studying together at a long table, with books and notebooks spread out"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#4c1d95]">Built for serious study</p>
              <h2 id="confidence-title" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Clear records, so you always know what you can use.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Every purchase is recorded by our servers and every licence shows whether it is active, expired, or
                bound to a device. Nothing is guessed on the screen.
              </p>
              <ul className="mt-8 grid gap-4">
                {[
                  "Purchases are confirmed with the payment provider before they are marked as paid.",
                  "Licences show their expiry date, so you know how long you have access.",
                  "Activation is a single step in the mobile app, with the details shown once.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-base leading-7 text-slate-700">
                    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                      <path d="M5 12.5l4.2 4.2L19 7" />
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link href="/store" className="button-primary">Explore the store</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── Your account ───────────── */}
        <section id="account" aria-labelledby="account-title" className="scroll-mt-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl lg:order-last lg:aspect-[5/4]">
                <Image
                  src={PHOTO.shelves}
                  alt="Library bookshelves in soft focus, lined with books"
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#4c1d95]">Your student account</p>
                <h2 id="account-title" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Everything about your access, in one place.
                </h2>
                <dl className="mt-10 grid gap-6 sm:grid-cols-2">
                  {accountItems.map((item) => (
                    <div key={item.title} className="border-t-2 border-[#4c1d95] pt-5">
                      <dt className="text-lg font-extrabold">{item.title}</dt>
                      <dd className="mt-2 text-base leading-7 text-slate-600">{item.body}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── Help ───────────── */}
        <section id="help" aria-labelledby="help-title" className="scroll-mt-24 bg-violet-50/60">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#4c1d95]">Help</p>
            <h2 id="help-title" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Common questions</h2>
            <div className="mt-10 divide-y divide-violet-200 rounded-2xl border border-violet-200 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group p-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c1d95] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[#4c1d95] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 text-base leading-7 text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────── Call to action ───────────── */}
        <section aria-labelledby="cta-title" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-8 rounded-3xl bg-linear-to-br from-[#4c1d95] to-[#2e1065] p-8 text-white shadow-xl sm:p-12 md:flex-row md:items-center">
              <div className="max-w-xl">
                <h2 id="cta-title" className="text-3xl font-extrabold tracking-tight">Ready to start studying?</h2>
                <p className="mt-3 text-base leading-7 text-violet-100">
                  Create your free student account, then browse the store whenever you are ready.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href="/auth/register" className="button-primary !bg-white !text-[#4c1d95] hover:!bg-violet-100">Create account</Link>
                <Link href="/store" className="button-secondary !border-white/60 !bg-transparent !text-white hover:!bg-white/10">Browse store</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ───────────── Footer (light brand purple) ───────────── */}
      <footer className="border-t border-violet-100 bg-violet-50 text-slate-700">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <Brand />
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">
              Secure digital past questions for students. Purchase confirmed by our servers, studied in the Tpaths mobile app.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:col-span-2">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4c1d95]">Explore</h2>
              <ul className="mt-4 grid gap-3 text-sm font-semibold">
                <li><Link href="/store" className="hover:text-[#4c1d95] hover:underline focus-visible:outline-2 focus-visible:outline-[#4c1d95]">Store</Link></li>
                <li><a href="#how-it-works" className="hover:text-[#4c1d95] hover:underline focus-visible:outline-2 focus-visible:outline-[#4c1d95]">How it works</a></li>
                <li><a href="#help" className="hover:text-[#4c1d95] hover:underline focus-visible:outline-2 focus-visible:outline-[#4c1d95]">Help</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4c1d95]">Account</h2>
              <ul className="mt-4 grid gap-3 text-sm font-semibold">
                <li><Link href="/auth/login" className="hover:text-[#4c1d95] hover:underline focus-visible:outline-2 focus-visible:outline-[#4c1d95]">Log in</Link></li>
                <li><Link href="/auth/register" className="hover:text-[#4c1d95] hover:underline focus-visible:outline-2 focus-visible:outline-[#4c1d95]">Create account</Link></li>
                <li><Link href="/auth/forgot-password" className="hover:text-[#4c1d95] hover:underline focus-visible:outline-2 focus-visible:outline-[#4c1d95]">Forgot password</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="border-t border-violet-100">
          <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} Tpaths. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
