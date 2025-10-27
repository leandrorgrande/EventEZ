import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

export default function Admin() {
  const { userProfile, isLoading: authLoading, isAdmin } = useAuth();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-blue-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-400 mb-2">This page is restricted to administrators only.</p>
          <p className="text-sm text-yellow-400 mb-6">
            Your user type: {userProfile?.userType || 'none'}
          </p>
          <Button onClick={() => window.location.href = "/"}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>Bem-vindo ao Admin Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              Esta é uma versão simplificada da página admin. Todas as funcionalidades estão temporariamente comentadas para debug.
            </p>
            <p className="text-gray-400 mt-4">
              User Type: <span className="text-blue-400 font-bold">{userProfile?.userType || 'N/A'}</span>
            </p>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button onClick={() => window.location.href = "/profile"}>
            Voltar para Profile
          </Button>
        </div>
      </div>

      <BottomNavigation currentPage="/admin" />
    </div>
  );
}