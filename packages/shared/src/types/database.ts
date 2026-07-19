/**
 * Hand-written to match supabase-js's expected Database shape, since `supabase
 * gen types typescript` needs either a linked project or a local Docker
 * daemon — neither reachable from this environment. Once either is
 * available, regenerate with:
 *   supabase gen types typescript --linked > packages/shared/src/types/database.ts
 * and diff against this file (it should match 1:1 — this was authored
 * directly from supabase/migrations/*.sql).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "superadmin" | "kundeadmin" | "org_ansvarlig" | "kurs_ansvarlig" | "bruker";
export type MoveOnType = "Passed" | "Completed" | "CompletedOrPassed" | "CompletedAndPassed" | "NotApplicable";
export type LaunchMethodType = "AnyWindow" | "OwnWindow";
export type LaunchModeType = "Normal" | "Browse" | "Review";
export type RegistrationStatusType = "active" | "terminated" | "satisfied" | "abandoned" | "superseded";
export type SessionStatusType = "active" | "ended" | "superseded" | "expired";
export type EnrollmentStatusType = "active" | "completed" | "withdrawn";
export type CourseCompletionStatusType = "not_started" | "in_progress" | "completed";

type NoRelationships = { Relationships: [] };

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string; deleted_at: string | null };
        Insert: { id?: string; name: string; created_at?: string; deleted_at?: string | null };
        Update: { id?: string; name?: string; created_at?: string; deleted_at?: string | null };
      } & NoRelationships;

      profiles: {
        Row: {
          user_id: string;
          org_id: string | null;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          org_id?: string | null;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          org_id?: string | null;
          full_name?: string | null;
          created_at?: string;
        };
      } & NoRelationships;

      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          org_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: UserRole;
          org_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRole;
          org_id?: string | null;
          created_at?: string;
        };
      } & NoRelationships;

      kundeadmin_orgs: {
        Row: { kundeadmin_user_id: string; org_id: string };
        Insert: { kundeadmin_user_id: string; org_id: string };
        Update: { kundeadmin_user_id?: string; org_id?: string };
      } & NoRelationships;

      kundeadmin_courses: {
        Row: { kundeadmin_user_id: string; course_id: string };
        Insert: { kundeadmin_user_id: string; course_id: string };
        Update: { kundeadmin_user_id?: string; course_id?: string };
      } & NoRelationships;

      course_responsibles: {
        Row: { org_id: string; course_id: string; user_id: string };
        Insert: { org_id: string; course_id: string; user_id: string };
        Update: { org_id?: string; course_id?: string; user_id?: string };
      } & NoRelationships;

      content_packages: {
        Row: {
          id: string;
          storage_path: string;
          imsmanifest_or_cmi5_parsed: Json;
          package_sha256: string;
          size_bytes: number;
          file_count: number;
          imported_at: string;
        };
        Insert: {
          id?: string;
          storage_path: string;
          imsmanifest_or_cmi5_parsed: Json;
          package_sha256: string;
          size_bytes: number;
          file_count: number;
          imported_at?: string;
        };
        Update: {
          id?: string;
          storage_path?: string;
          imsmanifest_or_cmi5_parsed?: Json;
          package_sha256?: string;
          size_bytes?: number;
          file_count?: number;
          imported_at?: string;
        };
      } & NoRelationships;

      courses: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          publisher: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          publisher?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          publisher?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
      } & NoRelationships;

      course_versions: {
        Row: {
          id: string;
          course_id: string;
          version_label: string;
          content_package_id: string;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          version_label: string;
          content_package_id: string;
          published_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          version_label?: string;
          content_package_id?: string;
          published_at?: string | null;
          created_at?: string;
        };
      } & NoRelationships;

      course_blocks: {
        Row: {
          id: string;
          course_version_id: string;
          parent_block_id: string | null;
          block_index: number;
          publisher_block_id: string;
          activity_id: string;
          title: string | null;
          description: string | null;
        };
        Insert: {
          id?: string;
          course_version_id: string;
          parent_block_id?: string | null;
          block_index: number;
          publisher_block_id: string;
          activity_id: string;
          title?: string | null;
          description?: string | null;
        };
        Update: {
          id?: string;
          course_version_id?: string;
          parent_block_id?: string | null;
          block_index?: number;
          publisher_block_id?: string;
          activity_id?: string;
          title?: string | null;
          description?: string | null;
        };
      } & NoRelationships;

      assignable_units: {
        Row: {
          id: string;
          course_version_id: string;
          block_id: string | null;
          au_index: number;
          publisher_id: string;
          activity_id: string;
          launch_url: string;
          move_on: MoveOnType;
          mastery_score: number | null;
          launch_method: LaunchMethodType;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_version_id: string;
          block_id?: string | null;
          au_index: number;
          publisher_id: string;
          activity_id: string;
          launch_url: string;
          move_on: MoveOnType;
          mastery_score?: number | null;
          launch_method?: LaunchMethodType;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_version_id?: string;
          block_id?: string | null;
          au_index?: number;
          publisher_id?: string;
          activity_id?: string;
          launch_url?: string;
          move_on?: MoveOnType;
          mastery_score?: number | null;
          launch_method?: LaunchMethodType;
          created_at?: string;
        };
      } & NoRelationships;

      enrollments: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          course_version_id: string;
          status: EnrollmentStatusType;
          assigned_by: string | null;
          assigned_at: string;
          due_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          course_version_id: string;
          status?: EnrollmentStatusType;
          assigned_by?: string | null;
          assigned_at?: string;
          due_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          course_version_id?: string;
          status?: EnrollmentStatusType;
          assigned_by?: string | null;
          assigned_at?: string;
          due_at?: string | null;
        };
      } & NoRelationships;

      registrations: {
        Row: {
          id: string;
          enrollment_id: string;
          au_id: string;
          registration_uuid: string;
          org_id: string;
          user_id: string;
          current_session_id: string | null;
          launch_mode: LaunchModeType;
          status: RegistrationStatusType;
          attempt_number: number;
          started_at: string;
          last_statement_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          au_id: string;
          registration_uuid?: string;
          org_id: string;
          user_id: string;
          current_session_id?: string | null;
          launch_mode?: LaunchModeType;
          status?: RegistrationStatusType;
          attempt_number?: number;
          started_at?: string;
          last_statement_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          enrollment_id?: string;
          au_id?: string;
          registration_uuid?: string;
          org_id?: string;
          user_id?: string;
          current_session_id?: string | null;
          launch_mode?: LaunchModeType;
          status?: RegistrationStatusType;
          attempt_number?: number;
          started_at?: string;
          last_statement_at?: string | null;
          ended_at?: string | null;
        };
      } & NoRelationships;

      registration_sessions: {
        Row: {
          session_id: string;
          registration_id: string;
          org_id: string;
          user_id: string;
          launched_at: string;
          token_expires_at: string;
          ended_at: string | null;
          status: SessionStatusType;
        };
        Insert: {
          session_id?: string;
          registration_id: string;
          org_id: string;
          user_id: string;
          launched_at?: string;
          token_expires_at: string;
          ended_at?: string | null;
          status?: SessionStatusType;
        };
        Update: {
          session_id?: string;
          registration_id?: string;
          org_id?: string;
          user_id?: string;
          launched_at?: string;
          token_expires_at?: string;
          ended_at?: string | null;
          status?: SessionStatusType;
        };
      } & NoRelationships;

      xapi_statements: {
        Row: {
          statement_id: string;
          registration: string;
          org_id: string;
          actor_account: string;
          verb_id: string;
          activity_id: string;
          statement: Json;
          statement_hash: string;
          stored_at: string;
        };
        Insert: {
          statement_id: string;
          registration: string;
          org_id: string;
          actor_account: string;
          verb_id: string;
          activity_id: string;
          statement: Json;
          statement_hash: string;
          stored_at?: string;
        };
        Update: {
          statement_id?: string;
          registration?: string;
          org_id?: string;
          actor_account?: string;
          verb_id?: string;
          activity_id?: string;
          statement?: Json;
          statement_hash?: string;
          stored_at?: string;
        };
      } & NoRelationships;

      xapi_state: {
        Row: {
          actor_account: string;
          activity_id: string;
          registration: string;
          state_id: string;
          document: Json;
          org_id: string;
          updated_at: string;
        };
        Insert: {
          actor_account: string;
          activity_id: string;
          registration: string;
          state_id: string;
          document: Json;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          actor_account?: string;
          activity_id?: string;
          registration?: string;
          state_id?: string;
          document?: Json;
          org_id?: string;
          updated_at?: string;
        };
      } & NoRelationships;

      completion_state: {
        Row: {
          registration: string;
          org_id: string;
          user_id: string;
          course_version_id: string;
          au_id: string;
          completion: string | null;
          success: string | null;
          score: number | null;
          satisfied: boolean;
          updated_at: string;
        };
        Insert: {
          registration: string;
          org_id: string;
          user_id: string;
          course_version_id: string;
          au_id: string;
          completion?: string | null;
          success?: string | null;
          score?: number | null;
          satisfied?: boolean;
          updated_at?: string;
        };
        Update: {
          registration?: string;
          org_id?: string;
          user_id?: string;
          course_version_id?: string;
          au_id?: string;
          completion?: string | null;
          success?: string | null;
          score?: number | null;
          satisfied?: boolean;
          updated_at?: string;
        };
      } & NoRelationships;

      course_completion: {
        Row: {
          enrollment_id: string;
          org_id: string;
          user_id: string;
          course_version_id: string;
          status: CourseCompletionStatusType;
          satisfied: boolean;
          score: number | null;
          completed_at: string | null;
          certificate_id: string | null;
          updated_at: string;
        };
        Insert: {
          enrollment_id: string;
          org_id: string;
          user_id: string;
          course_version_id: string;
          status?: CourseCompletionStatusType;
          satisfied?: boolean;
          score?: number | null;
          completed_at?: string | null;
          certificate_id?: string | null;
          updated_at?: string;
        };
        Update: {
          enrollment_id?: string;
          org_id?: string;
          user_id?: string;
          course_version_id?: string;
          status?: CourseCompletionStatusType;
          satisfied?: boolean;
          score?: number | null;
          completed_at?: string | null;
          certificate_id?: string | null;
          updated_at?: string;
        };
      } & NoRelationships;

      certificates: {
        Row: {
          id: string;
          cert_uuid: string;
          user_id: string;
          org_id: string;
          course_version_id: string;
          pdf_storage_path: string;
          issued_at: string;
          revoked: boolean;
        };
        Insert: {
          id?: string;
          cert_uuid?: string;
          user_id: string;
          org_id: string;
          course_version_id: string;
          pdf_storage_path: string;
          issued_at?: string;
          revoked?: boolean;
        };
        Update: {
          id?: string;
          cert_uuid?: string;
          user_id?: string;
          org_id?: string;
          course_version_id?: string;
          pdf_storage_path?: string;
          issued_at?: string;
          revoked?: boolean;
        };
      } & NoRelationships;

      audit_log: {
        Row: {
          id: string;
          org_id: string | null;
          actor_user_id: string | null;
          action: string;
          target: string;
          metadata: Json | null;
          at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          actor_user_id?: string | null;
          action: string;
          target: string;
          metadata?: Json | null;
          at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          actor_user_id?: string | null;
          action?: string;
          target?: string;
          metadata?: Json | null;
          at?: string;
        };
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: {
      has_org_access: { Args: { p_uid: string; p_org_id: string }; Returns: boolean };
      has_course_access: { Args: { p_uid: string; p_course_id: string }; Returns: boolean };
      has_course_version_access: { Args: { p_uid: string; p_course_version_id: string }; Returns: boolean };
      is_superadmin: { Args: { p_uid: string }; Returns: boolean };
      has_role_in_org: { Args: { p_uid: string; p_role: UserRole; p_org_id: string }; Returns: boolean };
      has_any_role_in_org: { Args: { p_uid: string; p_roles: UserRole[]; p_org_id: string }; Returns: boolean };
      has_role: { Args: { p_uid: string; p_role: UserRole }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      move_on_type: MoveOnType;
      launch_method_type: LaunchMethodType;
      launch_mode_type: LaunchModeType;
      registration_status_type: RegistrationStatusType;
      session_status_type: SessionStatusType;
      enrollment_status_type: EnrollmentStatusType;
      course_completion_status_type: CourseCompletionStatusType;
    };
  };
}
