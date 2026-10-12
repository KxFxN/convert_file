import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  invalid: "Invalid username or password.",
  locked: "Too many failed attempts. Try again in 15 minutes.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;

  return (
    <main className="flex min-h-screen bg-white">
      <div className="relative hidden w-1/2 lg:block">
        <Image src="/bg/Bg.jpg" alt="" fill priority className="object-cover" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-16">
          <Image
            src="/logo/Logo.png"
            alt="Daikin"
            width={700}
            height={152}
            priority
            className="h-auto w-full max-w-[350px]"
          />
          <p className="mt-2 text-sm font-medium text-slate-900">
            Daikin Chemical Southeast Asia Co., Ltd.
          </p>
        </div>
        <p className="absolute bottom-6 left-7 text-sm font-medium text-slate-900">
          Power by Allmass idea
        </p>
      </div>

      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-[400px]">
          <Image
            src="/logo/Logo.png"
            alt="Daikin"
            width={700}
            height={152}
            className="mb-10 h-auto w-48 lg:hidden"
          />
          <h1 className="text-3xl font-bold text-black">Sign In</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter your username and password to sign in
          </p>

          {message && (
            <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </p>
          )}

          <form method="post" action="/api/login" className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-slate-800">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                placeholder="Enter Username"
                autoComplete="username"
                required
                className="h-11 rounded-xl border-sky-200 px-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-800">
                Password <span className="text-red-600">*</span>
              </Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="Enter Your Password"
                autoComplete="current-password"
                required
                className="h-11 rounded-xl border-sky-200 px-4"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-xl bg-[#2792d4] text-sm hover:bg-[#1f7fbb]"
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
