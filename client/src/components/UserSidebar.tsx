import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Settings, History, Store, LogOut, Calendar, Users, X } from "lucide-react";
import { signOutUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface UserSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserSidebar({ open, onOpenChange }: UserSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast({
        title: "Logout realizado com sucesso!",
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

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-slate-800 border-slate-700 text-white w-80">
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white" data-testid="text-profile-title">Profile</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* User Info */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.profileImageUrl || ""} alt={user.firstName || "User"} />
              <AvatarFallback className="bg-blue-600 text-white">
                {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-white" data-testid="text-sidebar-user-name">
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user.email}
              </h3>
              <p className="text-gray-400 text-sm" data-testid="text-sidebar-user-email">
                {user.email}
              </p>
              <Badge variant="secondary" className="mt-1">
                {user.userType === "business" ? "Business" : "Regular User"}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-slate-700/50 border-slate-600">
              <CardContent className="p-4 text-center">
                <Calendar className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-white" data-testid="text-sidebar-events-created">
                  0
                </div>
                <div className="text-xs text-gray-400">Events Created</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-700/50 border-slate-600">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-white" data-testid="text-sidebar-events-attended">
                  0
                </div>
                <div className="text-xs text-gray-400">Events Attended</div>
              </CardContent>
            </Card>
          </div>

          {/* Menu Options */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-slate-700/50"
              data-testid="button-sidebar-settings"
            >
              <Settings className="mr-3 h-5 w-5 text-gray-400" />
              Settings
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-slate-700/50"
              data-testid="button-sidebar-history"
            >
              <History className="mr-3 h-5 w-5 text-gray-400" />
              Event History
            </Button>

            {user.userType !== "business" && (
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-slate-700/50"
                data-testid="button-sidebar-claim-business"
              >
                <Store className="mr-3 h-5 w-5 text-gray-400" />
                Claim Business
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-400 hover:bg-red-600/20 hover:text-red-300"
              data-testid="button-sidebar-logout"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
