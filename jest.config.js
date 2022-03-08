require("dotenv").config({ path: "env.example" });

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["dist", "/node_modules", "__integrations__"]
};
