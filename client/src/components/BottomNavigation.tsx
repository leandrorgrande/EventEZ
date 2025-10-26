import { Button } from "@/components/ui/button";
import { Map, Calendar, MessageCircle, User, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter"; // EVENTU: Added client-side routing

interface BottomNavigationProps {
  currentPage: string;
  onNavigate?: (page: string) => void;
}

export default function BottomNavigation({ currentPage, onNavigate }: BottomNavigationProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation(); // EVENTU: Added client-side routing

  const handleNavigation = (page: string, href?: string) => {
    if (href) {
      setLocation(href); // EVENTU: Changed from window.location.href to client-side navigation
    } else if (onNavigate) {
      onNavigate(page);
    }
  };

  const navItems = [
    {
      id: "map",
      label: "Map",
      icon: Map,
      href: "/",
    },
    {
      id: "events",
      label: "Events",
      icon: Calendar,
      href: "/events",
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessageCircle,
      href: "/messages",
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      href: "/profile",
    },
  ];

  // EVENTU: Add admin tab if user is admin or support email
  if (user && ((user as any).userType === "admin" || (user as any).email === import.meta.env.VITE_SUPPORT_EMAIL)) {
    navItems.push({
      id: "admin",
      label: "Admin",
      icon: Shield,
      href: "/admin",
    });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800/95 backdrop-blur-md border-t border-slate-700 shadow-lg">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation(item.id, item.href)}
              className={`nav-item flex-col h-auto py-2 px-3 ${
                isActive 
                  ? "text-blue-400" 
                  : "text-gray-400 hover:text-white"
              }`}
              data-testid={`nav-${item.id}`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
