<?php

if ($argc < 3) {
    fwrite(STDERR, "Usage: php check-coverage.php <clover-file> <threshold>\n");
    exit(1);
}

$cloverFile = $argv[1];
$threshold = (float) $argv[2];

if (!file_exists($cloverFile)) {
    fwrite(STDERR, "Coverage file not found: {$cloverFile}\n");
    exit(1);
}

$clover = simplexml_load_file($cloverFile);
if ($clover === false) {
    fwrite(STDERR, "Unable to parse coverage file: {$cloverFile}\n");
    exit(1);
}

$metricsNodes = $clover->xpath('//metrics');
if (!$metricsNodes || !isset($metricsNodes[0])) {
    fwrite(STDERR, "No coverage metrics found in {$cloverFile}\n");
    exit(1);
}

$metrics = $metricsNodes[0];
$statements = (float) ($metrics['statements'] ?? 0);
$coveredStatements = (float) ($metrics['coveredstatements'] ?? 0);

if ($statements === 0.0) {
    fwrite(STDERR, "No statements found to measure coverage.\n");
    exit(1);
}

$coverage = ($coveredStatements / $statements) * 100;

if ($coverage + 0.0001 < $threshold) {
    fwrite(
        STDERR,
        sprintf("Coverage %.2f%% is below required threshold of %.2f%%\n", $coverage, $threshold)
    );
    exit(1);
}

fwrite(
    STDOUT,
    sprintf("Coverage %.2f%% meets the %.2f%% threshold.\n", $coverage, $threshold)
);
