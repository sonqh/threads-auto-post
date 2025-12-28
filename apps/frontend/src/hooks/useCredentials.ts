import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export interface StoredCredential {
  id: string;
  accountName: string;
  threadsUserId: string;
  threadsUserName?: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

export const useCredentials = () => {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/credentials");
      setCredentials(response.data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch credentials";
      setError(message);
      console.error("Error fetching credentials:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  return {
    credentials,
    loading,
    error,
    fetchCredentials,
  };
};
