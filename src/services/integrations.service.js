import { fetchAPI } from "./api.js";

export const INTEGRATION_STATUS_MAX_AGE = 5 * 60 * 1000;

export const isIntegrationStatusStale = (connection, now = Date.now()) => {
  const checkedAt = Date.parse(
    connection?.lastTest?.testedAt || connection?.checkedAt || "",
  );
  const age = now - checkedAt;
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
  const subscribers = new Set();

  const publish = (changes) => {
    snapshot = { ...snapshot, ...changes };
    subscribers.forEach((subscriber) => subscriber());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    refresh: () => {
      if (pendingRequest) return pendingRequest;

      publish({ refreshing: true, error: null });
      const pending = Promise.resolve()
        .then(fetchStatus)
        .then((status) => {
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
          publish({ error });
          throw error;
        })
        .finally(() => {
          if (pendingRequest === pending) pendingRequest = undefined;
          publish({ refreshing: false });
        });
      pendingRequest = pending;
      return pending;
    },
  };
};

const fetchIntegrationStatus = async () => {
  const response = await fetchAPI("/api/integrations/status");
  return response.data;
};

const integrationStatusStore = createIntegrationStatusStore(fetchIntegrationStatus);

export const getIntegrationStatus = () => integrationStatusStore.refresh();
export const getIntegrationStatusSnapshot = integrationStatusStore.getSnapshot;
export const subscribeToIntegrationStatus = integrationStatusStore.subscribe;

export const testIntegrationConnection = async (provider) =>
  fetchAPI(`/api/integrations/test/${encodeURIComponent(provider)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
