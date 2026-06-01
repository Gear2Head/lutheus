import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider } from './contexts/LanguageContext';
import AppLayout from './layouts/AppLayout';

// Lazy load all pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Cases = lazy(() => import('./pages/Cases'));
const Staff = lazy(() => import('./pages/Staff'));
const Scan = lazy(() => import('./pages/Scan'));
const Pointtrain = lazy(() => import('./pages/Pointtrain'));
const Rules = lazy(() => import('./pages/Rules'));
const AiAgent = lazy(() => import('./pages/AiAgent'));
const Access = lazy(() => import('./pages/Access'));
const Settings = lazy(() => import('./pages/Settings'));

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
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="home" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
                <Route path="cases" element={<Suspense fallback={<PageLoader />}><Cases /></Suspense>} />
                <Route path="staff" element={<Suspense fallback={<PageLoader />}><Staff /></Suspense>} />
                <Route path="scan" element={<Suspense fallback={<PageLoader />}><Scan /></Suspense>} />
                <Route path="pointtrain" element={<Suspense fallback={<PageLoader />}><Pointtrain /></Suspense>} />
                <Route path="rules" element={<Suspense fallback={<PageLoader />}><Rules /></Suspense>} />
                <Route path="ai-agent" element={<Suspense fallback={<PageLoader />}><AiAgent /></Suspense>} />
                <Route path="access" element={<Suspense fallback={<PageLoader />}><Access /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              </Route>
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
