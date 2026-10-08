"use client";

import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authCliente = createAuthClient({
  plugins: [usernameClient(), twoFactorClient()],
});
