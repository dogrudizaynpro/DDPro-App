// DDPro API - Database bağlantı katmanı

const database = {
  connected: false,
  provider: null,
  url: null
};

export const connectDatabase = (provider, url) => {
  database.provider = provider;
  database.url = url;
  database.connected = true;

  return {
    success: true,
    provider,
    connected: true
  };
};

export const getDatabaseStatus = () => {
  return {
    connected: database.connected,
    provider: database.provider
  };
};

export const disconnectDatabase = () => {
  database.connected = false;
  database.provider = null;
  database.url = null;

  return {
    success: true,
    connected: false
  };
};

export default database;
