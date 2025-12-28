import React from "react";
import { Button } from "./ui/button";
import type { StoredCredential } from "../hooks/useCredentials";

interface AccountSelectorProps {
  credentials: StoredCredential[];
  selectedAccountId?: string | string[];
  onSelect: (accountId: string | string[]) => void;
  multiSelect?: boolean;
  className?: string;
  disabled?: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  credentials,
  selectedAccountId,
  onSelect,
  multiSelect = false,
  className = "",
  disabled = false,
}) => {
  const isSelected = (id: string) => {
    if (Array.isArray(selectedAccountId)) {
      return selectedAccountId.includes(id);
    }
    return selectedAccountId === id;
  };

  const handleSelect = (id: string) => {
    if (multiSelect) {
      const selected = Array.isArray(selectedAccountId)
        ? selectedAccountId
        : [];
      if (selected.includes(id)) {
        onSelect(selected.filter((s) => s !== id));
      } else {
        onSelect([...selected, id]);
      }
    } else {
      onSelect(id);
    }
  };

  if (credentials.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No accounts connected
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium">
        {multiSelect ? "Select Accounts" : "Select Account"}
      </label>
      <div className="flex flex-wrap gap-2">
        {credentials.map((cred) => (
          <Button
            key={cred.id}
            variant={isSelected(cred.id) ? "default" : "outline"}
            size="sm"
            onClick={() => handleSelect(cred.id)}
            disabled={disabled}
            className="text-xs"
          >
            {cred.accountName}
            {cred.isDefault && " ✓"}
          </Button>
        ))}
      </div>
      {multiSelect && Array.isArray(selectedAccountId) && (
        <p className="text-xs text-gray-500">
          {selectedAccountId.length > 0
            ? `${selectedAccountId.length} account(s) selected`
            : "No accounts selected"}
        </p>
      )}
    </div>
  );
};
