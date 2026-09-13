import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

const startServer = () =>
  new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve(server);
    });
  });

const stopServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const withServer = async (callback) => {
  const server = await startServer();

  try {
    return await callback(server);
  } finally {
    await stopServer(server);
  }
};

test("health endpoint returns OK payload", async () => {
  await withServer(async (server) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health`
    );
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.status, "ok");
    assert.equal(data.service, "ddpro-backend");
  });
});

test("invalid UUID returns 400 before hitting the database", async () => {
  await withServer(async (server) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/projects/not-a-uuid`
    );
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.status, "error");
    assert.match(data.message, /valid UUID/);
  });
});

test("create project reports 503 when database is not configured", async () => {
  await withServer(async (server) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/projects`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "DDPro Test Projesi",
          projectType: "Denetim",
          status: "Aktif",
        }),
      }
    );
    const data = await response.json();

    assert.equal(response.status, 503);
    assert.equal(data.status, "error");
    assert.equal(data.message, "Database service is not configured");
  });
});

test("update project validates id and reports 503 without database", async () => {
  await withServer(async (server) => {
    const invalidResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/projects/not-a-uuid`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "DDPro Güncelleme",
          status: "Aktif",
        }),
      }
    );
    const invalidPayload = await invalidResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.match(invalidPayload.message, /valid UUID/);

    const serviceUnavailableResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/projects/123e4567-e89b-12d3-a456-426614174000`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "DDPro Güncelleme",
          status: "Aktif",
        }),
      }
    );
    const serviceUnavailablePayload =
      await serviceUnavailableResponse.json();

    assert.equal(serviceUnavailableResponse.status, 503);
    assert.equal(
      serviceUnavailablePayload.message,
      "Database service is not configured"
    );
  });
});

test("research update and delete guard invalid ids and missing database", async () => {
  await withServer(async (server) => {
    const invalidUpdate = await fetch(
      `http://127.0.0.1:${server.address().port}/api/research/not-a-uuid`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Araştırma",
        }),
      }
    );
    const invalidUpdatePayload = await invalidUpdate.json();

    assert.equal(invalidUpdate.status, 400);
    assert.match(invalidUpdatePayload.message, /valid UUID/);

    const serviceUnavailableUpdate = await fetch(
      `http://127.0.0.1:${server.address().port}/api/research/123e4567-e89b-12d3-a456-426614174000`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Araştırma",
        }),
      }
    );
    const serviceUnavailableUpdatePayload =
      await serviceUnavailableUpdate.json();

    assert.equal(serviceUnavailableUpdate.status, 503);
    assert.equal(
      serviceUnavailableUpdatePayload.message,
      "Database service is not configured"
    );

    const invalidDelete = await fetch(
      `http://127.0.0.1:${server.address().port}/api/research/not-a-uuid`,
      {
        method: "DELETE",
      }
    );
    const invalidDeletePayload = await invalidDelete.json();

    assert.equal(invalidDelete.status, 400);
    assert.match(invalidDeletePayload.message, /valid UUID/);

    const serviceUnavailableDelete = await fetch(
      `http://127.0.0.1:${server.address().port}/api/research/123e4567-e89b-12d3-a456-426614174000`,
      {
        method: "DELETE",
      }
    );
    const serviceUnavailableDeletePayload =
      await serviceUnavailableDelete.json();

    assert.equal(serviceUnavailableDelete.status, 503);
    assert.equal(
      serviceUnavailableDeletePayload.message,
      "Database service is not configured"
    );
  });
});

test("offer update guards invalid ids and missing database", async () => {
  await withServer(async (server) => {
    const invalidResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/offers/not-a-uuid`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Teklif",
          amount: 1500,
        }),
      }
    );
    const invalidPayload = await invalidResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.match(invalidPayload.message, /valid UUID/);

    const serviceUnavailableResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/offers/123e4567-e89b-12d3-a456-426614174000`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Teklif",
          amount: 1500,
        }),
      }
    );
    const serviceUnavailablePayload =
      await serviceUnavailableResponse.json();

    assert.equal(serviceUnavailableResponse.status, 503);
    assert.equal(
      serviceUnavailablePayload.message,
      "Database service is not configured"
    );
  });
});

test("unknown routes return 404", async () => {
  await withServer(async (server) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/missing-route`
    );
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.status, "error");
  });
});
