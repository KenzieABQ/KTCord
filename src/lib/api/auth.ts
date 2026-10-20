import type { AuthError } from "@supabase/supabase-js"

import { getSupabase } from "@/lib/supabase/client"
import type { LoginValues, RegisterValues } from "@/lib/validation"

import { ApiError } from "./errors"

/** Maps Supabase Auth errors to messages a person can act on. */
export function authErrorMessage(error: AuthError | Error): string {
  const code = "code" in error ? error.code : undefined
  switch (code) {
    case "invalid_credentials":
      return "Email or password is incorrect."
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link."
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists."
    case "weak_password":
      return "That password is too weak. Try a longer one."
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again."
    case "signup_disabled":
      return "Sign-ups are turned off for this server."
    case "unexpected_failure":
      // A failing signup trigger surfaces as "Database error saving new user".
      return "Couldn't create your account. That username may have just been taken."
  }
  if (/database error/i.test(error.message)) {
    return "Couldn't create your account. That username may have just been taken."
  }
  if (/fetch|network/i.test(error.message)) {
    return "Can't reach KTCord. Check your connection."
  }
  return error.message || "Something went wrong. Try again."
}

export async function signIn({ email, password }: LoginValues) {
  const { error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw new ApiError(authErrorMessage(error), error.code, error)
}

/** Returns whether a session started right away (false means "check your email"). */
export async function signUp(
  values: RegisterValues,
  next = "/channels/me"
): Promise<{
  needsConfirmation: boolean
}> {
  const { data, error } = await getSupabase().auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        username: values.username,
        display_name: values.displayName || values.username,
      },
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
        `/onboarding?next=${encodeURIComponent(next)}`
      )}`,
    },
  })
  if (error) throw new ApiError(authErrorMessage(error), error.code, error)
  // With confirmations on, an existing email returns a user with no identities instead of an error.
  if (data.user && data.user.identities?.length === 0) {
    throw new ApiError("An account with this email already exists.")
  }
  return { needsConfirmation: !data.session }
}

export async function resendConfirmation(email: string) {
  const { error } = await getSupabase().auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
    },
  })
  if (error) throw new ApiError(authErrorMessage(error), error.code, error)
}

export async function signOut() {
  await getSupabase().auth.signOut()
}
