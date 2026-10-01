"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Password validation
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);

    try {
      // register() internally calls apiPost("/auth/register") and stores token + user in localStorage
      await register(name, email, password, role);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registrasi gagal. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <Logo variant="dark" size={56} />
          <p className="text-muted mt-3">Sales Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            Buat Akun Baru
          </h2>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="Nama lengkap Anda"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="nama@perusahaan.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="Minimal 6 karakter"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                placeholder="Ulangi password"
              />
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Peran (Role)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
              >
                <option value="sales_rep">Sales Rep</option>
                <option value="presales">Presales</option>
                <option value="sales_manager">Sales Manager</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white rounded-lg py-2.5 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Memuat..." : "Register"}
            </button>
          </form>

          {/* Link back to login */}
          <p className="text-center text-sm text-muted mt-6">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
