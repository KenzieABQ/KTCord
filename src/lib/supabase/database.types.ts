// Mirrors `supabase gen types typescript --linked`. Regenerate with `npm run db:types`
// after the project is linked; until then this is kept in sync by hand with supabase/migrations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bans: {
        Row: {
          banned_by: string | null
          created_at: string
          reason: string | null
          server_id: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          server_id: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bans_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_activity: {
        Row: {
          channel_id: string
          last_message_at: string
          last_message_id: string | null
          message_count: number
        }
        Insert: {
          channel_id: string
          last_message_at: string
          last_message_id?: string | null
          message_count?: number
        }
        Update: {
          channel_id?: string
          last_message_at?: string
          last_message_id?: string | null
          message_count?: number
        }
        Relationships: []
      }
      channel_role_access: {
        Row: {
          channel_id: string
          id: string
          role_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          role_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_role_access_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_role_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          id: string
          is_private: boolean
          name: string | null
          owner_id: string | null
          parent_id: string | null
          position: number
          server_id: string | null
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_private?: boolean
          name?: string | null
          owner_id?: string | null
          parent_id?: string | null
          position?: number
          server_id?: string | null
          topic?: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_private?: boolean
          name?: string | null
          owner_id?: string | null
          parent_id?: string | null
          position?: number
          server_id?: string | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "channels_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          max_uses: number | null
          server_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number | null
          server_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number | null
          server_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          id: string
          role_id: string
          server_id: string
          user_id: string
        }
        Insert: {
          id?: string
          role_id: string
          server_id: string
          user_id: string
        }
        Update: {
          id?: string
          role_id?: string
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_member_fk"
            columns: ["server_id", "user_id"]
            isOneToOne: false
            referencedRelation: "server_members"
            referencedColumns: ["server_id", "user_id"]
          },
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          author_id: string | null
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          has_link: boolean | null
          id: string
          mention_everyone: boolean
          mention_roles: string[]
          mentions: string[]
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          search: unknown
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          channel_id: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id: string
          mention_everyone?: boolean
          mention_roles?: string[]
          mentions?: string[]
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mention_everyone?: boolean
          mention_roles?: string[]
          mentions?: string[]
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_color: string
          bio: string
          created_at: string
          custom_status_emoji: string | null
          custom_status_expires_at: string | null
          custom_status_text: string | null
          display_name: string | null
          id: string
          onboarded_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          banner_color?: string
          bio?: string
          created_at?: string
          custom_status_emoji?: string | null
          custom_status_expires_at?: string | null
          custom_status_text?: string | null
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          banner_color?: string
          bio?: string
          created_at?: string
          custom_status_emoji?: string | null
          custom_status_expires_at?: string | null
          custom_status_text?: string | null
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      read_states: {
        Row: {
          channel_id: string
          id: string
          last_read_at: string
          last_read_message_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id?: string
        }
        Update: {
          channel_id?: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          color: string | null
          created_at: string
          hoist: boolean
          id: string
          is_default: boolean
          mentionable: boolean
          name: string
          permissions: number
          position: number
          server_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          hoist?: boolean
          id?: string
          is_default?: boolean
          mentionable?: boolean
          name: string
          permissions?: number
          position?: number
          server_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          hoist?: boolean
          id?: string
          is_default?: boolean
          mentionable?: boolean
          name?: string
          permissions?: number
          position?: number
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_members: {
        Row: {
          id: string
          joined_at: string
          nickname: string | null
          server_id: string
          timeout_until: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          nickname?: string | null
          server_id: string
          timeout_until?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          nickname?: string | null
          server_id?: string
          timeout_until?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_send: { Args: { p_channel: string; p_user?: string }; Returns: boolean }
      can_view_channel: { Args: { p_channel: string }; Returns: boolean }
      channel_permissions: {
        Args: { p_channel: string; p_user?: string }
        Returns: number
      }
      create_invite: {
        Args: { p_max_age_seconds?: number; p_max_uses?: number; p_server: string }
        Returns: Database["public"]["Tables"]["invites"]["Row"]
      }
      create_server: {
        Args: { p_icon_url?: string; p_name: string }
        Returns: string
      }
      get_invite: {
        Args: { p_code: string }
        Returns: {
          code: string
          expires_at: string | null
          is_member: boolean
          is_valid: boolean
          member_count: number
          server_icon_url: string | null
          server_id: string
          server_name: string
        }[]
      }
      get_unread_state: {
        Args: never
        Returns: {
          channel_id: string
          last_message_at: string
          last_read_at: string
          mention_count: number
          server_id: string
        }[]
      }
      has_server_permission: {
        Args: { p_perm: number; p_server: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { p_server: string; p_user?: string }
        Returns: boolean
      }
      join_server_by_invite: { Args: { p_code: string }; Returns: string }
      leave_server: { Args: { p_server: string }; Returns: undefined }
      mark_read: { Args: { p_channel: string; p_message: string }; Returns: string }
      member_top_position: {
        Args: { p_server: string; p_user: string }
        Returns: number
      }
      reorder_channels: {
        Args: { p_items: Json; p_server: string }
        Returns: undefined
      }
      send_message: {
        Args: {
          p_attachments?: Json
          p_channel: string
          p_content: string
          p_id: string
          p_reply_to?: string
        }
        Returns: Database["public"]["Tables"]["messages"]["Row"][]
      }
      server_permissions: {
        Args: { p_server: string; p_user?: string }
        Returns: number
      }
      try_uuid: { Args: { p: string }; Returns: string }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      channel_type: "text" | "voice" | "category" | "thread" | "dm" | "group_dm"
      message_type: "default" | "reply" | "system" | "thread_created" | "pin"
      user_status: "online" | "idle" | "dnd" | "invisible"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
