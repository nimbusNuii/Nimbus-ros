import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getServerSession, roleRedirectPath } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, params] = await Promise.all([getServerSession(), searchParams]);

  if (session) {
    redirect(roleRedirectPath(session.role));
  }

  return <LoginForm nextPath={params.next} />;
}
