"use client"

import type { Dispatch, ReactNode, SetStateAction } from "react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  DECORATIONS,
  effectUsesTwoColors,
  NAME_EFFECTS,
  NAME_FONTS,
  NAME_SWATCHES,
  NAMEPLATES,
  PROFILE_EFFECTS,
  type Cosmetics,
} from "@/lib/cosmetics"
import { cn } from "@/lib/utils"

import { NameplateLayer, ProfileEffectLayer, StyledName } from "./cosmetics"
import { UserAvatar } from "./user-avatar"

const labelClass = "text-xs font-bold tracking-wide uppercase"

function Tile({
  label,
  selected,
  onClick,
  className,
  children,
}: {
  label: string
  selected: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border-2 bg-card p-2 text-xs text-muted-foreground transition-colors hover:bg-item-hover hover:text-interactive-hover",
        selected ? "border-primary text-header" : "border-transparent",
        className
      )}
    >
      {children}
    </button>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (hex: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      {NAME_SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${label} ${color}`}
          aria-pressed={value?.toLowerCase() === color}
          onClick={() => onChange(color)}
          className={cn(
            "size-6 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
            value?.toLowerCase() === color && "ring-2 ring-foreground"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <label className="relative flex size-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-muted-foreground/50 text-xs text-muted-foreground">
        <span aria-hidden>+</span>
        <span className="sr-only">Custom {label.toLowerCase()}</span>
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value ?? "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  )
}

/**
 * The fun part of the profile editor, as in Discord's shop items: a display name style,
 * an avatar decoration, a profile effect and a nameplate, each with live previews.
 */
export function CosmeticsEditor({
  value,
  onChange,
  userId,
  name,
  avatarUrl,
}: {
  value: Cosmetics
  onChange: Dispatch<SetStateAction<Cosmetics>>
  userId: string
  name: string
  avatarUrl: string | null
}) {
  const set = (patch: Partial<Cosmetics>) => onChange((prev) => ({ ...prev, ...patch }))
  const effect = value.name_effect ?? "solid"
  const colors = value.name_colors ?? []
  const setColor = (index: 0 | 1, hex: string) =>
    onChange((prev) => {
      const next = [...(prev.name_colors ?? [])]
      next[index] = hex
      if (index === 1 && !next[0]) next[0] = "#ffffff"
      return { ...prev, name_colors: next }
    })

  return (
    <>
      <Field>
        <FieldLabel className={labelClass}>Display Name Style</FieldLabel>
        <FieldDescription>A font, an effect and colors for your name in chat, lists and your profile.</FieldDescription>
        <div className="grid grid-cols-4 gap-2">
          {NAME_FONTS.map((font) => (
            <Tile
              key={font.id}
              label={`${font.label} font`}
              selected={(value.name_font ?? "default") === font.id}
              onClick={() => set({ name_font: font.id })}
              className="h-16"
            >
              <span
                className={cn(
                  "max-w-full truncate text-base text-header",
                  font.id !== "default" && `name-font-${font.id}`
                )}
              >
                {name}
              </span>
              <span>{font.label}</span>
            </Tile>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          {NAME_EFFECTS.map((fx) => (
            <button
              key={fx.id}
              type="button"
              aria-pressed={effect === fx.id}
              onClick={() => set({ name_effect: fx.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                effect === fx.id
                  ? "border-primary bg-primary/15 text-header"
                  : "border-border text-muted-foreground hover:bg-item-hover hover:text-interactive-hover"
              )}
            >
              {fx.label}
            </button>
          ))}
        </div>
        <div className="mt-1 flex flex-col gap-2">
          <ColorRow
            label={effectUsesTwoColors(effect) ? "Color 1" : "Color"}
            value={colors[0]}
            onChange={(hex) => setColor(0, hex)}
          />
          {effectUsesTwoColors(effect) && (
            <ColorRow label="Color 2" value={colors[1]} onChange={(hex) => setColor(1, hex)} />
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 rounded-lg bg-rail px-4 py-3">
          <span className="truncate text-lg font-semibold text-header">
            <StyledName cosmetics={value} motion="always">
              {name}
            </StyledName>
          </span>
          {(value.name_font || value.name_effect || value.name_colors) && (
            <button
              type="button"
              className="shrink-0 text-sm text-link hover:underline"
              onClick={() => set({ name_font: undefined, name_effect: undefined, name_colors: undefined })}
            >
              Reset name style
            </button>
          )}
        </div>
      </Field>

      <Field>
        <FieldLabel className={labelClass}>Avatar Decoration</FieldLabel>
        <FieldDescription>An animated frame around your avatar.</FieldDescription>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DECORATIONS.map((d) => (
            <Tile
              key={d.id}
              label={`${d.label} decoration`}
              selected={(value.decoration ?? "none") === d.id}
              onClick={() => set({ decoration: d.id })}
              className="h-24 overflow-visible pt-4"
            >
              <UserAvatar
                userId={userId}
                name={name}
                src={avatarUrl}
                decoration={d.id}
                animate="always"
                className="size-11"
              />
              <span className="truncate">{d.label}</span>
            </Tile>
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel className={labelClass}>Profile Effect</FieldLabel>
        <FieldDescription>An animation that plays over your profile card.</FieldDescription>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PROFILE_EFFECTS.map((fx) => (
            <Tile
              key={fx.id}
              label={`${fx.label} effect`}
              selected={(value.effect ?? "none") === fx.id}
              onClick={() => set({ effect: fx.id })}
              className="h-24 justify-end"
            >
              <span className="absolute inset-0 bg-gradient-to-b from-primary/30 to-transparent">
                <ProfileEffectLayer kind={fx.id} />
              </span>
              <span className="relative">{fx.label}</span>
            </Tile>
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel className={labelClass}>Nameplate</FieldLabel>
        <FieldDescription>A background behind your name in member lists and DMs.</FieldDescription>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NAMEPLATES.map((plate) => (
            <Tile
              key={plate.id}
              label={`${plate.label} nameplate`}
              selected={(value.nameplate ?? "none") === plate.id}
              onClick={() => set({ nameplate: plate.id })}
              className="items-stretch"
            >
              <span className="relative isolate flex h-11 items-center gap-2 overflow-hidden rounded-md bg-sidebar px-2">
                <NameplateLayer kind={plate.id} motion="always" />
                <UserAvatar userId={userId} name={name} src={avatarUrl} className="size-7" />
                <span className="truncate text-sm font-medium text-header">{name}</span>
              </span>
              <span className="text-center">{plate.label}</span>
            </Tile>
          ))}
        </div>
      </Field>
    </>
  )
}
