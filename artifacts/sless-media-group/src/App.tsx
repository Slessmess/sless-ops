import { type ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/queryClient';
import { Shell } from '@/components/shell';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Dashboard from '@/pages/dashboard';
import RestaurantPage from '@/pages/restaurant';
import Assets from '@/pages/assets';
import ContentPage from '@/pages/content';
import CalendarPage from '@/pages/calendar';
import Links from '@/pages/links';
import Plans from '@/pages/plans';
import Admin from '@/pages/admin';
import Operations from '@/pages/operations';

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#c8421f', colorForeground: '#2b1d17', colorMutedForeground: '#665850', colorDanger: '#a82020',
    colorBackground: '#fbf6ea', colorInput: '#fffdf6', colorInputForeground: '#2b1d17', colorNeutral: '#2b1d17',
    fontFamily: "'DM Sans', sans-serif", borderRadius: '0.375rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf6ea] border border-[#2b1d17]/20 rounded-md w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: { fontFamily: "'Fraunces', serif", color: '#2b1d17', fontSize: '1.75rem' },
    headerSubtitle: { color: '#665850' },
    socialButtonsBlockButtonText: { color: '#2b1d17' },
    formFieldLabel: { color: '#2b1d17' },
    footerActionLink: { color: '#c8421f' },
    footerActionText: { color: '#665850' },
    dividerText: { color: '#665850' },
    identityPreviewEditButton: { color: '#c8421f' },
    formFieldSuccessText: { color: '#1f5a3d' },
    alertText: { color: '#a82020' },
    logoImage: { height: '2.5rem' },
    formButtonPrimary: { backgroundColor: '#c8421f', color: '#fff' },
  },
};

function Frame({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">{children}</div>;
}
const SignInPage = () => <Frame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></Frame>;
const SignUpPage = () => <Frame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></Frame>;

function HomeRedirect() {
  return (<><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>);
}
function Private({ children }: { children: ReactNode }) {
  return (<><Show when="signed-in"><Shell>{children}</Shell></Show><Show when="signed-out"><Redirect to="/" /></Show></>);
}
const priv = (C: () => ReactNode) => () => <Private><C /></Private>;

function CacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (prev.current !== undefined && prev.current !== id) qc.clear();
    prev.current = id;
  }), [addListener, qc]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [loc, setLocation] = useLocation();
  return (
    <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
      localization={{ signIn: { start: { title: 'Back to the pass', subtitle: 'Sign in to your Sless Media Group workspace' } }, signUp: { start: { title: 'Open your workspace', subtitle: 'Launch preview. No payment, no auto-posting.' } } }}
      routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
      <QueryClientProvider client={queryClient}>
        <CacheInvalidator />
        <ErrorBoundary resetKey={loc}>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard" component={priv(Dashboard)} />
            <Route path="/restaurant" component={priv(RestaurantPage)} />
            <Route path="/assets" component={priv(Assets)} />
            <Route path="/content" component={priv(ContentPage)} />
            <Route path="/calendar" component={priv(CalendarPage)} />
            <Route path="/links" component={priv(Links)} />
            <Route path="/plans" component={priv(Plans)} />
            <Route path="/admin" component={priv(Admin)} />
            <Route path="/operations" component={priv(Operations)} />
            <Route component={NotFound} />
          </Switch>
        </ErrorBoundary>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}
export default App;
