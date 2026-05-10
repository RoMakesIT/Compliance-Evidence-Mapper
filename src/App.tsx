import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { ActiveCompanyProvider } from "@/lib/active-company";
import { RequireAuth } from "@/components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Controls from "./pages/Controls";
import EvidencePage from "./pages/Evidence";
import Review from "./pages/Review";
import Recommendations from "./pages/Recommendations";
import Crosswalk from "./pages/Crosswalk";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const protectedRoute = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ActiveCompanyProvider>
        <StoreProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/" element={protectedRoute(<Dashboard />)} />
              <Route path="/companies" element={protectedRoute(<Companies />)} />
              <Route path="/controls" element={protectedRoute(<Controls />)} />
              <Route path="/evidence" element={protectedRoute(<EvidencePage />)} />
              <Route path="/review" element={protectedRoute(<Review />)} />
              <Route path="/recommendations" element={protectedRoute(<Recommendations />)} />
              <Route path="/crosswalk" element={protectedRoute(<Crosswalk />)} />
              <Route path="/settings" element={protectedRoute(<Settings />)} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </StoreProvider>
      </ActiveCompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
