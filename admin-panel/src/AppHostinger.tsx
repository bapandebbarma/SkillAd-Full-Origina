import { useState } from "react";
import { Router, Route, Switch } from "wouter";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Providers from "./pages/Providers";
import Users from "./pages/Users";
import Categories from "./pages/Categories";
import Subscriptions from "./pages/Subscriptions";
import Advertisements from "./pages/Advertisements";
import Notifications from "./pages/Notifications";
import Content from "./pages/Content";
import Analytics from "./pages/Analytics";
import Rankings from "./pages/Rankings";
import Settings from "./pages/Settings";
import OtpLogs from "./pages/OtpLogs";
import Translations from "./pages/Translations";
import DeletionRequests from "./pages/DeletionRequests";
import ContactMessages from "./pages/ContactMessages";
import AppReviews from "./pages/AppReviews";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router base="/admin">
      <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
        <div className="hidden lg:flex lg:shrink-0">
          <Sidebar />
        </div>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="relative z-10">
              <Sidebar mobile onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-400 hover:text-white p-1"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-sm">
                🎯
              </div>
              <span className="text-sm font-bold text-white">SkillAd Admin</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/providers" component={Providers} />
              <Route path="/users" component={Users} />
              <Route path="/deletion-requests" component={DeletionRequests} />
              <Route path="/categories" component={Categories} />
              <Route path="/subscriptions" component={Subscriptions} />
              <Route path="/advertisements" component={Advertisements} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/content" component={Content} />
              <Route path="/app-reviews" component={AppReviews} />
              <Route path="/contact-messages" component={ContactMessages} />
              <Route path="/rankings" component={Rankings} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/translations" component={Translations} />
              <Route path="/otp-logs" component={OtpLogs} />
              <Route path="/settings" component={Settings} />
            </Switch>
          </div>
        </div>
      </div>
    </Router>
  );
}
