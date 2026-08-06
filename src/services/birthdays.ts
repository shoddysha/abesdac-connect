import { supabase } from '@/lib/supabase';
import type { Member } from '@/types/database';

export interface BirthdayMember extends Member {
  days_until: number;
  is_today: boolean;
}

/**
 * Fetch members with upcoming birthdays (next 30 days)
 */
export async function fetchUpcomingBirthdays(): Promise<BirthdayMember[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('status', 'active')
    .not('date_of_birth', 'is', null)
    .order('date_of_birth');

  if (error) throw error;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const membersWithBirthdays = (data || [])
    .map((member) => {
      if (!member.date_of_birth) return null;

      const dob = new Date(member.date_of_birth);
      if (isNaN(dob.getTime())) return null;

      // Use only month/day — works for both full and partial (year=1900) dates
      let birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
      birthdayThisYear.setHours(0, 0, 0, 0);

      // If birthday already passed this year, use next year
      if (birthdayThisYear < today) {
        birthdayThisYear = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
      }

      const daysUntil = Math.ceil(
        (birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isToday = dob.getMonth() === currentMonth && dob.getDate() === currentDay;

      return { ...member, days_until: daysUntil, is_today: isToday } as BirthdayMember;
    })
    .filter((m): m is BirthdayMember => m !== null && m.days_until <= 30)
    .sort((a, b) => a.days_until - b.days_until);

  return membersWithBirthdays;
}

/**
 * Fetch today's birthdays
 */
export async function fetchTodaysBirthdays(): Promise<Member[]> {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const pattern = `%-${month}-${day}`;

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('status', 'active')
    .like('date_of_birth', pattern);

  if (error) throw error;
  return data || [];
}
