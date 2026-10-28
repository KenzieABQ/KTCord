"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheckIcon } from "@/components/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUsernameAvailability } from "@/hooks/use-username-availability"
import { resendConfirmation, signUp } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/errors"
import { nextFromLocation } from "@/lib/navigation"
import { registerSchema, type RegisterValues } from "@/lib/validation"

import { UsernameStatus } from "./username-status"

const labelClass = "text-xs font-bold tracking-wide uppercase"

export function RegisterForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", displayName: "", username: "", password: "" },
    reValidateMode: "onChange",
  })
  const { errors, isSubmitting } = form.formState
  const username = useWatch({ control: form.control, name: "username" })
  const availability = useUsernameAvailability(username)

  async function onSubmit(values: RegisterValues) {
    setFormError(null)
    if (availability === "taken") {
      form.setError("username", { message: "That username is taken" })
      return
    }
    try {
      const next = nextFromLocation()
      const { needsConfirmation } = await signUp(values, next)
      if (needsConfirmation) setSentTo(values.email)
      else router.replace(`/onboarding?next=${encodeURIComponent(next)}`)
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheckIcon className="size-12 text-primary" />
        <h1 className="text-2xl font-semibold text-header">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{sentTo}</span>. Open
          it on this device to finish creating your account.
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await resendConfirmation(sentTo)
              toast.success("Sent another link.")
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          Resend email
        </Button>
        <Link href="/login" className="text-sm font-medium text-link hover:underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <h1 className="mb-6 text-center text-2xl font-semibold text-header">
        Create an account
      </h1>

      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email" className={labelClass}>
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

        <Field data-invalid={Boolean(errors.displayName)}>
          <FieldLabel htmlFor="displayName" className={labelClass}>
            Display name
          </FieldLabel>
          <Input
            id="displayName"
            autoComplete="nickname"
            aria-invalid={Boolean(errors.displayName)}
            className="h-10"
            {...form.register("displayName")}
          />
          <FieldDescription className="text-xs">
            This is how others see you. You can use special characters and emoji.
          </FieldDescription>
          <FieldError errors={[errors.displayName]} />
        </Field>

        <Field data-invalid={Boolean(errors.username) || availability === "taken"}>
          <FieldLabel htmlFor="username" className={labelClass}>
            Username <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(errors.username) || availability === "taken"}
            className="h-10"
            {...form.register("username", {
              setValueAs: (v: string) => v.toLowerCase(),
            })}
          />
          {errors.username ? (
            <FieldError errors={[errors.username]} />
          ) : (
            <UsernameStatus status={availability} />
          )}
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password" className={labelClass}>
            Password <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className="h-10"
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        {formError && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full text-base"
          disabled={isSubmitting || availability === "taken"}
        >
          {isSubmitting ? "Creating account…" : "Continue"}
        </Button>

        <Link href="/login" className="text-sm font-medium text-link hover:underline">
          Already have an account?
        </Link>
      </FieldGroup>
    </form>
  )
}
