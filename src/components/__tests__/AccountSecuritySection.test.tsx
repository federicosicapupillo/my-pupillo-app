import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const state: { identities: { provider: string }[]; meta: Record<string, unknown> } = {
  identities: [{ provider: "email" }],
  meta: {},
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: { id: "u1", email: "a@b.it", user_metadata: state.meta, identities: state.identities } },
        error: null,
      }),
      getUserIdentities: async () => ({ data: { identities: state.identities }, error: null }),
      updateUser: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      reauthenticate: async () => ({ error: null }),
    },
  },
}));

import { AccountSecuritySection } from "@/components/AccountSecuritySection";

beforeEach(() => { state.identities = [{ provider: "email" }]; state.meta = {}; });

describe("AccountSecuritySection", () => {
  it("account solo Google: niente 'Cambia password', mostra Google e 'Imposta una password'", async () => {
    state.identities = [{ provider: "google" }];
    render(<AccountSecuritySection email="a@b.it" />);
    await waitFor(() => expect(screen.getByText("Imposta una password")).toBeTruthy());
    expect(screen.queryByText("Cambia password")).toBeNull();
    expect(screen.getByText("Google collegato")).toBeTruthy();
    expect(screen.getByText(/Accedi a Pupillo tramite Google/)).toBeTruthy();
    expect(screen.queryByLabelText(/Password attuale/)).toBeNull();
  });

  it("account email/password: mostra 'Cambia password' con password attuale", async () => {
    render(<AccountSecuritySection email="a@b.it" />);
    await waitFor(() => expect(screen.getByText("Cambia password")).toBeTruthy());
    expect(screen.getByLabelText("Password attuale *")).toBeTruthy();
    expect(screen.queryByText("Imposta una password")).toBeNull();
  });

  it("account Google + email: mostra entrambi i metodi e il cambio password", async () => {
    state.identities = [{ provider: "google" }, { provider: "email" }];
    render(<AccountSecuritySection email="a@b.it" />);
    await waitFor(() => expect(screen.getByText("Cambia password")).toBeTruthy());
    expect(screen.getByText("Google collegato")).toBeTruthy();
    expect(screen.getByText(/Email e password/)).toBeTruthy();
  });

  it("due provider social senza password: 'Cambia password' nascosto", async () => {
    state.identities = [{ provider: "google" }, { provider: "apple" }];
    render(<AccountSecuritySection email="a@b.it" />);
    await waitFor(() => expect(screen.getByText("Imposta una password")).toBeTruthy());
    expect(screen.queryByText("Cambia password")).toBeNull();
    expect(screen.getByText("Apple collegato")).toBeTruthy();
    expect(screen.getByText("Google collegato")).toBeTruthy();
  });

  it("password già impostata via metadata su account social: mostra 'Cambia password'", async () => {
    state.identities = [{ provider: "google" }];
    state.meta = { password_set: true };
    render(<AccountSecuritySection email="a@b.it" />);
    await waitFor(() => expect(screen.getByText("Cambia password")).toBeTruthy());
  });
});
