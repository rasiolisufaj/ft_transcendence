import { getLocale } from "next-intl/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type SessionContext } from "@/lib/auth/session";
import AuthLayout from "./layout";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn() }));

const render = () => AuthLayout({ children: "the form", params: Promise.resolve({ locale: "es" }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLocale).mockResolvedValue("es");
});

describe("the (auth) layout", () => {
  it("sends a signed-in user to the dashboard, in their locale", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({} as SessionContext);

    await render();

    expect(redirect).toHaveBeenCalledWith({ href: "/", locale: "es" });
  });

  it("shows the login and signup forms to a visitor", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await render()).toBe("the form");
    expect(redirect).not.toHaveBeenCalled();
  });
});
