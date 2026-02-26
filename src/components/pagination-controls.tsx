"use client";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ page, pageSize, totalItems, onPageChange }: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="m-0 text-xs text-[var(--muted)]">
        แสดง {from}-{to} จากทั้งหมด {totalItems} รายการ
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="secondary px-3 py-1 text-xs"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          ก่อนหน้า
        </button>
        <span className="text-xs text-[var(--muted)]">
          หน้า {safePage}/{totalPages}
        </span>
        <button
          type="button"
          className="secondary px-3 py-1 text-xs"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
