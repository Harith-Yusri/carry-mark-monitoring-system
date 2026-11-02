const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

// EAS may provide GOOGLE_SERVICES_JSON as a file environment variable.
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    || config.android?.googleServicesFile
    || "./google-services.json";
  const absolutePath = resolve(__dirname, googleServicesFile);
  if (existsSync(absolutePath)) {
    let firebaseConfig;
    try {
      firebaseConfig = JSON.parse(readFileSync(absolutePath, "utf8"));
    } catch {
      throw new Error("The Android google-services.json file is not valid JSON.");
    }
    const matchingClient = firebaseConfig.client?.some(client =>
      client.client_info?.android_client_info?.package_name === config.android?.package);
    if (!matchingClient || !firebaseConfig.project_info?.project_number) {
      throw new Error(`google-services.json must contain the Firebase Android client for ${config.android?.package}. Use the client configuration, not a service-account private key.`);
    }
  } else if (process.env.EAS_BUILD_PLATFORM === "android") {
    throw new Error("Android push setup requires student-mobile-expo/google-services.json or an EAS GOOGLE_SERVICES_JSON file environment variable before building.");
  }
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile,
    },
  };
};
