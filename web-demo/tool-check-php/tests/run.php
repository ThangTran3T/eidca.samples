<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

$repository = dirname(__DIR__, 3);
$cases = [
    $repository . '/samples/bkavca-tenant/signed_xml-test.xml' => 'VALID',
    $repository . '/samples/any-provider/signed_dung.pdf' => 'VALID',
    $repository . '/samples/any-provider/signed_sai.pdf' => 'INVALID',
];

$localSample = $repository . '/samples/templates/signed_sample_csdlksk.xml';
if (is_file($localSample)) $cases[$localSample] = 'VALID';

$failures = 0;
foreach ($cases as $file => $expected) {
    $contents = file_get_contents($file);
    if ($contents === false) throw new RuntimeException("Cannot read fixture: {$file}");
    $result = verify_document($contents, basename($file));
    $actual = $result['verification']['status'];
    $message = $result['verification']['signatures'][0]['message'] ?? '';
    printf("%-34s expected=%-7s actual=%-7s %s\n", basename($file), $expected, $actual, $message);
    if ($actual !== $expected) $failures++;
}

if ($failures > 0) {
    fwrite(STDERR, "{$failures} verification test(s) failed.\n");
    exit(1);
}

echo "All PHP verification tests passed.\n";
