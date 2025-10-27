import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Shield, 
  Building2, 
  Users, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock
} from "lucide-react";

export default function Admin() {
  const { userProfile, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scrapingResults, setScrapingResults] = useState<any>(null);
  const [isScraping, setIsScraping] = useState(false);

  // Queries (enabled only if admin to prevent unnecessary calls)
  const { data: businessClaims = [] } = useQuery({
    queryKey: ["/api/business-claims"],
    enabled: !!isAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!isAdmin,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ["/api/events-all"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_URL}/events?approvalStatus=all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error(`Failed to fetch events: ${response.status}`);
      return response.json();
    },
  });

  // Filter events
  const pendingEvents = Array.isArray(allEvents) ? allEvents.filter((e: any) => e.approvalStatus === 'pending') : [];
  const approvedEvents = Array.isArray(allEvents) ? allEvents.filter((e: any) => e.approvalStatus === 'approved') : [];
  const rejectedEvents = Array.isArray(allEvents) ? allEvents.filter((e: any) => e.approvalStatus === 'rejected') : [];

  // Mutations
  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, approvalStatus }: { eventId: string; approvalStatus: string }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ approvalStatus })
      });
      
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Event Updated", description: "Event status has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/events-all"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update event status.", variant: "destructive" });
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_URL}/places/scrape-popular-times`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`Failed to scrape`);
      return response.json();
    },
    onSuccess: (data) => {
      setScrapingResults(data);
      toast({ title: "Scraping concluído", description: `${data.success} lugares atualizados, ${data.errors} erros` });
    },
    onError: () => {
      toast({ title: "Erro no scraping", description: "Erro ao executar scraping", variant: "destructive" });
    },
    onSettled: () => setIsScraping(false),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-600";
      case "rejected": return "bg-red-600";
      case "pending": return "bg-yellow-600";
      default: return "bg-gray-600";
    }
  };

  // Loading and Auth checks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Shield className="h-16 w-16 text-blue-400 animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-400 mb-2">This page is restricted to administrators only.</p>
          <p className="text-sm text-yellow-400 mb-6">Your user type: {userProfile?.userType || 'none'}</p>
          <Button onClick={() => window.location.href = "/"}>Go to Home</Button>
        </div>
      </div>
    );
  }

  const pendingClaims = Array.isArray(businessClaims) ? businessClaims.filter((c: any) => c.status === "pending") : [];
  const approvedClaims = Array.isArray(businessClaims) ? businessClaims.filter((c: any) => c.status === "approved") : [];
  const rejectedClaims = Array.isArray(businessClaims) ? businessClaims.filter((c: any) => c.status === "rejected") : [];

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      <div className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400">Manage users, events, and business claims</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{Array.isArray(allUsers) ? allUsers.length : 0}</div>
              <div className="text-sm text-gray-400">Total Users</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{Array.isArray(allEvents) ? allEvents.length : 0}</div>
              <div className="text-sm text-gray-400">Total Events</div>
              <div className="text-xs text-yellow-400 mt-1">{pendingEvents.length} pending</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Building2 className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{Array.isArray(businessClaims) ? businessClaims.length : 0}</div>
              <div className="text-sm text-gray-400">Business Claims</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{pendingClaims.length}</div>
              <div className="text-sm text-gray-400">Pending Claims</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="events" className="data-[state=active]:bg-slate-700">Events</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-slate-700">Users</TabsTrigger>
            <TabsTrigger value="scraping" className="data-[state=active]:bg-slate-700">Scraping</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            {pendingEvents.length > 0 && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-yellow-400 flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Pending Events ({pendingEvents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingEvents.map((event: any) => (
                    <div key={event.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-2">{event.title}</h4>
                          <div className="space-y-1 text-sm text-gray-400">
                            <p className="flex items-center"><MapPin className="h-4 w-4 mr-2" />{event.location?.name || "No location"}</p>
                            <p className="flex items-center"><Calendar className="h-4 w-4 mr-2" />{new Date(event.startDateTime).toLocaleString()}</p>
                          </div>
                          <Badge className="mt-2 bg-yellow-600">pending</Badge>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <Button size="sm" onClick={() => updateEventMutation.mutate({ eventId: event.id, approvalStatus: "approved" })} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateEventMutation.mutate({ eventId: event.id, approvalStatus: "rejected" })}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(approvedEvents.length > 0 || rejectedEvents.length > 0) && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Processed Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...approvedEvents, ...rejectedEvents].map((event: any) => (
                    <div key={event.id} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{event.title}</h4>
                          <p className="text-sm text-gray-400">{event.location?.name} • {new Date(event.startDateTime).toLocaleDateString()}</p>
                        </div>
                        <Badge className={event.approvalStatus === 'approved' ? 'bg-green-600' : 'bg-red-600'}>
                          {event.approvalStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
              <CardContent>
                {Array.isArray(allUsers) && allUsers.length > 0 ? (
                  <div className="space-y-3">
                    {allUsers.map((user: any) => (
                      <div key={user.id} className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</h4>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                        <Badge variant="secondary">{user.userType || "regular"}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No users found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scraping" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Web Scraping - Popular Times
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    <strong>⚠️ Atenção:</strong> Este processo busca horários de pico reais do Google Maps para os lugares cadastrados no Firestore.
                  </p>
                </div>
                <Button onClick={() => { setIsScraping(true); scrapeMutation.mutate(); }} disabled={isScraping} className="w-full" size="lg">
                  {isScraping ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Executando...</> : <><MapPin className="h-4 w-4 mr-2" /> Iniciar Scraping</>}
                </Button>
                {scrapingResults && (
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="bg-slate-700 border-slate-600"><CardContent className="pt-4"><p className="text-sm text-gray-400">Total</p><p className="text-2xl font-bold">{scrapingResults.total}</p></CardContent></Card>
                      <Card className="bg-green-900/20 border-green-800"><CardContent className="pt-4"><p className="text-sm text-green-300">Sucesso</p><p className="text-2xl font-bold text-green-400">{scrapingResults.success}</p></CardContent></Card>
                      <Card className="bg-red-900/20 border-red-800"><CardContent className="pt-4"><p className="text-sm text-red-300">Erros</p><p className="text-2xl font-bold text-red-400">{scrapingResults.errors}</p></CardContent></Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation currentPage="/admin" />
    </div>
  );
}