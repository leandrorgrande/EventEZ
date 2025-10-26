import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Map from "@/pages/Map";
import MapaCalor from "@/pages/MapaCalor";
import Events from "@/pages/Events";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import Admin from "@/pages/Admin";
import SantosPlaces from "@/pages/SantosPlaces";
import AdminPopularTimes from "@/pages/AdminPopularTimes";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
            <>
              <Route path="/" component={MapaCalor} />
              <Route path="/map" component={Map} />
              <Route path="/places" component={SantosPlaces} />
              <Route path="/events" component={Events} />
                <Route path="/profile" component={Profile} />
                <Route path="/messages" component={Messages} />
                <Route path="/admin" component={Admin} />
                <Route path="/admin/popular-times" component={AdminPopularTimes} />
            </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
