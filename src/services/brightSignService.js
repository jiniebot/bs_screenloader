import config from "../config/index.js";

const TOKEN_URL = "https://auth.bsn.cloud/realms/bsncloud/protocol/openid-connect/token";
const WS_MESSAGE_URL = "https://ws.bsn.cloud/rest/v1/sendWsMessage";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.bsnCloud.clientId,
      client_secret: config.bsnCloud.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`BSN.cloud token request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Refresh a bit before actual expiry to avoid racing an in-flight request against it.
  cachedTokenExpiresAt = Date.now() + Math.max(data.expires_in - 30, 10) * 1000;
  return cachedToken;
}

export async function captureScreenSnapshot(brightSignSerial) {
  if (!brightSignSerial) {
    throw new Error("Screen has no BrightSign serial configured.");
  }

  const token = await getAccessToken();
  const url = new URL(WS_MESSAGE_URL);
  url.searchParams.set("destinationType", "player");
  url.searchParams.set("destinationName", brightSignSerial);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      route: "/v1/snapshot",
      method: "POST",
      data: { shouldCaptureFullResolution: false },
    }),
  });

  if (!response.ok) {
    throw new Error(`BSN.cloud snapshot request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const result = payload?.data?.result;
  if (!result?.remoteSnapshotThumbnail) {
    throw new Error("Player did not return a snapshot. It may be offline.");
  }

  return {
    dataUrl: result.remoteSnapshotThumbnail,
    timestamp: result.timestamp,
  };
}
