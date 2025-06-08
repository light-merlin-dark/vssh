#!/usr/bin/env node

/**
 * Safe CommandGuard Testing Script
 *
 * This script tests the CommandGuard service against string patterns
 * WITHOUT executing any actual commands. It's completely safe to run.
 */

import { CommandGuard } from "../src/services/command-guard";

interface TestCase {
  command: string;
  shouldBlock: boolean;
  description: string;
  category?: string;
}

const testCases: TestCase[] = [
  // Filesystem destruction tests
  {
    command: "rm -rf /",
    shouldBlock: true,
    description: "Root filesystem deletion",
    category: "filesystem",
  },
  {
    command: "sudo rm -rf /",
    shouldBlock: true,
    description: "Root filesystem deletion with sudo",
    category: "filesystem",
  },
  {
    command: "rm -rf /*",
    shouldBlock: true,
    description: "Root filesystem wildcard deletion",
    category: "filesystem",
  },
  {
    command: "RM -RF /VAR",
    shouldBlock: true,
    description: "System directory deletion (case insensitive)",
    category: "filesystem",
  },
  {
    command: "rm -rf /var",
    shouldBlock: true,
    description: "System directory deletion",
    category: "filesystem",
  },
  {
    command: "rm --no-preserve-root -rf /",
    shouldBlock: true,
    description: "Root deletion with no-preserve-root",
    category: "filesystem",
  },
  {
    command: "sudo rm -rf --no-preserve-root /",
    shouldBlock: true,
    description: "Root deletion with sudo and no-preserve-root",
    category: "filesystem",
  },

  // Disk operations tests
  {
    command: "dd if=/dev/zero of=/dev/sda",
    shouldBlock: true,
    description: "Disk wiping with dd",
    category: "disk",
  },
  {
    command: "mkfs.ext4 /dev/sda1",
    shouldBlock: true,
    description: "Filesystem formatting",
    category: "disk",
  },
  {
    command: "fdisk /dev/sda",
    shouldBlock: true,
    description: "Disk partitioning",
    category: "disk",
  },

  // Docker destruction tests
  {
    command: "docker system prune -a --volumes --force",
    shouldBlock: true,
    description: "Docker mass destruction",
    category: "docker",
  },
  {
    command: "docker system prune -af --volumes",
    shouldBlock: true,
    description: "Docker mass destruction (short flags)",
    category: "docker",
  },
  {
    command: "docker volume prune --force",
    shouldBlock: true,
    description: "Docker volume mass deletion",
    category: "docker",
  },
  {
    command: "docker compose down --volumes",
    shouldBlock: true,
    description: "Docker compose v2 volume destruction",
    category: "docker",
  },
  {
    command: "docker compose down --volumes --remove-orphans",
    shouldBlock: true,
    description: "Docker compose v2 with orphan removal",
    category: "docker",
  },

  // Service destruction tests
  {
    command: "systemctl stop docker",
    shouldBlock: true,
    description: "Stop Docker service",
    category: "service",
  },
  {
    command: "sudo systemctl disable docker",
    shouldBlock: true,
    description: "Disable Docker service with sudo",
    category: "service",
  },
  {
    command: "systemctl stop ssh",
    shouldBlock: true,
    description: "Stop SSH service",
    category: "service",
  },
  {
    command: "systemctl mask sshd",
    shouldBlock: true,
    description: "Mask SSH daemon",
    category: "service",
  },

  // Application data destruction tests
  {
    command: "rm -rf /data/vssh",
    shouldBlock: true,
    description: "Delete vssh data",
    category: "application",
  },
  {
    command: "systemctl stop vssh",
    shouldBlock: true,
    description: "Stop vssh service",
    category: "application",
  },

  // Network destruction tests
  {
    command: "iptables -F",
    shouldBlock: true,
    description: "Flush iptables rules",
    category: "network",
  },
  {
    command: "ufw disable",
    shouldBlock: true,
    description: "Disable firewall",
    category: "network",
  },

  // Configuration destruction tests
  {
    command: "> /etc/passwd",
    shouldBlock: true,
    description: "Overwrite passwd file",
    category: "config",
  },
  {
    command: "sudo rm /etc/shadow",
    shouldBlock: true,
    description: "Delete shadow file with sudo",
    category: "config",
  },
  {
    command: "rm /etc/shadow",
    shouldBlock: true,
    description: "Delete shadow file",
    category: "config",
  },

  // Miscellaneous dangerous commands
  {
    command: ": () { : | : & }; :",
    shouldBlock: true,
    description: "Fork bomb",
    category: "misc",
  },
  {
    command: "shutdown -h now",
    shouldBlock: true,
    description: "Immediate shutdown",
    category: "misc",
  },
  {
    command: "sudo reboot now",
    shouldBlock: true,
    description: "Immediate reboot with sudo",
    category: "misc",
  },
  {
    command: "halt -f now",
    shouldBlock: true,
    description: "Force halt immediately",
    category: "misc",
  },

  // SAFE commands that should NOT be blocked
  {
    command: "ls -la",
    shouldBlock: false,
    description: "List files",
    category: "safe",
  },
  {
    command: "docker ps",
    shouldBlock: false,
    description: "List Docker containers",
    category: "safe",
  },
  {
    command: "systemctl status docker",
    shouldBlock: false,
    description: "Check Docker status",
    category: "safe",
  },
  {
    command: "cat /var/log/syslog",
    shouldBlock: false,
    description: "Read log file",
    category: "safe",
  },
  {
    command: "docker logs my-container",
    shouldBlock: false,
    description: "View container logs",
    category: "safe",
  },
  {
    command: "rm /tmp/tempfile.txt",
    shouldBlock: false,
    description: "Delete temp file",
    category: "safe",
  },
  {
    command: "docker restart my-app",
    shouldBlock: false,
    description: "Restart specific container",
    category: "safe",
  },
  {
    command: "systemctl restart nginx",
    shouldBlock: false,
    description: "Restart nginx service",
    category: "safe",
  },

  // Edge cases and safe commands that contain dangerous patterns
  {
    command: "echo 'rm -rf /' > /tmp/test.txt",
    shouldBlock: false,
    description: "Echo dangerous command to file (safe)",
    category: "edge-case",
  },
  {
    command: "grep 'rm -rf' /var/log/syslog",
    shouldBlock: false,
    description: "Search for dangerous patterns (safe)",
    category: "edge-case",
  },
  {
    command: "history | grep 'docker system prune'",
    shouldBlock: false,
    description: "Search command history (safe)",
    category: "edge-case",
  },
  {
    command: "man rm",
    shouldBlock: false,
    description: "Read manual page (safe)",
    category: "edge-case",
  },
  {
    command: "which systemctl",
    shouldBlock: false,
    description: "Find command location (safe)",
    category: "edge-case",
  },
];

