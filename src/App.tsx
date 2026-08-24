import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';

import { Leaders } from '@/pages/Leaders';
import { Login } from '@/pages/Login';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { PublicCheckIn } from '@/pages/checkin/PublicCheckIn';
import { Dashboard } from '@/pages/Dashboard';
import { MembersList } from '@/pages/members/MembersList';
import { MemberProfile } from '@/pages/members/MemberProfile';
import { Ministries } from '@/pages/Ministries';
import { Attendance } from '@/pages/Attendance';
import { Events } from '@/pages/Events';
import { Reports } from '@/pages/Reports';
import { Announcements } from '@/pages/Announcements';
import { Visitors } from '@/pages/Visitors';
import { PrayerRequests } from '@/pages/PrayerRequests';
import { Sms } from '@/pages/Sms';
import { Users } from '@/pages/Users';
import { Settings } from '@/pages/Settings';
import { AuditLogs } from '@/pages/AuditLogs';
import { MinistryDashboard } from '@/pages/MinistryDashboard';
import { MinistryTasks } from '@/pages/MinistryTasks';
import { MinistryReports } from '@/pages/MinistryReports';
import { MemberFollowUp } from '@/pages/MemberFollowUp';
import { AllMinistryReports } from '@/pages/AllMinistryReports';
import { AllMemberFollowUps } from '@/pages/AllMemberFollowUps';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/checkin/:token" element={<PublicCheckIn />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<MembersList />} />
            <Route path="/members/:id" element={<MemberProfile />} />
            <Route path="/ministries" element={<Ministries />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/events" element={<Events />} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={['administrator', 'pastor']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/visitors" element={
                <ProtectedRoute roles={['administrator', 'secretary', 'ministry_leader']}>
                  <Visitors />
                </ProtectedRoute>
              }
            />
            <Route path="/prayer-requests" element={
                <ProtectedRoute roles={['administrator', 'pastor', 'secretary']}>
                  <PrayerRequests />
                </ProtectedRoute>
              }
            />
            <Route path="/leaders" element={
                <ProtectedRoute roles={['administrator', 'pastor', 'ministry_leader', 'secretary']}>
                  <Leaders />
                </ProtectedRoute>
              }
            />
            <Route path="/ministry-dashboard" element={
                <ProtectedRoute roles={['ministry_leader']}>
                  <MinistryDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/ministry-tasks" element={
                <ProtectedRoute roles={['ministry_leader', 'administrator', 'secretary']}>
                  <MinistryTasks />
                </ProtectedRoute>
              }
            />
            <Route path="/ministry-reports" element={
                <ProtectedRoute roles={['ministry_leader', 'administrator', 'secretary']}>
                  <MinistryReports />
                </ProtectedRoute>
              }
            />
            <Route path="/member-followup" element={
                <ProtectedRoute roles={['ministry_leader', 'administrator', 'secretary']}>
                  <MemberFollowUp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sms"
              element={
                <ProtectedRoute roles={['administrator', 'secretary']}>
                  <Sms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={['administrator']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/all-ministry-reports"
              element={
                <ProtectedRoute roles={['administrator', 'secretary']}>
                  <AllMinistryReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/all-member-followups"
              element={
                <ProtectedRoute roles={['administrator', 'secretary']}>
                  <AllMemberFollowUps />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute roles={['administrator', 'secretary']}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-3xl font-bold text-ink">404</h1>
      <p className="text-sm text-slate-500">This page doesn't exist.</p>
      <a href="/" className="mt-2 text-sm font-medium text-secondary hover:underline">
        Go home
      </a>
    </div>
  );
}
