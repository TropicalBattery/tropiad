import Image from "next/image";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#111111] px-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(204,43,43,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(245,160,0,0.12),_transparent_45%)]"
        aria-hidden
      />

      <div className="relative w-full max-w-[400px]">
        <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-card">
          <div
            className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-tbc-red"
            aria-hidden
          />
          <div
            className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-tbc-amber"
            aria-hidden
          />

          <div className="mb-5 text-center">
            <Image
              src="/tbc-logo.png"
              alt="Tropical Battery"
              width={220}
              height={40}
              className="mx-auto h-10 w-auto"
              priority
            />
            <div className="mb-5 mt-5 border-t border-[#F3F4F6]" />
          </div>

          <h1 className="mb-1 text-xl font-bold text-[#111111]">
            Sign in to your account
          </h1>
          <p className="mb-6 text-sm text-[#6B7280]">
            Tropical Battery Autopilot — create and approve social content.
          </p>

          <LoginForm />

          <div className="mt-6 border-t border-[#F3F4F6] pt-5 text-center text-xs text-[#9CA3AF]">
            <p>Tropical Battery Company Limited</p>
            <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Content Autopilot
        </p>
      </div>
    </div>
  );
}
