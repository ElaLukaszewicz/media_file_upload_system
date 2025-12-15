<?php

namespace App\Command;

use App\Service\ChunkManagerInterface;
use App\Service\FileStorageInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:cleanup',
    description: 'Cleanup incomplete chunks and old files'
)]
class CleanupCommand extends Command
{
    public function __construct(
        private readonly ChunkManagerInterface $chunkManager,
        private readonly FileStorageInterface $fileStorage,
        private readonly LoggerInterface $logger,
        private readonly int $chunkTimeout = 1800,
        private readonly int $fileRetentionDays = 30,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('Starting cleanup process');

        // Cleanup incomplete chunks
        $io->section('Cleaning up incomplete chunks');
        $cleanedChunks = $this->chunkManager->cleanupIncompleteChunks($this->chunkTimeout);
        $io->success("Cleaned up {$cleanedChunks} incomplete chunk sessions");

        $this->logger->info('Cleanup command executed', [
            'cleanedChunks' => $cleanedChunks,
            'chunkTimeout' => $this->chunkTimeout,
        ]);

        // Cleanup old files
        $io->section('Cleaning up old files');
        $cleanedFiles = $this->fileStorage->cleanupOldFiles($this->fileRetentionDays);
        $io->success("Cleaned up {$cleanedFiles} old files");

        $this->logger->info('File cleanup executed', [
            'cleanedFiles' => $cleanedFiles,
            'retentionDays' => $this->fileRetentionDays,
        ]);

        $io->success('Cleanup completed successfully');

        return Command::SUCCESS;
    }
}

