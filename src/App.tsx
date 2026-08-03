import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AccessPage from "@/pages/AccessPage";
import AccessPageFallback from "@/pages/AccessPageFallback";
import HomePage from "@/pages/HomePage";
import ObraPlanoPage from "@/pages/ObraPlanoPage";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, funcionario, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user && !funcionario) return <AccessPageFallback />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/access/:token" element={<AccessPage />} />
          <Route path="/obra/:obraId" element={<AuthGate><ObraPlanoPage /></AuthGate>} />
          <Route path="*" element={<AuthGate><HomePage /></AuthGate>} />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
