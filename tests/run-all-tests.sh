#!/bin/bash

echo "🧪 vssh Complete Test Suite"
echo "=========================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "📋 Running: $test_name"
    
    if $test_command > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}: $test_name"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ FAILED${NC}: $test_name"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Build the project first
echo "🔨 Building project..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Run tests
run_test "TypeScript Compilation" "npm run lint"
run_test "Command Guard Tests" "npm run test:guard"
run_test "Plugin System Tests" "npm run test:plugins"
run_test "CLI Help Command" "node dist/index.js --help"
run_test "Plugin List Command" "node dist/index.js plugins list"

# Summary
echo "📊 Test Summary"
echo "=============="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi