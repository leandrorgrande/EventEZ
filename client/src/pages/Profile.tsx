import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Settings, History, Store, LogOut, Calendar, Users } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  const { data: userEvents } = useQuery({
    queryKey: ["/api/users", user?.id, "events"],
    enabled: !!user?.id,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (!user) {
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
            <AvatarImage src={user.profileImageUrl || ""} alt={user.firstName || "User"} />
            <AvatarFallback className="bg-blue-600 text-white text-lg">
              {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-user-name">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user.email}
            </h1>
            <p className="text-gray-400" data-testid="text-user-email">{user.email}</p>
            <Badge variant="secondary" className="mt-1">
              {user.userType === "business" ? "Business" : "Regular User"}
            </Badge>
          </div>
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
                {userEvents.slice(0, 3).map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-white" data-testid={`text-event-title-${event.id}`}>
                        {event.title}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {new Date(event.startDateTime).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {event.eventType}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4" data-testid="text-no-events">
                You haven't created any events yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Menu Options */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-slate-700/50"
            data-testid="button-settings"
          >
            <Settings className="mr-3 h-5 w-5 text-gray-400" />
            Settings
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-slate-700/50"
            data-testid="button-history"
          >
            <History className="mr-3 h-5 w-5 text-gray-400" />
            Event History
          </Button>

          {user.userType !== "business" && (
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-slate-700/50"
              data-testid="button-claim-business"
            >
              <Store className="mr-3 h-5 w-5 text-gray-400" />
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
    </div>
  );
}
