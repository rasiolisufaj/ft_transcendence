// <html> and <body> live in [locale]/layout.tsx so they can carry lang={locale}.
// This pass-through only exists because Next requires a layout at the app root.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
