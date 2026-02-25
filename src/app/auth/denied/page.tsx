import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <section className="card" style={{ maxWidth: 540, margin: "30px auto" }}>
      <h1 className="page-title" style={{ marginTop: 0 }}>
        ไม่มีสิทธิ์เข้าถึงหน้านี้
      </h1>
      <p className="page-subtitle">บัญชีปัจจุบันไม่สามารถเข้าหน้านี้ได้ กรุณาเข้าสู่ระบบใหม่ด้วยบัญชีที่มีสิทธิ์เหมาะสม</p>

      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/auth/login" className="nav-link">
          ไปหน้า Login
        </Link>
        <Link href="/" className="nav-link">
          กลับหน้าแรก
        </Link>
      </div>
    </section>
  );
}
