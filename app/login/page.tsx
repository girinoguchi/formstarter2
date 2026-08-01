import { Suspense } from "react";

import { LoginForm } from "../../src/ui/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full w-full flex-1 items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
