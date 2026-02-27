type PageLoadingProps = {
  message?: string;
};

export function PageLoading({ message = "กำลังโหลดข้อมูล..." }: PageLoadingProps) {
  return (
    <div className="min-h-[calc(100dvh-96px)] w-full px-4 py-8">
      <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--brand)]" />
          <span className="text-sm font-medium text-[var(--muted)]">{message}</span>
        </div>
      </div>
    </div>
  );
}
