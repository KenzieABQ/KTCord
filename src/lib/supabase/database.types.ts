export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
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
            foreignKeyName: "bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "channel_activity_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_recipients: {
        Row: {
          channel_id: string
          hidden: boolean
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          hidden?: boolean
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          hidden?: boolean
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_recipients_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          dm_key: string | null
          id: string
          is_private: boolean
          name: string | null
          owner_id: string | null
          parent_id: string | null
          position: number
          server_id: string | null
          source_message_id: string | null
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          created_at?: string
          dm_key?: string | null
          id?: string
          is_private?: boolean
          name?: string | null
          owner_id?: string | null
          parent_id?: string | null
          position?: number
          server_id?: string | null
          source_message_id?: string | null
          topic?: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          created_at?: string
          dm_key?: string | null
          id?: string
          is_private?: boolean
          name?: string | null
          owner_id?: string | null
          parent_id?: string | null
          position?: number
          server_id?: string | null
          source_message_id?: string | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "channels_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          accepted_at?: string | null
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          accepted_at?: string | null
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          has_file: boolean | null
          has_image: boolean | null
          has_link: boolean | null
          has_video: boolean | null
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
          has_file?: boolean | null
          has_image?: boolean | null
          has_link?: boolean | null
          has_video?: boolean | null
          id: string
          mention_everyone?: boolean
          mention_roles?: string[]
          mentions?: string[]
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          search?: unknown
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          has_file?: boolean | null
          has_image?: boolean | null
          has_link?: boolean | null
          has_video?: boolean | null
          id?: string
          mention_everyone?: boolean
          mention_roles?: string[]
          mentions?: string[]
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          search?: unknown
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
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      notification_settings: {
        Row: {
          channel_id: string | null
          id: string
          level: Database["public"]["Enums"]["notification_level"] | null
          muted_until: string | null
          server_id: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          id?: string
          level?: Database["public"]["Enums"]["notification_level"] | null
          muted_until?: string | null
          server_id?: string | null
          user_id?: string
        }
        Update: {
          channel_id?: string | null
          id?: string
          level?: Database["public"]["Enums"]["notification_level"] | null
          muted_until?: string | null
          server_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_settings_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          channel_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "read_states_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "read_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_settings: {
        Row: {
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      add_group_dm_recipients: {
        Args: { p_channel: string; p_users: string[] }
        Returns: undefined
      }
      are_friends: { Args: { p_a: string; p_b: string }; Returns: boolean }
      ban_member: {
        Args: {
          p_delete_seconds?: number
          p_reason?: string
          p_server: string
          p_user: string
        }
        Returns: undefined
      }
      can_attach: {
        Args: { p_channel: string; p_user?: string }
        Returns: boolean
      }
      can_send: {
        Args: { p_channel: string; p_user?: string }
        Returns: boolean
      }
      can_view_channel: { Args: { p_channel: string }; Returns: boolean }
      channel_permissions: {
        Args: { p_channel: string; p_user?: string }
        Returns: number
      }
      channel_row_permissions: {
        Args: {
          p_channel: string
          p_private: boolean
          p_server: string
          p_user?: string
        }
        Returns: number
      }
      close_dm: { Args: { p_channel: string }; Returns: undefined }
      create_group_dm: { Args: { p_users: string[] }; Returns: string }
      create_invite: {
        Args: {
          p_max_age_seconds?: number
          p_max_uses?: number
          p_server: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          max_uses: number | null
          server_id: string
          uses: number
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_role: {
        Args: {
          p_color?: string
          p_hoist?: boolean
          p_mentionable?: boolean
          p_name: string
          p_permissions?: number
          p_server: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_server: {
        Args: { p_icon_url?: string; p_name: string }
        Returns: string
      }
      create_thread: {
        Args: { p_message: string; p_name: string }
        Returns: string
      }
      delete_role: { Args: { p_role: string }; Returns: undefined }
      get_invite: {
        Args: { p_code: string }
        Returns: {
          code: string
          expires_at: string
          is_member: boolean
          is_valid: boolean
          member_count: number
          server_icon_url: string
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
      is_channel_recipient: {
        Args: { p_channel: string; p_user?: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { p_server: string; p_user?: string }
        Returns: boolean
      }
      is_server_owner: {
        Args: { p_server: string; p_user?: string }
        Returns: boolean
      }
      join_server_by_invite: { Args: { p_code: string }; Returns: string }
      kick_member: {
        Args: { p_server: string; p_user: string }
        Returns: undefined
      }
      leave_group_dm: { Args: { p_channel: string }; Returns: undefined }
      leave_server: { Args: { p_server: string }; Returns: undefined }
      mark_channel_read: { Args: { p_channel: string }; Returns: undefined }
      mark_read: {
        Args: { p_channel: string; p_message: string }
        Returns: string
      }
      mark_server_read: { Args: { p_server: string }; Returns: undefined }
      member_top_position: {
        Args: { p_server: string; p_user: string }
        Returns: number
      }
      open_dm: { Args: { p_user: string }; Returns: string }
      outranks: {
        Args: { p_server: string; p_target: string }
        Returns: boolean
      }
      pin_message: {
        Args: { p_message: string; p_pinned: boolean }
        Returns: undefined
      }
      remove_friend: { Args: { p_user: string }; Returns: undefined }
      rename_group_dm: {
        Args: { p_channel: string; p_name: string }
        Returns: undefined
      }
      reorder_channels: {
        Args: { p_items: Json; p_server: string }
        Returns: undefined
      }
      reorder_roles: {
        Args: { p_role_ids: string[]; p_server: string }
        Returns: undefined
      }
      require_grantable: {
        Args: { p_added: number; p_server: string }
        Returns: undefined
      }
      require_manageable_role: {
        Args: { p_role: Database["public"]["Tables"]["roles"]["Row"] }
        Returns: undefined
      }
      require_moderatable: {
        Args: { p_server: string; p_user: string }
        Returns: undefined
      }
      require_permission: {
        Args: { p_action: string; p_perm: number; p_server: string }
        Returns: undefined
      }
      respond_friend_request: {
        Args: { p_accept: boolean; p_request: string }
        Returns: undefined
      }
      search_messages: {
        Args: {
          p_author?: string
          p_channel?: string
          p_has?: string[]
          p_limit?: number
          p_mentions?: string
          p_offset?: number
          p_query?: string
          p_server?: string
        }
        Returns: Json
      }
      send_friend_request: {
        Args: { p_username: string }
        Returns: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_message: {
        Args: {
          p_attachments?: Json
          p_channel: string
          p_content: string
          p_id: string
          p_reply_to?: string
        }
        Returns: {
          attachments: Json
          author_id: string | null
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          has_file: boolean | null
          has_image: boolean | null
          has_link: boolean | null
          has_video: boolean | null
          id: string
          mention_everyone: boolean
          mention_roles: string[]
          mentions: string[]
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          search: unknown
          type: Database["public"]["Enums"]["message_type"]
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      server_permissions: {
        Args: { p_server: string; p_user?: string }
        Returns: number
      }
      set_channel_access: {
        Args: { p_channel: string; p_private: boolean; p_role_ids: string[] }
        Returns: undefined
      }
      set_member_roles: {
        Args: { p_role_ids: string[]; p_server: string; p_user: string }
        Returns: undefined
      }
      set_notification_settings: {
        Args: {
          p_channel?: string
          p_clear_level?: boolean
          p_clear_mute?: boolean
          p_level?: Database["public"]["Enums"]["notification_level"]
          p_muted_until?: string
          p_server?: string
        }
        Returns: {
          channel_id: string | null
          id: string
          level: Database["public"]["Enums"]["notification_level"] | null
          muted_until: string | null
          server_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_server: { Args: { p_a: string; p_b: string }; Returns: boolean }
      timeout_member: {
        Args: { p_server: string; p_until: string; p_user: string }
        Returns: undefined
      }
      try_uuid: { Args: { p: string }; Returns: string }
      unban_member: {
        Args: { p_server: string; p_user: string }
        Returns: undefined
      }
      update_role: {
        Args: {
          p_clear_color?: boolean
          p_color?: string
          p_hoist?: boolean
          p_mentionable?: boolean
          p_name?: string
          p_permissions?: number
          p_role: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      channel_type: "text" | "voice" | "category" | "thread" | "dm" | "group_dm"
      friendship_status: "pending" | "accepted"
      message_type: "default" | "reply" | "system" | "thread_created" | "pin"
      notification_level: "all" | "mentions" | "nothing"
      user_status: "online" | "idle" | "dnd" | "invisible"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      channel_type: ["text", "voice", "category", "thread", "dm", "group_dm"],
      friendship_status: ["pending", "accepted"],
      message_type: ["default", "reply", "system", "thread_created", "pin"],
      notification_level: ["all", "mentions", "nothing"],
      user_status: ["online", "idle", "dnd", "invisible"],
    },
  },
} as const
