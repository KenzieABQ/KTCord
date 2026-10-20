"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getProfile,
  updateProfile,
  type Profile,
  type ProfileUpdate,
} from "@/lib/api/profiles"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.profile(userId ?? ""),
    queryFn: () => getProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  })
}

export function useMyProfile() {
  return useProfile(useUserId())
}

export function useUpdateMyProfile() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfileUpdate) => updateProfile(userId, patch),
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(qk.profile(userId), profile)
    },
  })
}
