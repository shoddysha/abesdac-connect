import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';

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
import { Sms } from '@/pages/Sms';
import { Users } from '@/pages/Users';
import { Settings } from '@/pages/Settings';

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
