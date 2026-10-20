"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { resendConfirmation, signIn } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/errors"
import { safeNext } from "@/lib/navigation"
import { loginSchema, type LoginValues } from "@/lib/validation"

const QUERY_ERRORS: Record<string, string> = {
  confirm: "That confirmation link is invalid or has expired. Log in to get a new one.",
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get("next"))
  const queryError = QUERY_ERRORS[searchParams.get("error") ?? ""]

  const [formError, setFormError] = useState<string | null>(queryError ?? null)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    setUnconfirmedEmail(null)
    try {
      await signIn(values)
      router.replace(next)
    } catch (error) {
      setFormError(errorMessage(error))
      if ((error as { code?: string }).code === "email_not_confirmed") {
        setUnconfirmedEmail(values.email)
      }
    }
  }

  async function onResend() {
    if (!unconfirmedEmail) return
    try {
      await resendConfirmation(unconfirmedEmail)
      toast.success("Confirmation email sent.")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-header">Welcome back!</h1>
        <p className="mt-1 text-muted-foreground">
          We&apos;re so excited to see you again!
        </p>
      </div>

      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email" className="text-xs font-bold tracking-wide uppercase">
            Email <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            className="h-10"
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password" className="text-xs font-bold tracking-wide uppercase">
            Password <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            className="h-10"
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        {formError && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
            {unconfirmedEmail && (
              <button
                type="button"
                onClick={onResend}
                className="ml-1 font-medium text-link hover:underline"
              >
                Resend email
              </button>
            )}
          </div>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log In"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Need an account?{" "}
          <Link
            href={`/register${next !== "/channels/me" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-medium text-link hover:underline"
          >
            Register
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
