import type { Metadata } from "next";
import { BrandMark } from "@/components/layout/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" ? rawNext : undefined;

  return (
    <>
    <div className="bg-brand-grid h-full w-full absolute inset-0 z-0"></div>
    <div className="w-full max-w-lg relative z-10">
      <div className="rounded-xl bg-white p-8 shadow-sm">
        <LoginForm next={next} />
      </div>
    </div>
    </> 
  );
}
