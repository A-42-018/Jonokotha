import LoginForm from "@/components/LoginForm";
import { getLang } from "@/lib/i18n";

export default async function Login() {
  return <LoginForm bn={(await getLang()) === "bn"} />;
}
