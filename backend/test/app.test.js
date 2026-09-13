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
