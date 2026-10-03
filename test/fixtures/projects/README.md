# CLI project fixtures

Tests copy each project to a fresh temporary directory and initialize Git there.
No dependencies are installed. All scripts use Node built-ins and make no network calls.
Environment seeds contain synthetic test-only values and become .env/.env.local only in copies.
Build and test scripts create the exact .generated artifacts checked by the suite.
The failing build still writes its marker, allowing the test script to prove continuation.
