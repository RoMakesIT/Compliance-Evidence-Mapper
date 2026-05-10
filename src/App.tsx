import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Controls from "./pages/Controls";
import EvidencePage from "./pages/Evidence";
import Review from "./pages/Review";
import Recommendations from "./pages/Recommendations";
import Crosswalk from "./pages/Crosswalk";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <StoreProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/controls" element={<Controls />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/review" element={<Review />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/crosswalk" element={<Crosswalk />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </StoreProvider>
  </QueryClientProvider>
);

export default App;
