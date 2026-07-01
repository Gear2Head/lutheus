import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider } from './contexts/LanguageContext';
import AppLayout from './layouts/AppLayout';

// Lazy load all pages for code splitting
const Tickets = lazy(() => import('./pages/Tickets'));
const Home = lazy(() => import('./pages/Home'));
const Cases = lazy(() => import('./pages/Cases'));
const Staff = lazy(() => import('./pages/Staff'));
const StaffProfiles = lazy(() => import('./pages/StaffProfiles'));
const Profile = lazy(() => import('./pages/Profile'));
const Rules = lazy(() => import('./pages/Rules'));
const AiAgent = lazy(() => import('./pages/AiAgent'));
const Access = lazy(() => import('./pages/Access'));
const Announcements = lazy(() => import('./pages/Announcements'));
const BotSetup = lazy(() => import('./pages/BotSetup'));
const Settings = lazy(() => import('./pages/Settings'));
const Appeals = lazy(() => import('./pages/Appeals'));
const Applications = lazy(() => import('./pages/Applications'));
const ApplyForm = lazy(() => import('./pages/ApplyForm'));
const YsymExam = lazy(() => import('./pages/YsymExam'));
const ManageForms = lazy(() => import('./pages/ManageForms'));
const Ysym = lazy(() => import('./pages/Ysym'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0, 150, 300].map((d) => (
          <div
            key={d}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="apply" element={<Suspense fallback={<PageLoader />}><ApplyForm /></Suspense>} />
              <Route path="ysym-exam" element={<Suspense fallback={<PageLoader />}><YsymExam /></Suspense>} />
              <Route path="basvuru" element={<Suspense fallback={<PageLoader />}><ApplyForm /></Suspense>} />
              <Route path="ysym-sinavi" element={<Suspense fallback={<PageLoader />}><YsymExam /></Suspense>} />

              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="home" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
                <Route path="cases" element={<Suspense fallback={<PageLoader />}><Cases /></Suspense>} />
                <Route path="staff" element={<Suspense fallback={<PageLoader />}><Staff /></Suspense>} />
                <Route path="staff-profiles" element={<Suspense fallback={<PageLoader />}><StaffProfiles /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
                <Route path="rules" element={<Suspense fallback={<PageLoader />}><Rules /></Suspense>} />
                <Route path="ai-agent" element={<Suspense fallback={<PageLoader />}><AiAgent /></Suspense>} />
                <Route path="access" element={<Suspense fallback={<PageLoader />}><Access /></Suspense>} />
                <Route path="announcements" element={<Suspense fallback={<PageLoader />}><Announcements /></Suspense>} />
                <Route path="bot-setup" element={<Suspense fallback={<PageLoader />}><BotSetup /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                <Route path="appeals" element={<Suspense fallback={<PageLoader />}><Appeals /></Suspense>} />
                <Route path="applications" element={<Suspense fallback={<PageLoader />}><Applications /></Suspense>} />
                <Route path="tickets" element={<Suspense fallback={<PageLoader />}><Tickets /></Suspense>} />
                <Route path="manage-forms" element={<Suspense fallback={<PageLoader />}><ManageForms /></Suspense>} />
                <Route path="ysym" element={<Suspense fallback={<PageLoader />}><Ysym /></Suspense>} />
              </Route>
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
