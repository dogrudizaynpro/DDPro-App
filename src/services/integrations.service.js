import { fetchAPI } from "./api.js";

export const INTEGRATION_STATUS_MAX_AGE = 5 * 60 * 1000;

export const isIntegrationStatusStale = (connection, now = Date.now(), receivedAt) => {
  const checkedAt = Date.parse(
    connection?.lastTest?.testedAt || connection?.checkedAt || "",
  );
  const serverNow = Date.parse(connection?.checkedAt || "");
  // Age server evidence using its matching receipt time, not a stale render clock.
  const referenceTime = Number.isFinite(receivedAt) && Number.isFinite(serverNow)
    ? serverNow + Math.max(0, now - receivedAt)
    : now;
  const age = referenceTime - checkedAt;
  return !Number.isFinite(age) || age < 0 || age >= INTEGRATION_STATUS_MAX_AGE;
};

export const createIntegrationStatusStore = (
  fetchStatus,
  now = () => Date.now(),
) => {
  let snapshot = {
    status: null,
    checkedAt: null,
    updatedAt: null,
    refreshing: false,
    error: null,
  };
  let pendingRequest;
  let revision = 0;
  const subscribers = new Set();

  const publish = (changes) => {
    snapshot = { ...snapshot, ...changes };
    subscribers.forEach((subscriber) => subscriber());
  };

  const store = {
    getSnapshot: () => snapshot,
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    invalidate: () => { revision += 1; },
    refresh: () => {
      if (pendingRequest) return pendingRequest;

      const startedRevision = revision;
      publish({ refreshing: true, error: null });
      const pending = Promise.resolve()
        .then(fetchStatus)
        .then((status) => {
          if (startedRevision !== revision) return status;
          const updatedAt = now();
          publish({
            status,
            checkedAt: status?.checkedAt || new Date(updatedAt).toISOString(),
            updatedAt,
            error: null,
          });
          return status;
        })
        .catch((error) => {
          if (startedRevision !== revision) return;
          publish({ error });
          throw error;
        })
        .finally(() => {
          if (pendingRequest === pending) pendingRequest = undefined;
          publish({ refreshing: false });
        })
        // A completed test makes older GETs obsolete for subscribers and callers alike.
        .then((status) => startedRevision === revision ? status : store.refresh());
      pendingRequest = pending;
      return pending;
    },
  };
  return store;
};

const fetchIntegrationStatus = async () => {
  const response = await fetchAPI("/api/integrations/status");
  return response.data;
};

const integrationStatusStore = createIntegrationStatusStore(fetchIntegrationStatus);

export const getIntegrationStatus = () => integrationStatusStore.refresh();
export const getIntegrationStatusSnapshot = integrationStatusStore.getSnapshot;
export const subscribeToIntegrationStatus = integrationStatusStore.subscribe;

export const testIntegrationConnection = async (provider) => {
  try {
    return await fetchAPI(`/api/integrations/test/${encodeURIComponent(provider)}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } finally {
    integrationStatusStore.invalidate();
  }
};
