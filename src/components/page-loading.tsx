type PageLoadingProps = {
  message?: string;
};

export function PageLoading({ message = "กำลังโหลดข้อมูล..." }: PageLoadingProps) {
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="route-loading-topbar">
        <span className="route-loading-topbar-indicator" />
      </div>
      <div className="grid h-full place-items-center bg-[rgba(246,247,249,0.74)] backdrop-blur-[2px]">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-sm">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--brand)]" />
          <span className="text-sm font-medium text-[var(--muted)]">{message}</span>
        </div>
      </div>
    </div>
  );
}
