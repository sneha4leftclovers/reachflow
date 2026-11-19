import './globals.css';
import { AuthProvider } from '../context/auth-context';

export const metadata = {
  title: 'ReachFlow | Outbound Sales CRM',
  description: 'Enterprise Multi-Tenant Outbound Sales Engagement & Pipeline CRM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
