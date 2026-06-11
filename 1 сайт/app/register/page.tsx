import type { Metadata } from "next";
import RegisterPageClient from "./RegisterPageClient";

export const metadata: Metadata = {
  title: "Регистрация — IlluCards",
  description: "IlluCards",
};

export default function RegisterPage() {
  return <RegisterPageClient />;
}
