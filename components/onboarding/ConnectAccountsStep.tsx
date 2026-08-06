"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CONNECT_PLATFORMS } from "@/lib/zernio/platforms";

type ZernioAccount = {
  accountId: string;
  platform: string;
  username: string;
};

type ConnectAccountsStepProps = {
  companyId: string;
  companyName: string;
  compact?: boolean;
  activePlatforms?: string[];
  enabled?: boolean;
  onAccountsUpdated?: () => void;
  onSectionConfirmed?: () => void | Promise<void>;
};

const OAUTH_POLL_INTERVAL_MS = 3000;
const OAUTH_POLL_MAX_MS = 60_000;

function toAccountLookup(accounts: ZernioAccount[]): Record<string, ZernioAccount> {
  const lookup: Record<string, ZernioAccount> = {};

  for (const account of accounts) {
    const key = account.platform === "twitter" ? "x" : account.platform;
    lookup[key] = account;
  }

  return lookup;
}

function accountsSignature(accounts: ZernioAccount[]): string {
  return accounts
    .map((account) => `${account.platform}:${account.accountId}`)
    .sort()
    .join("|");
}

export function ConnectAccountsStep({
  companyId,
  companyName,
  compact = false,
  activePlatforms,
  enabled = true,
  onAccountsUpdated,
  onSectionConfirmed,
}: ConnectAccountsStepProps) {
  const [accounts, setAccounts] = useState<ZernioAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(
    null
  );
  const [waitingPlatform, setWaitingPlatform] = useState<string | null>(null);

  const onAccountsUpdatedRef = useRef(onAccountsUpdated);
  onAccountsUpdatedRef.current = onAccountsUpdated;

  const onSectionConfirmedRef = useRef(onSectionConfirmed);
  onSectionConfirmedRef.current = onSectionConfirmed;

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  const accountLookup = useMemo(() => toAccountLookup(accounts), [accounts]);

  const fetchAccounts = useCallback(
    async (options?: { notifyParent?: boolean; forceNotifyParent?: boolean }) => {
      if (!enabled) {
        return;
      }

      console.log(
        `[ConnectAccountsStep] fetch /api/admin/zernio/accounts companyId=${companyId}`
      );

      setLoading(true);
      setFetchError(null);

      try {
        const response = await fetch(
          `/api/admin/zernio/accounts?companyId=${companyId}`
        );
        const payload = (await response.json()) as {
          data: { accounts: ZernioAccount[] } | null;
          error: string | null;
        };

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Failed to load connected accounts.");
        }

        const nextAccounts = payload.data?.accounts ?? [];
        const accountsChanged =
          accountsSignature(accountsRef.current) !==
          accountsSignature(nextAccounts);

        setAccounts((previous) => {
          if (accountsSignature(previous) === accountsSignature(nextAccounts)) {
            return previous;
          }
          return nextAccounts;
        });

        if (
          options?.forceNotifyParent ||
          (options?.notifyParent && accountsChanged)
        ) {
          onAccountsUpdatedRef.current?.();
          if (accountsChanged && nextAccounts.length > 0) {
            void onSectionConfirmedRef.current?.();
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load accounts.";
        setFetchError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [companyId, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetchAccounts();
  }, [companyId, enabled, fetchAccounts]);

  useEffect(() => {
    if (!waitingPlatform || !enabled) {
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      if (Date.now() - startedAt >= OAUTH_POLL_MAX_MS) {
        window.clearInterval(intervalId);
        return;
      }

      void fetchAccounts({ notifyParent: true });
    }, OAUTH_POLL_INTERVAL_MS);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, OAUTH_POLL_MAX_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [waitingPlatform, enabled, fetchAccounts]);

  const visiblePlatforms = useMemo(() => {
    if (!activePlatforms?.length) {
      return [];
    }

    const normalized = new Set(
      activePlatforms.map((platform) => platform.trim().toLowerCase())
    );

    return CONNECT_PLATFORMS.filter((platform) =>
      normalized.has(platform.label.toLowerCase())
    );
  }, [activePlatforms]);

  async function handleConnect(connectPlatform: string) {
    setConnectingPlatform(connectPlatform);
    try {
      const response = await fetch("/api/admin/zernio/connect-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          platform: connectPlatform,
        }),
      });

      const payload = (await response.json()) as {
        data: { authUrl: string } | null;
        error: string | null;
      };

      if (!response.ok || payload.error || !payload.data?.authUrl) {
        throw new Error(payload.error ?? "Failed to start connect flow.");
      }

      window.open(payload.data.authUrl, "_blank", "noopener,noreferrer");
      setWaitingPlatform(connectPlatform);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect account.";
      toast.error(message);
    } finally {
      setConnectingPlatform(null);
    }
  }

  function handleManualRefresh() {
    void fetchAccounts({ forceNotifyParent: true });
  }

  const content = (
    <div className="space-y-4">
      {fetchError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {fetchError}
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {visiblePlatforms.map((platform) => {
        const connected = accountLookup[platform.accountKey];
        const isConnecting = connectingPlatform === platform.connectPlatform;

        return (
          <div
            key={platform.connectPlatform}
            className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2a2a2a] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="font-medium text-text-primary">{platform.label}</div>
            <div className="flex flex-wrap items-center gap-3">
              {connected ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  Connected as @{connected.username || "account"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-text-muted">
                  Not connected
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isConnecting}
                onClick={() => handleConnect(platform.connectPlatform)}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {connected ? "Reconnect" : "Connect"}
              </Button>
            </div>
          </div>
        );
      })}

      {waitingPlatform ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Waiting for connection in the other tab. Status checks run for up to
          60 seconds, or click Check Status to refresh now.
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Status
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Platforms not connected here can be connected later from the
          client&apos;s Brand Config settings. However, automated posting will
          be paused for any unconnected platform. Approved content will wait
          until the account is connected.
        </p>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading connected accounts...
          </div>
        ) : (
          content
        )}
      </div>
    );
  }

  if (!enabled) {
    return null;
  }

  return (
    <Card className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-sm">
      <CardHeader className="border-b border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]/80">
        <CardTitle className="text-xl text-[#111111] dark:text-white">Connect Social Accounts</CardTitle>
        <CardDescription className="mt-1">
          Link social accounts for automated publishing. You can skip this step
          and connect later.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading connected accounts...
          </div>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
}
