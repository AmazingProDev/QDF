import type { Metadata } from "next";
import "./globals.css";
import "./multiselect.css";
import "./qualification-tables.css";
export const metadata: Metadata = { title: "Network Action Effectiveness Analyzer", description: "TRD / IEA Before vs After KPI Qualification" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }
