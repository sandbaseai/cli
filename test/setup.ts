// Loaded with `node --import` before every test file (and inherited by spawned
// CLI processes): tests must never reach the real SandBase API or npm registry.
process.env.SANDBASE_DOCTOR_NETWORK ??= "0";
process.env.SANDBASE_NO_UPDATE_CHECK ??= "1";
