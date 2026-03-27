import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const AZURE_DEVOPS_SCOPE = "https://app.vssps.visualstudio.com/.default";

type TokenShape = {
  accessToken?: string;
  accessTokenExpires?: number;
  error?: "RefreshAccessTokenError";
  refreshToken?: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getTenantId() {
  return readEnv("AZURE_AD_TENANT_ID") || "common";
}

export function hasMicrosoftEntraConfig() {
  return Boolean(
    readEnv("AZURE_AD_TENANT_ID") &&
      readEnv("AZURE_AD_CLIENT_ID") &&
      readEnv("AZURE_AD_CLIENT_SECRET") &&
      readEnv("NEXTAUTH_SECRET"),
  );
}

async function refreshAccessToken(token: TokenShape): Promise<TokenShape> {
  if (!token.refreshToken) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }

  const tenantId = getTenantId();
  const body = new URLSearchParams({
    client_id: readEnv("AZURE_AD_CLIENT_ID"),
    client_secret: readEnv("AZURE_AD_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
    scope: `openid profile email offline_access ${AZURE_DEVOPS_SCOPE}`,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  const refreshed = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };

  if (!response.ok || !refreshed.access_token || !refreshed.expires_in) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }

  return {
    accessToken: refreshed.access_token,
    accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
    refreshToken: refreshed.refresh_token ?? token.refreshToken,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: readEnv("AZURE_AD_CLIENT_ID"),
      clientSecret: readEnv("AZURE_AD_CLIENT_SECRET"),
      tenantId: getTenantId(),
      authorization: {
        params: {
          scope: `openid profile email offline_access ${AZURE_DEVOPS_SCOPE}`,
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name:
            (typeof profile.name === "string" && profile.name) ||
            (typeof profile.preferred_username === "string" &&
              profile.preferred_username) ||
            null,
          email:
            (typeof profile.email === "string" && profile.email) ||
            (typeof profile.preferred_username === "string" &&
              profile.preferred_username) ||
            null,
          image: null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 60 * 60 * 1000,
          refreshToken: account.refresh_token,
        };
      }

      if (
        typeof token.accessTokenExpires === "number" &&
        Date.now() < token.accessTokenExpires
      ) {
        return token;
      }

      if (!hasMicrosoftEntraConfig()) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken =
        typeof token.accessToken === "string" ? token.accessToken : undefined;
      session.error = token.error;

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
