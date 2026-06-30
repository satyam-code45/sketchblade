import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function ResetPassword() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
