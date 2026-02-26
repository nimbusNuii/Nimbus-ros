import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <section className="card" style={{ maxWidth: 540, margin: "30px auto" }}>

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
