import "dotenv/config";
/**
 * Processing belongs in a separate worker/container. Before enabling jobs, add a durable queue and disposable sandbox:
 * non-root user, network disabled by default, CPU/RAM/disk/time limits, workspace-only mounts,
 * strict path validation, output validation, and explicit approval before patching or signing.
 */
console.log("APKForge AI worker placeholder ready. Uploaded binaries are never executed.");
