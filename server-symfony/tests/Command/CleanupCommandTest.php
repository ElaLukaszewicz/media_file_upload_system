<?php

namespace App\Tests\Command;

use App\Command\CleanupCommand;
use App\Service\ChunkManagerInterface;
use App\Service\FileStorageInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Tester\CommandTester;

class CleanupCommandTest extends TestCase
{
    public function testExecuteRunsCleanupAndLogs(): void
    {
        $chunkManager = $this->createMock(ChunkManagerInterface::class);
        $fileStorage = $this->createMock(FileStorageInterface::class);
        $logger = $this->createMock(LoggerInterface::class);

        $chunkManager->expects($this->once())
            ->method('cleanupIncompleteChunks')
            ->with(10)
            ->willReturn(2);

        $fileStorage->expects($this->once())
            ->method('cleanupOldFiles')
            ->with(5)
            ->willReturn(3);

        $logger->expects($this->exactly(2))->method('info');

        $command = new CleanupCommand($chunkManager, $fileStorage, $logger, chunkTimeout: 10, fileRetentionDays: 5);
        $tester = new CommandTester($command);

        $status = $tester->execute([]);

        $this->assertSame(0, $status);
        $output = $tester->getDisplay();
        $this->assertStringContainsString('Cleaned up 2 incomplete chunk sessions', $output);
        $this->assertStringContainsString('Cleaned up 3 old files', $output);
    }
}

