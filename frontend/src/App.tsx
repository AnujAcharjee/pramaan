import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ConsentPage } from './pages/ConsentPage';
import { AccountPage } from './pages/AccountPage';
import { DeveloperPage } from './pages/DeveloperPage';
import { ClientPage } from './pages/ClientPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OAuthAuthorizePage } from './pages/OAuthAuthorizePage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen flex flex-col bg-white dark:bg-black text-slate-900 dark:text-white transition-colors">
            <Navbar />
            
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/verify" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                
                {/* OAuth Protocol Routes */}
                <Route path="/oauth/consent" element={<ConsentPage />} />
                <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
                <Route path="/authorize" element={<OAuthAuthorizePage />} />
                <Route path="/api/oauth/authorize" element={<OAuthAuthorizePage />} />

                {/* Consoles */}
                <Route path="/account" element={<AccountPage />} />
                <Route path="/developer" element={<DeveloperPage />} />
                <Route path="/client/create" element={<DeveloperPage openCreateModal={true} />} />
                <Route path="/create-client" element={<DeveloperPage openCreateModal={true} />} />
                <Route path="/client/:id" element={<ClientPage />} />

                {/* 404 Fallback */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>

            <Footer />
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
