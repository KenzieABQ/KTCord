import { KtcordLogo } from "@/components/brand/logo"
import { SetupNotice } from "@/components/auth/setup-notice"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full overflow-y-auto bg-rail">
      {/* Soft brand glow behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,color-mix(in_oklab,var(--brand)_35%,transparent),transparent),radial-gradient(50rem_35rem_at_110%_110%,color-mix(in_oklab,var(--brand)_25%,transparent),transparent)]"
      />
      <main className="relative m-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-10 sm:py-16">
        <KtcordLogo className="text-3xl" markClassName="size-11" />
        <SetupNotice />
        <div className="w-full rounded-lg bg-chat p-6 shadow-2xl sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
