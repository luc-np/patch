/** Portal público: uma coluna calma, base 15–16px — o oposto da densidade do app. */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-[15px] leading-relaxed md:text-[16px]">
      {children}
    </div>
  );
}
