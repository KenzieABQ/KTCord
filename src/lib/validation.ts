import { z } from "zod"

export const USERNAME_RE = /^[a-z0-9_.]+$/

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Must be at least 2 characters")
  .max(32, "Must be 32 characters or fewer")
  .regex(USERNAME_RE, "Use only letters, numbers, underscores and periods")
  .refine((v) => !v.includes(".."), "Can't contain two periods in a row")

export const displayNameSchema = z
  .string()
  .trim()
  .max(32, "Must be 32 characters or fewer")

export const emailSchema = z.email("Enter a valid email address")

export const passwordSchema = z
  .string()
  .min(8, "Must be at least 8 characters")
  .max(72, "Must be 72 characters or fewer")

export const bioSchema = z.string().max(190, "Must be 190 characters or fewer")

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color")

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
})

export const registerSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  username: usernameSchema,
  password: passwordSchema,
})

export const pronounsSchema = z.string().trim().max(40, "Must be 40 characters or fewer")

/** An optional theme color: "" means no profile theme. */
const themeColorSchema = z.union([z.literal(""), hexColorSchema])

export const profileSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  pronouns: pronounsSchema,
  bannerColor: hexColorSchema,
  themePrimary: themeColorSchema,
  themeAccent: themeColorSchema,
  bio: bioSchema,
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ProfileValues = z.infer<typeof profileSchema>
