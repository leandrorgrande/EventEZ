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
  Clock,
  UserCheck
} from "lucide-react";

export default function Admin() {
  const { userProfile, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scrapingResults, setScrapingResults] = useState<any>(null);
  const [isScraping, setIsScraping] = useState(false);

  // Fetch business claims
  const { data: businessClaims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ["/api/business-claims"],
    enabled: !!isAdmin, // Only fetch if admin
  });

  // Fetch all users
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!isAdmin, // Only fetch if admin
  });

  // Fetch all events (without approvalStatus filter to get ALL events for admin)
  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events-all"],
    queryFn: async () => {
      console.log('[Admin] Buscando eventos...');
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      console.log('[Admin] Token disponível:', !!token);
      console.log('[Admin] URL:', `${API_URL}/events?approvalStatus=all`);
      
      const response = await fetch(`${API_URL}/events?approvalStatus=all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('[Admin] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Admin] Erro ao buscar eventos:', errorText);
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Admin] Eventos retornados:', data.length);
      return data;
    },
  });

  // Filter events by approval status
  const pendingEvents = (allEvents || []).filter((event: any) => event.approvalStatus === 'pending');
  const approvedEvents = (allEvents || []).filter((event: any) => event.approvalStatus === 'approved');
  const rejectedEvents = (allEvents || []).filter((event: any) => event.approvalStatus === 'rejected');

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

  // Update business claim status
  const updateClaimMutation = useMutation({
    mutationFn: async ({ claimId, status }: { claimId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/business-claims/${claimId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Claim Updated",
        description: "Business claim status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business-claims"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to update business claim status.",
        variant: "destructive",
      });
    },
  });

  // Update event approval status
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
      
      if (!response.ok) {
        throw new Error('Failed to update event');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event Updated",
        description: "Event status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update event status.",
        variant: "destructive",
      });
    },
  });

  // Mutation para executar scraping
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
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to scrape: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setScrapingResults(data);
      toast({
        title: "Scraping concluído",
        description: `${data.success} lugares atualizados, ${data.errors} erros`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no scraping",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsScraping(false);
    }
  });

  const handleStartScraping = () => {
    setIsScraping(true);
    setScrapingResults(null);
    scrapeMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-600";
      case "rejected": return "bg-red-600";
      case "pending": return "bg-yellow-600";
      default: return "bg-gray-600";
    }
  };

  const pendingClaims = businessClaims.filter((claim: any) => claim.status === "pending");
  const approvedClaims = businessClaims.filter((claim: any) => claim.status === "approved");
  const rejectedClaims = businessClaims.filter((claim: any) => claim.status === "rejected");

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-admin-title">
              Admin Dashboard
            </h1>
            <p className="text-gray-400">Manage users, events, and business claims</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-total-users">
                {allUsers.length}
              </div>
              <div className="text-sm text-gray-400">Total Users</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-total-events">
                {allEvents.length}
              </div>
              <div className="text-sm text-gray-400">Total Events</div>
              <div className="text-xs text-yellow-400 mt-1">
                {pendingEvents.length} pending
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Building2 className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-total-claims">
                {businessClaims.length}
              </div>
              <div className="text-sm text-gray-400">Business Claims</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-pending-claims">
                {pendingClaims.length}
              </div>
              <div className="text-sm text-gray-400">Pending Claims</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="claims" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="claims" className="data-[state=active]:bg-slate-700">
              Business Claims
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-slate-700">
              Users
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-slate-700">
              Events
            </TabsTrigger>
            <TabsTrigger value="scraping" className="data-[state=active]:bg-slate-700">
              Scraping
            </TabsTrigger>
          </TabsList>

          {/* Business Claims Tab */}
          <TabsContent value="claims" className="space-y-4">
            {claimsLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading business claims...</div>
              </div>
            ) : businessClaims.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No business claims yet</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Pending Claims */}
                {pendingClaims.length > 0 && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-yellow-400 flex items-center">
                        <Clock className="h-5 w-5 mr-2" />
                        Pending Claims ({pendingClaims.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pendingClaims.map((claim: any) => (
                        <div
                          key={claim.id}
                          className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-white mb-2">
                                {claim.location?.name || "Unknown Location"}
                              </h4>
                              <div className="space-y-1 text-sm text-gray-400">
                                <p className="flex items-center">
                                  <MapPin className="h-4 w-4 mr-2" />
                                  {claim.location?.address || "No address"}
                                </p>
                                <p className="flex items-center">
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  {claim.contactName} - {claim.contactPhone}
                                </p>
                              </div>
                              <Badge className={`mt-2 ${getStatusColor(claim.status)}`}>
                                {claim.status}
                              </Badge>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => updateClaimMutation.mutate({ 
                                  claimId: claim.id, 
                                  status: "approved" 
                                })}
                                disabled={updateClaimMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                                data-testid={`button-approve-${claim.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateClaimMutation.mutate({ 
                                  claimId: claim.id, 
                                  status: "rejected" 
                                })}
                                disabled={updateClaimMutation.isPending}
                                data-testid={`button-reject-${claim.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Approved/Rejected Claims */}
                {(approvedClaims.length > 0 || rejectedClaims.length > 0) && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Processed Claims</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[...approvedClaims, ...rejectedClaims].map((claim: any) => (
                        <div
                          key={claim.id}
                          className="p-3 bg-slate-700/30 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">
                                {claim.location?.name || "Unknown Location"}
                              </h4>
                              <p className="text-sm text-gray-400">
                                {claim.contactName} - {claim.contactPhone}
                              </p>
                            </div>
                            <Badge className={getStatusColor(claim.status)}>
                              {claim.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">All Users</CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-400">Loading users...</div>
                  </div>
                ) : allUsers.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No users found</p>
                ) : (
                  <div className="space-y-3">
                    {allUsers.map((user: any) => (
                      <div
                        key={user.id}
                        className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <h4 className="font-medium text-white">
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.email}
                          </h4>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                        <Badge variant="secondary">
                          {user.userType || "regular"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            {eventsLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading events...</div>
              </div>
            ) : allEvents.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No events yet</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Pending Events */}
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
                        <div
                          key={event.id}
                          className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-white mb-2">{event.title}</h4>
                              <div className="space-y-1 text-sm text-gray-400">
                                <p className="flex items-center">
                                  <MapPin className="h-4 w-4 mr-2" />
                                  {event.location?.name || event.location?.address || "No location"}
                                </p>
                                <p className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  {new Date(event.startDateTime).toLocaleString()}
                                </p>
                              </div>
                              {event.description && (
                                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className="bg-yellow-600">pending</Badge>
                                <Badge variant="outline" className="text-xs">
                                  {event.eventType}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-col space-y-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => updateEventMutation.mutate({ 
                                  eventId: event.id, 
                                  approvalStatus: "approved" 
                                })}
                                disabled={updateEventMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateEventMutation.mutate({ 
                                  eventId: event.id, 
                                  approvalStatus: "rejected" 
                                })}
                                disabled={updateEventMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Processed Events */}
                {(approvedEvents.length > 0 || rejectedEvents.length > 0) && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Processed Events</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[...approvedEvents, ...rejectedEvents].map((event: any) => (
                        <div
                          key={event.id}
                          className="p-3 bg-slate-700/30 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-white">{event.title}</h4>
                              <p className="text-sm text-gray-400">
                                {event.location?.name || "Unknown Location"} • {new Date(event.startDateTime).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {event.approvalStatus === 'approved' ? (
                                <Badge className="bg-green-600">approved</Badge>
                              ) : (
                                <Badge className="bg-red-600">rejected</Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {event.eventType}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* New Scraping Tab */}
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
                    <strong>⚠️ Atenção:</strong> Este processo busca horários de pico reais do Google Maps 
                    para os lugares cadastrados no Firestore. Pode levar alguns minutos.
                  </p>
                </div>

                <Button
                  onClick={handleStartScraping}
                  disabled={isScraping}
                  className="w-full"
                  size="lg"
                >
                  {isScraping ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Executando Scraping...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Iniciar Scraping
                    </>
                  )}
                </Button>

                {scrapingResults && (
                  <div className="mt-6 space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="bg-slate-700 border-slate-600">
                        <CardContent className="pt-4">
                          <p className="text-sm text-gray-400">Total</p>
                          <p className="text-2xl font-bold">{scrapingResults.total}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-900/20 border-green-800">
                        <CardContent className="pt-4">
                          <p className="text-sm text-green-300">Sucesso</p>
                          <p className="text-2xl font-bold text-green-400">{scrapingResults.success}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-red-900/20 border-red-800">
                        <CardContent className="pt-4">
                          <p className="text-sm text-red-300">Erros</p>
                          <p className="text-2xl font-bold text-red-400">{scrapingResults.errors}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Results */}
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Resultados Detalhados</h3>
                      {scrapingResults.results && scrapingResults.results.map((result: any, index: number) => (
                        <Card key={index} className={`bg-slate-700 border ${
                          result.status === 'success' ? 'border-green-600' : 
                          result.status === 'error' ? 'border-red-600' : 
                          'border-yellow-600'
                        }`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold">{result.placeName}</h4>
                              <Badge variant={
                                result.status === 'success' ? 'default' : 
                                result.status === 'error' ? 'destructive' : 
                                'secondary'
                              }>
                                {result.status}
                              </Badge>
                            </div>
                            
                            {/* Logs */}
                            {result.logs && result.logs.length > 0 && (
                              <div className="bg-slate-800 rounded p-3 mt-2 space-y-1">
                                {result.logs.map((log: string, logIndex: number) => (
                                  <p key={logIndex} className="text-xs font-mono text-gray-300">
                                    {log}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Error */}
                            {result.error && (
                              <p className="text-xs text-red-400 mt-2">
                                ❌ {result.error}
                              </p>
                            )}

                            {/* Data Sample */}
                            {result.data && result.data.sample && (
                              <div className="mt-3 p-2 bg-slate-600 rounded">
                                <p className="text-xs text-gray-300 mb-1">📊 Amostra dos dados:</p>
                                <p className="text-xs font-mono text-blue-300">
                                  Segunda: [{result.data.sample.monday.join(', ')}...]
                                </p>
                                <p className="text-xs font-mono text-blue-300">
                                  Sexta: [{result.data.sample.friday.join(', ')}...]
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
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