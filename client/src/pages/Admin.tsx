import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Users, MapPin, Calendar, TrendingUp } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();

  // Fetch admin data
  const { data: locations } = useQuery({
    queryKey: ["/api/locations", { verified: false }],
    enabled: user?.userType === "admin",
  });

  const { data: events } = useQuery({
    queryKey: ["/api/events"],
    enabled: user?.userType === "admin",
  });

  const { data: recentCheckins } = useQuery({
    queryKey: ["/api/checkins/recent"],
    enabled: user?.userType === "admin",
  });

  // Redirect if not admin
  if (!user || user.userType !== "admin") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 p-6 text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2" data-testid="text-access-denied">Access Denied</h2>
          <p className="text-gray-400">Admin privileges required</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-4">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
            <p className="text-gray-400">Event-U Management Dashboard</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-total-events">
                {events?.length || 0}
              </div>
              <div className="text-sm text-gray-400">Total Events</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <MapPin className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-pending-locations">
                {locations?.length || 0}
              </div>
              <div className="text-sm text-gray-400">Pending Locations</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-active-users">
                {recentCheckins?.length || 0}
              </div>
              <div className="text-sm text-gray-400">Active Users</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 text-orange-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-checkins-today">
                {recentCheckins?.filter(c => 
                  new Date(c.createdAt!).toDateString() === new Date().toDateString()
                ).length || 0}
              </div>
              <div className="text-sm text-gray-400">Check-ins Today</div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="locations" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="locations" data-testid="tab-locations">Locations</TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Pending Business Locations</CardTitle>
                <CardDescription>Locations awaiting verification</CardDescription>
              </CardHeader>
              <CardContent>
                {locations && locations.length > 0 ? (
                  <div className="space-y-4">
                    {locations.map((location: any) => (
                      <div key={location.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-white" data-testid={`text-location-name-${location.id}`}>
                            {location.name}
                          </h4>
                          <p className="text-sm text-gray-400">{location.address}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" data-testid={`button-approve-${location.id}`}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" data-testid={`button-reject-${location.id}`}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8" data-testid="text-no-pending-locations">
                    No pending locations
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Events</CardTitle>
                <CardDescription>All events in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {events && events.length > 0 ? (
                  <div className="space-y-4">
                    {events.slice(0, 10).map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-white" data-testid={`text-event-name-${event.id}`}>
                            {event.title}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {new Date(event.startDateTime).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">{event.eventType}</Badge>
                          <Badge variant={event.isActive ? "default" : "secondary"}>
                            {event.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8" data-testid="text-no-events">
                    No events found
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription>User check-ins and activity</CardDescription>
              </CardHeader>
              <CardContent>
                {recentCheckins && recentCheckins.length > 0 ? (
                  <div className="space-y-3">
                    {recentCheckins.slice(0, 15).map((checkin: any) => (
                      <div key={checkin.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <p className="text-sm text-white">
                            {checkin.isAnonymous ? "Anonymous user" : "User"} checked in
                          </p>
                          <p className="text-xs text-gray-400">
                            {checkin.latitude}, {checkin.longitude}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(checkin.createdAt!).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8" data-testid="text-no-activity">
                    No recent activity
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="admin" />
    </div>
  );
}