function runTests(): void {
  console.log("🛡️  CommandGuard Safety Test Suite");
  console.log("=".repeat(60));
  console.log(
    "Testing dangerous command detection WITHOUT executing anything\n",
  );

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const results: {
    [category: string]: { passed: number; failed: number; total: number };
  } = {};

  for (const testCase of testCases) {
    totalTests++;
    const result = CommandGuard.checkCommand(testCase.command);
    const passed = result.isBlocked === testCase.shouldBlock;

    if (passed) {
      passedTests++;
    } else {
      failedTests++;
    }

    // Track by category
    const category = testCase.category || "unknown";
    if (!results[category]) {
      results[category] = { passed: 0, failed: 0, total: 0 };
    }
    results[category].total++;
    if (passed) {
      results[category].passed++;
    } else {
      results[category].failed++;
    }

    // Display result with improved formatting
    const status = passed ? "✅ PASS" : "❌ FAIL";
    const expectedAction = testCase.shouldBlock ? "BLOCK" : "ALLOW";
    const actualAction = result.isBlocked ? "BLOCKED" : "ALLOWED";

    console.log(
      `${status} [${category.toUpperCase().padEnd(12)}] ${testCase.description}`,
    );
    console.log(`   Command: "${testCase.command}"`);
    console.log(`   Expected: ${expectedAction} | Actual: ${actualAction}`);

    if (!passed) {
      console.log(
        `   ⚠️  Test failed! Expected ${expectedAction} but got ${actualAction}`,
      );
      // No suggestion property in CommandGuardResult
    }

    if (result.isBlocked && result.reasons.length > 0) {
      console.log(`   Block reason: ${result.reasons[0]}`);
    }

    console.log("");
  }

  // Summary
  console.log("=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(
    `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`,
  );
  console.log("");

  // Category breakdown
  console.log("📋 CATEGORY BREAKDOWN");
  console.log("-".repeat(40));
  for (const [category, stats] of Object.entries(results)) {
    const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(
      `${category.toUpperCase()}: ${stats.passed}/${stats.total} (${successRate}%)`,
    );
  }
  console.log("");

  if (failedTests === 0) {
    console.log(
      "🎉 ALL TESTS PASSED! CommandGuard appears to be working correctly.",
    );
    console.log("   ✓ Dangerous commands are being properly blocked");
    console.log("   ✓ Safe commands are being allowed through");
    console.log("   ✓ Edge cases are handled appropriately");
  } else {
    console.log("⚠️  SOME TESTS FAILED! CommandGuard needs adjustment.");
    console.log(
      "   Please review the failed tests above and update the guard patterns.",
    );
    console.log(
      "   Focus on patterns that either missed dangerous commands or blocked safe ones.",
    );
  }

  console.log("\n🔒 Security Notes:");
  console.log(
    "   • This test only validates pattern matching - no commands are executed",
  );
  console.log(
    "   • Integration testing with the actual CLI should be done carefully",
  );
  console.log(
    "   • Consider adding new test cases when new dangerous patterns are discovered",
  );
}

// Run the tests
try {
  runTests();
} catch (error) {
  console.error("❌ Error running tests:", error);
  process.exit(1);
}
