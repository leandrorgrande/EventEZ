import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import EditProfileModal from "@/components/EditProfileModal";
import BusinessClaimModal from "@/components/BusinessClaimModal";
import SettingsModal from "@/components/SettingsModal"; // EVENTU: Added Settings modal
import EventHistoryModal from "@/components/EventHistoryModal"; // EVENTU: Added Event History modal
import { Settings, History, LogOut, Calendar, Users, Edit3, Building2, Shield } from "lucide-react";
import { signOutUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Profile() {
  const { user, userProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [businessClaimOpen, setBusinessClaimOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false); // EVENTU: Settings modal state
  const [historyOpen, setHistoryOpen] = useState(false); // EVENTU: History modal state

  const { data: allEvents } = useQuery({
    queryKey: ["/api/events-all-profile"],
    queryFn: async () => {
      console.log('[Profile] Buscando eventos...');
      console.log('[Profile] User ID:', userProfile?.id);
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      console.log('[Profile] Token disponível:', !!token);
      
      const response = await fetch(`${API_URL}/events?approvalStatus=all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[Profile] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Profile] Erro ao buscar eventos:', errorText);
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Profile] Total de eventos:', data.length);
      console.log('[Profile] Eventos:', data);
      return data;
    },
    enabled: !!userProfile?.id,
  });

  // Filtrar eventos do usuário atual (todos, independente de status)
  const userEvents = allEvents?.filter((event: any) => {
    const matches = event.creatorId === userProfile?.id;
    console.log('[Profile] Evento:', event.title, 'creatorId:', event.creatorId, 'matches:', matches);
    return matches;
  }) || [];
  
  console.log('[Profile] Eventos do usuário:', userEvents.length);

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer logout",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Not logged in</h2>
          <Button onClick={() => window.location.href = "/api/login"}>
            Log In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={userProfile.profileImageUrl || ""} alt={userProfile.firstName || "User"} />
            <AvatarFallback className="bg-blue-600 text-white text-lg">
              {(userProfile.firstName?.[0] || userProfile.email?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-user-name">
              {userProfile.firstName && userProfile.lastName 
                ? `${userProfile.firstName} ${userProfile.lastName}`
                : userProfile.email}
            </h1>
            <p className="text-gray-400" data-testid="text-user-email">{userProfile.email}</p>
            <Badge variant="secondary" className="mt-1">
              {userProfile.userType === "business" ? "Business" : userProfile.userType === "admin" ? "Admin" : "Regular User"}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditProfileOpen(true)}
            className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            data-testid="button-edit-profile"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-events-created">
                {userEvents?.length || 0}
              </div>
              <div className="text-sm text-gray-400">Events Created</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-events-attended">
                0
              </div>
              <div className="text-sm text-gray-400">Events Attended</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Events */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Your Events</CardTitle>
            <CardDescription>Events you've created</CardDescription>
          </CardHeader>
          <CardContent>
            {userEvents && userEvents.length > 0 ? (
              <div className="space-y-3">
                {userEvents.slice(0, 5).map((event: any) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'approved': return 'bg-green-600';
                      case 'rejected': return 'bg-red-600';
                      case 'pending': return 'bg-yellow-600';
                      default: return 'bg-gray-600';
                    }
                  };

                  const getStatusLabel = (status: string) => {
                    switch (status) {
                      case 'approved': return 'Aprovado';
                      case 'rejected': return 'Rejeitado';
                      case 'pending': return 'Pendente';
                      default: return status;
                    }
                  };

                  return (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-white" data-testid={`text-event-title-${event.id}`}>
                          {event.title}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {new Date(event.startDateTime).toLocaleDateString()} às {new Date(event.startDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {event.location?.name && (
                          <p className="text-xs text-gray-500 mt-1">
                            📍 {event.location.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={`text-xs ${getStatusColor(event.approvalStatus || 'pending')}`}>
                          {getStatusLabel(event.approvalStatus || 'pending')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {event.eventType}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4" data-testid="text-no-events">
                You haven't created any events yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Menu Options - EVENTU: Added onClick handlers */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            className="w-full justify-start text-white hover:bg-slate-700/50"
            data-testid="button-settings"
          >
            <Settings className="mr-3 h-5 w-5 text-gray-400" />
            Settings
          </Button>

          <Button
            variant="ghost"
            onClick={() => setHistoryOpen(true)}
            className="w-full justify-start text-white hover:bg-slate-700/50"
            data-testid="button-history"
          >
            <History className="mr-3 h-5 w-5 text-gray-400" />
            Event History
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin")}
              className="w-full justify-start text-blue-400 hover:bg-blue-600/20 hover:text-blue-300"
              data-testid="button-admin"
            >
              <Shield className="mr-3 h-5 w-5" />
              Admin Dashboard
            </Button>
          )}

          {userProfile.userType !== "business" && (
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-slate-700/50"
              onClick={() => setBusinessClaimOpen(true)}
              data-testid="button-claim-business"
            >
              <Building2 className="mr-3 h-5 w-5 text-gray-400" />
              Claim Business
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-red-400 hover:bg-red-600/20 hover:text-red-300"
            data-testid="button-logout"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="profile" />

      {/* Modals - EVENTU: Added Settings and History modals */}
      <EditProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        user={user}
      />

      <BusinessClaimModal
        open={businessClaimOpen}
        onOpenChange={setBusinessClaimOpen}
      />

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user}
      />

      <EventHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        user={user}
      />
    </div>
  );
}
