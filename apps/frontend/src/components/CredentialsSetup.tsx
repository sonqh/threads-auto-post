import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { api } from "../lib/api";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";

interface CredentialInputs {
  accountName: string;
  threadsUserId: string;
  accessToken: string;
  refreshToken: string;
  accountDescription?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

export const CredentialsSetup: React.FC<{
  onSuccess?: () => void;
  isModal?: boolean;
}> = ({ onSuccess, isModal = false }) => {
  const [credentials, setCredentials] = useState<CredentialInputs>({
    accountName: "",
    threadsUserId: "",
    accessToken: "",
    refreshToken: "",
    accountDescription: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showRawMode, setShowRawMode] = useState(false);

  const validateInputs = (): boolean => {
    const newErrors: ValidationError[] = [];

    if (!credentials.accountName.trim()) {
      newErrors.push({
        field: "accountName",
        message: "Account name is required",
      });
    }

    if (!credentials.threadsUserId.trim()) {
      newErrors.push({
        field: "threadsUserId",
        message: "Threads User ID is required",
      });
    }

    if (!credentials.accessToken.trim()) {
      newErrors.push({
        field: "accessToken",
        message: "Access Token is required",
      });
    }

    // Validate token format (should be alphanumeric string)
    if (
      credentials.accessToken &&
      !/^[a-zA-Z0-9_-]+$/.test(credentials.accessToken)
    ) {
      newErrors.push({
        field: "accessToken",
        message: "Access Token format appears invalid",
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleInputChange = (field: keyof CredentialInputs, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field when user starts typing
    setErrors((prev) => prev.filter((e) => e.field !== field));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // Send to backend to store credentials
      const response = await api.post("/credentials/setup", {
        accountName: credentials.accountName.trim(),
        threadsUserId: credentials.threadsUserId.trim(),
        accessToken: credentials.accessToken.trim(),
        refreshToken: credentials.refreshToken.trim(),
        accountDescription: credentials.accountDescription?.trim(),
      });

      if (response.data.success) {
        setSuccess(true);
        setCredentials({
          accountName: "",
          threadsUserId: "",
          accessToken: "",
          refreshToken: "",
          accountDescription: "",
        });

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(false);
          if (onSuccess) {
            onSuccess();
          }
        }, 3000);
      }
    } catch (error) {
      setErrors([
        {
          field: "submit",
          message:
            error instanceof Error
              ? error.message
              : "Failed to save credentials",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submitError = errors.find((e) => e.field === "submit");

  return (
    <div className={isModal ? "" : "max-w-2xl mx-auto"}>
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Threads Account Setup</h2>
          <p className="text-gray-600">
            Enter your Threads account credentials to start scheduling posts
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">Success!</h3>
              <p className="text-green-700">
                Your Threads account has been connected successfully
              </p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700">{submitError.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Account Name *
            </label>
            <Input
              placeholder="e.g., Brand Main, Creator Account"
              value={credentials.accountName}
              onChange={(e) => handleInputChange("accountName", e.target.value)}
              disabled={loading}
              className={
                errors.find((e) => e.field === "accountName")
                  ? "border-red-500"
                  : ""
              }
            />
            {errors.find((e) => e.field === "accountName") && (
              <p className="mt-1 text-sm text-red-500">
                {errors.find((e) => e.field === "accountName")?.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              A friendly name to identify this account
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description (Optional)
            </label>
            <Input
              placeholder="e.g., Main brand account for product announcements"
              value={credentials.accountDescription}
              onChange={(e) =>
                handleInputChange("accountDescription", e.target.value)
              }
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Add a description to remember what this account is for
            </p>
          </div>

          {/* Threads User ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Threads User ID *
            </label>
            <Input
              placeholder="123456789"
              value={credentials.threadsUserId}
              onChange={(e) =>
                handleInputChange("threadsUserId", e.target.value)
              }
              disabled={loading}
              className={
                errors.find((e) => e.field === "threadsUserId")
                  ? "border-red-500"
                  : ""
              }
            />
            {errors.find((e) => e.field === "threadsUserId") && (
              <p className="mt-1 text-sm text-red-500">
                {errors.find((e) => e.field === "threadsUserId")?.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Your numeric Threads user ID (found in Threads API settings)
            </p>
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Access Token *
            </label>
            <Input
              type={showRawMode ? "text" : "password"}
              placeholder="Your access token..."
              value={credentials.accessToken}
              onChange={(e) => handleInputChange("accessToken", e.target.value)}
              disabled={loading}
              className={
                errors.find((e) => e.field === "accessToken")
                  ? "border-red-500"
                  : ""
              }
            />
            {errors.find((e) => e.field === "accessToken") && (
              <p className="mt-1 text-sm text-red-500">
                {errors.find((e) => e.field === "accessToken")?.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              OAuth access token for API authentication
            </p>
          </div>

          {/* Refresh Token */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Refresh Token (Optional)
            </label>
            <Input
              type={showRawMode ? "text" : "password"}
              placeholder="Your refresh token (optional)..."
              value={credentials.refreshToken}
              onChange={(e) =>
                handleInputChange("refreshToken", e.target.value)
              }
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Used to automatically refresh access tokens
            </p>
          </div>

          {/* Show/Hide Tokens Toggle */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="showTokens"
              checked={showRawMode}
              onChange={(e) => setShowRawMode(e.target.checked)}
              disabled={loading}
              className="rounded"
            />
            <label htmlFor="showTokens" className="text-sm text-gray-600">
              Show tokens
            </label>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">
              Where to find these credentials:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to Threads Business Account Settings</li>
              <li>Navigate to Apps & Accounts → Connected Experiences</li>
              <li>Click "Generate Token" or view existing tokens</li>
              <li>Copy the User ID, Access Token, and Refresh Token</li>
              <li>Paste them in the form above</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 flex-1"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {loading ? "Connecting..." : "Connect Account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCredentials({
                  accountName: "",
                  threadsUserId: "",
                  accessToken: "",
                  refreshToken: "",
                  accountDescription: "",
                })
              }
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </form>

        {/* Additional Help */}
        <div className="mt-6 pt-6 border-t">
          <details className="cursor-pointer">
            <summary className="font-medium text-gray-700 hover:text-gray-900">
              Need help? Common issues
            </summary>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p>
                <strong>Invalid token format:</strong> Make sure you copied the
                entire token without extra spaces
              </p>
              <p>
                <strong>Authentication failed:</strong> Verify the token is
                still valid and hasn't expired
              </p>
              <p>
                <strong>User ID not found:</strong> Check it's your numeric ID,
                not your username
              </p>
              <p>
                <strong>Need to regenerate tokens?</strong> Go back to your
                Threads settings and generate a new token
              </p>
            </div>
          </details>
        </div>
      </Card>
    </div>
  );
};
