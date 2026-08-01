// Hand-written types that mirror supabase/schema.sql.
// If you change the schema, update this file (or generate it with
// `npx supabase gen types typescript` — see README).

export type UserRole = 'administrator' | 'secretary' | 'pastor' | 'ministry_leader';
export type MemberStatus = 'active' | 'inactive' | 'archived' | 'transferred' | 'deceased';
export type Gender = 'male' | 'female';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type AttendanceType = 'sabbath_service' | 'midweek_service' | 'event';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ministry {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Member {
  id: string;
  member_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  marital_status: MaritalStatus | null;
  occupation: string | null;
  nationality: string | null;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  residential_address: string | null;
  gps_address: string | null;
  baptism_date: string | null;
  date_joined: string;
  district: string | null;
  ministry_id: string | null;
  status: MemberStatus;
  spouse_name: string | null;
  children_names: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profile_image_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface MinistryMember {
  id: string;
  ministry_id: string;
  member_id: string;
  joined_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Attendance {
  id: string;
  member_id: string;
  attendance_type: AttendanceType;
  event_id: string | null;
  service_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string;
  record_id: string | null;
  description: string | null;
  created_at: string;
}

// Minimal Database generic shape so supabase-js typing works without
// generating the full CLI types. Extend as needed.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      ministries: { Row: Ministry; Insert: Partial<Ministry>; Update: Partial<Ministry> };
      members: { Row: Member; Insert: Partial<Member>; Update: Partial<Member> };
      ministry_members: {
        Row: MinistryMember;
        Insert: Partial<MinistryMember>;
        Update: Partial<MinistryMember>;
      };
      events: { Row: Event; Insert: Partial<Event>; Update: Partial<Event> };
      attendance: { Row: Attendance; Insert: Partial<Attendance>; Update: Partial<Attendance> };
      announcements: {
        Row: Announcement;
        Insert: Partial<Announcement>;
        Update: Partial<Announcement>;
      };
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog> };
    };
  };
}
